import { Fetcher, HttpFetcher, Progress } from '@project/common';
import { DictionaryTrack } from '@project/common/settings';
import { AsyncSemaphore, fromBatches, HAS_LETTER_REGEX, isKanaOnly } from '@project/common/util';
import { coerce, lt, gte } from 'semver';

const YOMITAN_BATCH_SIZE = 100; // 1k can cause 1.5GB memory on Yomitan for subtitles, Anki cards may be larger too

const YEAR_MONTH_REGEX = /(?<year>20\d{2})(?<month>[01]\d)/;

export interface TokenPart {
    text: string;
    reading: string;
}

interface TokenPartResult extends TokenPart {
    lemma?: string;
    lemmaReading?: string;
    headwords?: TermHeadword[][];
}

interface TermHeadword {
    index: number;
    headwordIndex?: number;
    term: string;
    reading: string;
    sources: TermSource[];
    frequencies?: TermFrequency[];
}

interface TermSource {
    originalText: string;
    transformedText: string;
    deinflectedText: string;
    matchType: 'exact' | 'prefix' | 'suffix';
    matchSource: 'term' | 'reading' | 'sequence';
    isPrimary: boolean;
}

interface TermFrequency {
    index: number;
    headwordIndex: number;
    dictionary: string;
    dictionaryIndex: number;
    dictionaryAlias: string;
    hasReading: boolean;
    frequencyMode?: 'occurrence-based' | 'rank-based' | null;
    frequency: number;
    displayValue: string | null;
    displayValueParsed: boolean;
}

interface TokenizeResult {
    id: string;
    source: string;
    dictionary: string;
    index: number;
    content: TokenPartResult[][];
}

interface TermDictionaryEntry {
    headwords: TermHeadword[];
    frequencies: TermFrequency[];
}

export class Yomitan {
    private readonly dt: DictionaryTrack;
    private readonly fetcher: Fetcher;
    private readonly asyncSemaphore: AsyncSemaphore;
    private readonly tokenizeCache: Map<string, TokenPart[][]>;
    private readonly lemmatizeCache: Map<string, string[]>;
    private readonly frequencyCache: Map<string, number | null>;
    private readonly lemmaTokenFallback: boolean; // Allow collecting ungrouped segments (no dictionary entry)
    private readonly tokensWereModified?: (token: string) => void;
    private supportsMecab: boolean;
    private supportsMecabLemma: boolean;
    private supportsTokenizeFrequency: boolean;
    private lastCancelledAt: number;

    constructor(
        dictionaryTrack: DictionaryTrack,
        fetcher = new HttpFetcher(),
        options?: { lemmaTokenFallback: boolean; tokensWereModified: (token: string) => void }
    ) {
        this.dt = dictionaryTrack;
        this.fetcher = fetcher;
        this.asyncSemaphore = new AsyncSemaphore({ permits: 1 });
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
        this.frequencyCache = new Map();
        this.lemmaTokenFallback = options?.lemmaTokenFallback ?? false;
        this.tokensWereModified = options?.tokensWereModified;
        this.supportsMecab = false;
        this.supportsMecabLemma = false;
        this.supportsTokenizeFrequency = false;
        this.lastCancelledAt = 0;
    }

    getSupportsMecab(): boolean {
        return this.supportsMecab;
    }

