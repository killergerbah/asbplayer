import { Fetcher, HttpFetcher } from '@project/common';
import { DictionaryTrack } from '@project/common/settings';
import { AsyncSemaphore, fromBatches, HAS_LETTER_REGEX, isKanaOnly } from '@project/common/util';
import { coerce, lt, gte } from 'semver';

const YOMITAN_BATCH_SIZE = 100; // 1k can cause 1.5GB memory on Yomitan for subtitles, Anki cards may be larger too

export interface TokenPart {
    text: string;
    reading: string;
}

export class Yomitan {
    private readonly dt: DictionaryTrack;
    private readonly fetcher: Fetcher;
    private readonly asyncSemaphore: AsyncSemaphore;
    private readonly tokenizeCache: Map<string, TokenPart[][]>;
    private readonly lemmatizeCache: Map<string, string[]>;
    private readonly frequencyCache: Map<string, number | null>;
    private readonly tokensWereModified?: (token: string) => void;
    private supportsTokenizeFrequency: boolean;
    private lastCancelledAt: number;

    constructor(
        dictionaryTrack: DictionaryTrack,
        fetcher = new HttpFetcher(),
        tokensWereModified?: (token: string) => void
    ) {
        this.dt = dictionaryTrack;
        this.fetcher = fetcher;
        this.asyncSemaphore = new AsyncSemaphore({ permits: 1 });
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
        this.frequencyCache = new Map();
        this.tokensWereModified = tokensWereModified;
        this.supportsTokenizeFrequency = false;
        this.lastCancelledAt = 0;
    }

    getSupportsTokenizeFrequency(): boolean {
        return this.supportsTokenizeFrequency;
    }

    resetCache() {
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
        this.frequencyCache.clear();
        this.lastCancelledAt = Date.now();
    }

    async splitAndTokenizeBulk(text: string, yomitanUrl?: string): Promise<TokenPart[][]> {
        return this.tokenizeBulk(text.split(/(?:\p{STerm}|\r?\n)+/u), yomitanUrl);
    }

