import { Fetcher, HttpFetcher } from '@project/common';
import { isKanaOnly } from '@project/common/util';

export class Yomitan {
    private readonly fetcher: Fetcher;

    constructor(fetcher = new HttpFetcher()) {
        this.fetcher = fetcher;
    }

    async tokenize(text: string, scanLength: number, yomitanUrl: string) {
        const response = await this._executeAction('tokenize', { text, scanLength }, yomitanUrl);
        const tokens: string[] = [];
        for (const res of response) {
            for (const tokenParts of res['content']) {
                tokens.push(tokenParts.map((p: any) => p['text']).join('')); // [[the], [c, a, r]] -> [the, car]
            }
        }
        return tokens;
    }

    /**
     * Lemmatize a token using Yomitan's termEntries API. There will likely always be edge cases but it should perform
     * well nearly all of the time. Returns the first term and reading lemmas (e.g. kanji and kana for Japanese) if different
     * from the input. Examples:
     * 過ぎる   ->  すぎる
     * 過ぎます ->  過ぎる, すぎる
     * すぎる   ->  過ぎる
     * すぎます ->  すぎる, 過ぎる
     */
    async lemmatize(token: string, yomitanUrl: string): Promise<string[]> {
        const response = await this._executeAction('termEntries', { term: token }, yomitanUrl); // These are roughly sorted by best match, we can't do much better
        const lemmas: string[] = [];
        let foundLemma = false; // Only add the first valid lemma
        let lookForKanji = isKanaOnly(token); // Use the first valid kanji form if the token is only Hiragana/Katakana
        for (const entry of response.dictionaryEntries) {
            for (const headword of entry.headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    const lemma = source.deinflectedText; // This is the term or reading form, whatever the input is
                    if (lookForKanji && lemma !== headword.term && lemma === headword.reading) {
                        lookForKanji = false;
                        if (headword.term !== token && !lemmas.includes(headword.term)) lemmas.unshift(headword.term); // e.g. すぎます -> 過ぎる
                    }
                    if (foundLemma) continue;
                    foundLemma = true;
                    if (lemma !== token && !lemmas.includes(lemma)) lemmas.push(lemma);
                    if (headword.term !== token && !lemmas.includes(headword.term)) lemmas.unshift(headword.term);
                    if (headword.reading !== token && !lemmas.includes(headword.reading)) lemmas.push(headword.reading);
                }
            }
        }
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