    getSupportsMecabLemma(): boolean {
        return this.supportsMecabLemma;
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

    async splitAndTokenizeBulk(
        text: string,
        statusUpdates?: (progress: Progress) => Promise<void>,
        yomitanUrl?: string
    ): Promise<TokenPart[][]> {
        return this.tokenizeBulk(
            text
                .split(/(?:\p{STerm}|\r?\n)+/u)
                .map((p) => p.trim())
                .filter((p) => HAS_LETTER_REGEX.test(p)),
            statusUpdates,
            yomitanUrl
        );
    }

    async tokenize(text: string, yomitanUrl?: string): Promise<TokenPart[][]> {
        let tokens = this.tokenizeCache.get(text);
        if (tokens) return tokens;
        tokens = [];

        if (this.dt.dictionaryYomitanParser === 'mecab' && !this.getSupportsMecab()) {
            throw new Error('Yomitan is not configured to support MeCab');
        }
        const tokenizeResults = this.filterDictionaries(
            await this._executeAction(
                'tokenize',
                { text, scanLength: this.dt.dictionaryYomitanScanLength, parser: this.dt.dictionaryYomitanParser },
                yomitanUrl
            ),
            this.dt.dictionaryYomitanParser
        );

        for (const res of tokenizeResults) {
            for (const tokenParts of res.content) {
                tokens.push(tokenParts);
                this.cacheFromTokenize(tokenParts);
            }
        }
        this.tokenizeCache.set(text, tokens);
        return tokens;
    }

    async tokenizeBulk(
        allTexts: string[],
        statusUpdates?: (progress: Progress) => Promise<void>,
        yomitanUrl?: string
    ): Promise<TokenPart[][]> {
        return fromBatches(
            allTexts,
            async (texts) => {
                const tokens: TokenPart[][] = [];
                const tokensToFetch = [];
                for (const text of texts) {
                    const tokensForText = this.tokenizeCache.get(text);
                    if (tokensForText) {
                        for (const tokenParts of tokensForText) tokens.push(tokenParts);
                        continue;
                    }
                    tokensToFetch.push(text);
                }
                if (!tokensToFetch.length) return tokens;

                if (this.dt.dictionaryYomitanParser === 'mecab' && !this.getSupportsMecab()) {
                    throw new Error('Yomitan is not configured to support MeCab');
                }
                const tokenizeResults = this.filterDictionaries(
                    await this._executeAction(
                        'tokenize',
                        {
                            text: tokensToFetch,
                            scanLength: this.dt.dictionaryYomitanScanLength,
                            parser: this.dt.dictionaryYomitanParser,
                        },
                        yomitanUrl
                    ),
                    this.dt.dictionaryYomitanParser
                );

                for (const res of tokenizeResults) {
                    const tokensForText: TokenPart[][] = [];
                    for (const tokenParts of res.content) {
                        tokensForText.push(tokenParts);
                        this.cacheFromTokenize(tokenParts);
                    }
                    this.tokenizeCache.set(tokensToFetch[res.index], tokensForText);
                    for (const tokenParts of tokensForText) tokens.push(tokenParts);
                }
                return tokens;
            },
            { batchSize: YOMITAN_BATCH_SIZE, statusUpdates }
        );
    }

    private filterDictionaries(
        tokenizeRes: TokenizeResult[],
        parser: typeof this.dt.dictionaryYomitanParser
    ): TokenizeResult[] {
        if (parser !== 'mecab') return tokenizeRes;

        // MeCab can return multiple dictionaries for the same text index.
        // Prefer newest UniDic (YYYYMM) when available, then other UniDic variants (e.g. unidic-mecab-translate),
        // then non-UniDic. Among non-UniDic, avoid ipadic-neologd when another option exists.
        const indexDictMap = new Map<number, { res: TokenizeResult; year: number; month: number }>();

        const preference = (dictionary: string): { year: number; month: number } => {
            const lower = dictionary.toLowerCase();
            if (lower.includes('unidic')) {
                const match = dictionary.match(YEAR_MONTH_REGEX);
                const year = match?.groups?.year ? parseInt(match.groups.year) : 2;
                const month = match?.groups?.month ? parseInt(match.groups.month) : 0;
                return { year, month };
            }
            if (lower === 'ipadic-neologd') return { year: 0, month: 0 };
            return { year: 1, month: 0 };
        };

        for (const res of tokenizeRes) {
            const curr = indexDictMap.get(res.index);
            const pref = preference(res.dictionary);
            if (!curr || pref.year > curr.year || (pref.year === curr.year && pref.month > curr.month)) {
                indexDictMap.set(res.index, { res, ...pref });
            }
        }
        const results: TokenizeResult[] = [];
        for (const [index, val] of indexDictMap.entries()) results[index] = val.res;
        return results;
    }

    private cacheFromTokenize(tokenParts: TokenPartResult[]): void {
        const tokenPart = tokenParts[0];
        if (!tokenPart) return;
        const token = tokenParts
            .map((p) => p.text)
            .join('')
            .trim();

        if (!this.lemmatizeCache.has(token)) this.extractLemmaFromMecab(token, tokenPart);

        const headwords = tokenPart.headwords;
        if (headwords) {
            if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, headwords);
            if (!this.frequencyCache.has(token)) this.extractFrequencyFromTokenize(token, headwords);
        }
    }