    async tokenize(text: string, yomitanUrl?: string): Promise<TokenPart[][]> {
        let tokens = this.tokenizeCache.get(text);
        if (tokens) return tokens;
        tokens = [];
        const response = await this._executeAction(
            'tokenize',
            { text, scanLength: this.dt.dictionaryYomitanScanLength },
            yomitanUrl
        );
        for (const res of response) {
            for (const tokenParts of res.content) {
                tokens.push(tokenParts);
                const headwords = tokenParts[0]?.headwords;
                if (headwords) {
                    const token = tokenParts
                        .map((p: any) => p.text)
                        .join('')
                        .trim();
                    if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, headwords);
                    if (!this.frequencyCache.has(token)) this.extractFrequencyFromTokenize(token, headwords);
                }
            }
        }
        this.tokenizeCache.set(text, tokens);
        return tokens;
    }

    async tokenizeBulk(allTexts: string[], yomitanUrl?: string): Promise<TokenPart[][]> {
        return fromBatches(
            allTexts,
            async (texts) => {
                const tokens: TokenPart[][] = [];
                const tokensToFetch = [];
                for (const text of texts) {
                    const tokensForText = this.tokenizeCache.get(text);
                    if (tokensForText) {
                        for (const token of tokensForText) tokens.push(token);
                        continue;
                    }
                    tokensToFetch.push(text);
                }
                if (!tokensToFetch.length) return tokens;
                const response = await this._executeAction(
                    'tokenize',
                    { text: tokensToFetch, scanLength: this.dt.dictionaryYomitanScanLength },
                    yomitanUrl
                );
                for (const res of response) {
                    const tokensForText: TokenPart[][] = [];
                    for (const tokenParts of res.content) {
                        tokensForText.push(tokenParts);
                        const headwords = tokenParts[0]?.headwords;
                        if (headwords) {
                            const token = tokenParts
                                .map((p: any) => p.text)
                                .join('')
                                .trim();
                            if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, headwords);
                            if (!this.frequencyCache.has(token)) this.extractFrequencyFromTokenize(token, headwords);
                        }
                    }
                    this.tokenizeCache.set(tokensToFetch[res.index], tokensForText);
                    for (const token of tokensForText) tokens.push(token);
                }
                return tokens;
            },
            { batchSize: YOMITAN_BATCH_SIZE }
        );
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's tokenize API.
     */
    private extractFrequencyFromTokenize(
        token: string,
        tokenizeHeadwords: any[],
        preferTermSource = true
    ): number | undefined {
        if (!this.supportsTokenizeFrequency) return;
        let minFrequency: number | undefined;
        for (const headwords of tokenizeHeadwords) {
            for (const headword of headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    if (source.matchSource !== 'term' && preferTermSource) continue; // Frequency of this exact form, don't promote rare kanji
                    if (!headword.frequencies) {
                        this.supportsTokenizeFrequency = false;
                        return;
                    }
                    for (const f of headword.frequencies) {
                        if (!Number.isFinite(f.frequency) || f.frequency <= 0) continue;
                        if (f.frequencyMode !== 'rank-based') continue;
                        minFrequency = minFrequency === undefined ? f.frequency : Math.min(minFrequency, f.frequency);
                    }
                    break;
                }
            }
        }
        if (minFrequency === undefined && preferTermSource) {
            return this.extractFrequencyFromTokenize(token, tokenizeHeadwords, false);
        }
        this.frequencyCache.set(token, minFrequency ?? null);
        return minFrequency;
    }

    /**
     * Lemmatize a token using Yomitan's termEntries API. There will likely always be edge cases but it should perform
     * well nearly all of the time. Returns the first term and reading lemmas (e.g. kanji and kana for Japanese). Examples:
     * 過ぎる   ->  過ぎる, すぎる
     * 過ぎます ->  過ぎる, すぎる
     * すぎる   ->  過ぎる, すぎる
     * すぎます ->  過ぎる, すぎる
     */
    private extractLemmas(token: string, entries: any[]): string[] {
        let foundLemma = false; // Only add the first valid lemma
        let lookForKanji = isKanaOnly(token); // Use the first valid kanji form if the token is only Hiragana/Katakana
        const lemmas: string[] = [];
        for (const headwords of entries) {
            for (const headword of headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    const lemma = source.deinflectedText; // This is either the term or reading, whatever the form of the input is
                    if (lookForKanji && lemma !== headword.term && lemma === headword.reading) {
                        lookForKanji = false;
                        if (!lemmas.includes(headword.term)) lemmas.unshift(headword.term); // e.g. すぎます -> 過ぎる
                    }
                    if (foundLemma) continue;
                    foundLemma = true;
                    if (!lemmas.includes(headword.term)) lemmas.unshift(headword.term);
                    if (!lemmas.includes(headword.reading)) lemmas.push(headword.reading);
                    if (!lemmas.includes(lemma)) lemmas.push(lemma); // Usually redundant but matchSource can be 'sequence' which could be different
                }
            }
        }
        this.lemmatizeCache.set(token, lemmas);
        return lemmas;
    }

    async lemmatize(token: string, yomitanUrl?: string): Promise<string[]> {
        const lemmas = this.lemmatizeCache.get(token);
        if (lemmas) return lemmas;
        if (!HAS_LETTER_REGEX.test(token)) {
            this.lemmatizeCache.set(token, []);
            return [];
        }
        const entries = (await this._executeAction('termEntries', { term: token }, yomitanUrl)).dictionaryEntries;
        return this.extractLemmas(
            token,
            entries.map((entry: any) => entry.headwords)
        );
    }

    /**
     * Get the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's API.
     * This function will return undefined immediately and asynchronously update the cache if tokensWereModified is provided and the token is not in the cache.
     */
    async frequency(token: string, yomitanUrl?: string): Promise<number | undefined> {
        const minFrequency = this.frequencyCache.get(token);
        if (minFrequency !== undefined) return minFrequency ?? undefined;
        if (!HAS_LETTER_REGEX.test(token)) {
            this.frequencyCache.set(token, null);
            return;
        }
        if (this.tokensWereModified) {
            void (async () => {
                const now = Date.now();
                const semaphoreId = await this.asyncSemaphore.acquire();
                try {
                    if (now <= this.lastCancelledAt) {
                        this.tokensWereModified!(token); // May need to reprocess with the new Yomitan instance
                        return;
                    }
                    if (this.frequencyCache.has(token)) return;
                    const entries = (await this._executeAction('termEntries', { term: token }, yomitanUrl))
                        .dictionaryEntries;
                    this.extractFrequency(token, entries);
                    this.tokensWereModified!(token);
                } finally {
                    this.asyncSemaphore.release(semaphoreId);
                }
            })();
            return;
        }
        const entries = (await this._executeAction('termEntries', { term: token }, yomitanUrl)).dictionaryEntries;
        return this.extractFrequency(token, entries);
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's termEntries API.
     */
    private extractFrequency(token: string, entries: any[], preferTermSource = true): number | undefined {
        let minFrequency: number | undefined;
        for (const entry of entries) {
            const matchingHeadwordIndices = new Set<number>();
            for (const [i, headword] of entry.headwords.entries()) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    if (source.matchSource !== 'term' && preferTermSource) continue; // Frequency of this exact form, don't promote rare kanji
                    matchingHeadwordIndices.add(headword.headwordIndex ?? i); // requires this.supportsTokenizeFrequency otherwise array index is more accurate than headword.index
                    break;
                }
            }
            if (!matchingHeadwordIndices.size) continue;
            for (const f of entry.frequencies) {
                if (!matchingHeadwordIndices.has(f.headwordIndex)) continue;
                if (!Number.isFinite(f.frequency) || f.frequency <= 0) continue;
                if (f.frequencyMode !== 'rank-based' && this.supportsTokenizeFrequency) continue; // Exposed with this.supportsTokenizeFrequency
                minFrequency = minFrequency === undefined ? f.frequency : Math.min(minFrequency, f.frequency);
            }
        }
        if (minFrequency === undefined && preferTermSource) return this.extractFrequency(token, entries, false);
        this.frequencyCache.set(token, minFrequency ?? null);
        return minFrequency;
    }

    async version(yomitanUrl?: string) {
        const version: string = (await this._executeAction('yomitanVersion', {}, yomitanUrl)).version;
        if (version === '0.0.0.0') {
            this.supportsTokenizeFrequency = true;
            return version;
        }
        const semver = coerce(version)?.version;
        if (!semver || lt(semver, '25.12.16')) {
            throw new Error(`Minimum Yomitan version is 25.12.16.0, found ${version}`);
        }
        if (gte(semver, '26.2.15')) this.supportsTokenizeFrequency = true; // TODO: Use actual version
        return version;
    }

    private async _executeAction(path: string, body: object, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl ?? this.dt.dictionaryYomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
