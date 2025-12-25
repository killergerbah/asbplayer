import { Fetcher, HttpFetcher } from '@project/common';
import { isKanaOnly } from '@project/common/util';
import gt from 'semver/functions/gt';
import { DictionaryTrack } from '../settings';

export interface TokenPart {
    text: string;
    reading: string;
}

export class Yomitan {
    private readonly dt: DictionaryTrack;
    private readonly fetcher: Fetcher;
    private _supportsConcurrentTokenization: boolean;
    private readonly tokenizeCache: Map<string, TokenPart[][]>;
    private readonly lemmatizeCache: Map<string, string[]>;

    constructor(dictionaryTrack: DictionaryTrack, fetcher = new HttpFetcher()) {
        this.dt = dictionaryTrack;
        this.fetcher = fetcher;
        this._supportsConcurrentTokenization = false;
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
    }

    get supportsConcurrentTokenization() {
        return this._supportsConcurrentTokenization;
    }

    resetCache() {
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
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
                if (tokenParts[0]?.headwords) {
                    const token = tokenParts
                        .map((p: any) => p.text)
                        .join('')
                        .trim();
                    if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, tokenParts[0].headwords);
                }
            }
        }
        this.tokenizeCache.set(text, tokens);
        return tokens;
    }

    async cacheTokenizations(texts: string[], yomitanUrl?: string): Promise<void> {
        const tokensToFetch = [];
        for (const text of texts) {
            if (!this.tokenizeCache.has(text)) tokensToFetch.push(text);
        }
        if (!tokensToFetch.length) return;
        const response = await this._executeAction(
            'tokenize',
            { text: tokensToFetch, scanLength: this.dt.dictionaryYomitanScanLength },
            yomitanUrl
        );
        for (const res of response) {
            const tokens: TokenPart[][] = [];
            for (const tokenParts of res.content) {
                tokens.push(tokenParts);
                if (tokenParts[0]?.headwords) {
                    const token = tokenParts
                        .map((p: any) => p.text)
                        .join('')
                        .trim();
                    if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, tokenParts[0].headwords);
                }
            }
            this.tokenizeCache.set(tokensToFetch[res.index], tokens);
        }
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
        const entries = (await this._executeAction('termEntries', { term: token }, yomitanUrl)).dictionaryEntries;
        return this.extractLemmas(
            token,
            entries.map((entry: any) => entry.headwords)
        );
    }

    async version(yomitanUrl?: string) {
        const version = (await this._executeAction('yomitanVersion', {}, yomitanUrl)).version;
        // if (version === '0.0.0.0' || gt(version, '25.11.11.0')) this._supportsConcurrentTokenization = true;
        return version;
    }

    private async _executeAction(path: string, body: object, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl ?? this.dt.dictionaryYomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