    private extractLemmaFromMecab(token: string, tokenPart: TokenPartResult): void {
        if (!this.getSupportsMecabLemma()) return;
        const lemmas: string[] = [];
        if (tokenPart.lemma?.length) lemmas.push(tokenPart.lemma);
        if (tokenPart.lemmaReading?.length && !lemmas.includes(tokenPart.lemmaReading)) {
            lemmas.push(tokenPart.lemmaReading);
        }
        if (lemmas.length) this.lemmatizeCache.set(token, lemmas);
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's tokenize API.
     */
    private extractFrequencyFromTokenize(
        token: string,
        tokenizeHeadwords: TermHeadword[][],
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
                    if (!headword.frequencies) continue;
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
    private extractLemmas(token: string, entries: TermHeadword[][]): string[] {
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
        if (!lemmas.length && this.lemmaTokenFallback) lemmas.push(token);
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
        const entries: TermDictionaryEntry[] = (await this._executeAction('termEntries', { term: token }, yomitanUrl))
            .dictionaryEntries;
        return this.extractLemmas(
            token,
            entries.map((entry) => entry.headwords)
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
                    const entries: TermDictionaryEntry[] = (
                        await this._executeAction('termEntries', { term: token }, yomitanUrl)
                    ).dictionaryEntries;
                    this.extractFrequency(token, entries);
                    this.tokensWereModified!(token);
                } finally {
                    this.asyncSemaphore.release(semaphoreId);
                }
            })();
            return;
        }
        const entries: TermDictionaryEntry[] = (await this._executeAction('termEntries', { term: token }, yomitanUrl))
            .dictionaryEntries;
        return this.extractFrequency(token, entries);
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's termEntries API.
     */
    private extractFrequency(
        token: string,
        entries: TermDictionaryEntry[],
        preferTermSource = true
    ): number | undefined {
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
            if (this.dt.dictionaryYomitanParser === 'mecab') {
                await this.verifyMecabSupport(yomitanUrl);
            } else {
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
            }
            // this.supportsTokenizeFrequency = true;
            return version;
        }
        const semver = coerce(version)?.version;
        if (!semver || lt(semver, '25.12.16')) {
            throw new Error(`Minimum Yomitan version is 25.12.16.0, found ${version}`);
        }
        if (this.dt.dictionaryYomitanParser === 'mecab' && gte(semver, '26.3.9')) {
            await this.verifyMecabSupport(yomitanUrl);
        } else {
            this.supportsMecab = false;
            this.supportsMecabLemma = false;
        }
        // if (gte(semver, '26.3.10')) this.supportsTokenizeFrequency = true; // TODO: Use actual version
        // else this.supportsTokenizeFrequency = false;
        return version;
    }

    private async verifyMecabSupport(yomitanUrl?: string) {
        const text = '思い出せなくなった';
        try {
            const tokenizeResults = this.filterDictionaries(
                await this._executeAction(
                    'tokenize',
                    {
                        text,
                        scanLength: this.dt.dictionaryYomitanScanLength,
                        parser: 'mecab',
                    },
                    yomitanUrl
                ),
                'mecab'
            );
            if (tokenizeResults[0].source !== 'mecab') {
                console.warn(
                    `Yomitan did not return MeCab results as expected for '${text}': ${JSON.stringify(tokenizeResults)}`
                );
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
                return;
            }
            const tokenParts = tokenizeResults[0].content[0];
            if (tokenParts.map((p) => p.text).join('') !== '思い出せなく') {
                console.warn(`Yomitan MeCab tokenization unexpected for '${text}': ${JSON.stringify(tokenizeResults)}`);
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
                return;
            }
            this.supportsMecab = true;
            if (tokenParts[0].lemma !== '思い出す' || tokenParts[0].lemmaReading !== 'おもいだす') {
                console.warn(`Yomitan MeCab lemma unexpected for '${text}': ${JSON.stringify(tokenizeResults)}`);
                this.supportsMecabLemma = false;
                return;
            }
            this.supportsMecabLemma = true;
        } catch (e) {
            console.warn(`Yomitan MeCab support check failed for '${text}':`, e);
            this.supportsMecab = false;
            this.supportsMecabLemma = false;
        }
    }

    private async _executeAction(path: string, body: object, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl ?? this.dt.dictionaryYomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
