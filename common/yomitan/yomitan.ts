import { Fetcher, HttpFetcher } from '@project/common';
import { isKanaOnly } from '@project/common/util';

export interface TokenPart {
    text: string;
    reading: string;
}

export class Yomitan {
    private readonly fetcher: Fetcher;
    private readonly tokenizeCache: Map<number, Map<string, TokenPart[][]>>;
    private readonly lemmatizeCache: Map<number, Map<string, string[]>>;

    constructor(fetcher = new HttpFetcher()) {
        this.fetcher = fetcher;
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
    }

    resetCache() {
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
    }

    async tokenize(track: number, text: string, scanLength: number, yomitanUrl: string): Promise<TokenPart[][]> {
        let tokens = this.tokenizeCache.get(track)?.get(text);
        if (tokens) return tokens;
        tokens = [];

        for (const res of await this._executeAction('tokenize', { text, scanLength }, yomitanUrl)) {
            for (const tokenParts of res['content']) {
                tokens.push(tokenParts);
            }
        }

        if (!this.tokenizeCache.has(track)) this.tokenizeCache.set(track, new Map());
        this.tokenizeCache.get(track)!.set(text, tokens);
        return tokens;
    }

    /**
     * Lemmatize a token using Yomitan's termEntries API. There will likely always be edge cases but it should perform
     * well nearly all of the time. Returns the first term and reading lemmas (e.g. kanji and kana for Japanese). Examples:
     * 過ぎる   ->  過ぎる, すぎる
     * 過ぎます ->  過ぎる, すぎる
     * すぎる   ->  過ぎる, すぎる
     * すぎます ->  過ぎる, すぎる
     */
    async lemmatize(track: number, token: string, yomitanUrl: string): Promise<string[]> {
        let lemmas = this.lemmatizeCache.get(track)?.get(token);
        if (lemmas) return lemmas;
        lemmas = [];

        let foundLemma = false; // Only add the first valid lemma
        let lookForKanji = isKanaOnly(token); // Use the first valid kanji form if the token is only Hiragana/Katakana
        for (const entry of (await this._executeAction('termEntries', { term: token }, yomitanUrl)).dictionaryEntries) {
            for (const headword of entry.headwords) {
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

        if (!this.lemmatizeCache.has(track)) this.lemmatizeCache.set(track, new Map());
        this.lemmatizeCache.get(track)!.set(token, lemmas);
        return lemmas;
    }

    async version(yomitanUrl: string) {
        return this._executeAction('yomitanVersion', {}, yomitanUrl);
    }

    private async _executeAction(path: string, body: object, yomitanUrl: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
