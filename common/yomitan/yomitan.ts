import { Fetcher, HttpFetcher } from '@project/common';
import { DictionaryTrack } from '@project/common/settings';

export class Yomitan {
    private readonly settingsProvider: DictionaryTrack;
    private readonly fetcher: Fetcher;

    constructor(settingsProvider: DictionaryTrack, fetcher = new HttpFetcher()) {
        this.settingsProvider = settingsProvider;
        this.fetcher = fetcher;
    }

    async tokenize(text: string, yomitanUrl?: string) {
        const response = await this._executeAction(
            'tokenize',
            { text, scanLength: this.settingsProvider.yomitanScanLength },
            yomitanUrl
        );
        const tokens: string[] = [];
        for (const res of response) {
            for (const tokenParts of res['content']) {
                tokens.push(tokenParts.map((p: any) => p['text']).join('')); // [[the], [c, a, r]] -> [the, car]
            }
        }
        return tokens;
    }

    async lemmatize(token: string, yomitanUrl?: string): Promise<string[]> {
        const response = await this._executeAction('termEntries', { term: token }, yomitanUrl);
        const tokens: string[] = [];
        for (const entry of response['dictionaryEntries']) {
            for (const headword of entry['headwords']) {
                for (const source of headword['sources']) {
                    if (source.originalText !== token) continue;
                    if (source.matchType !== 'exact') continue;
                    const lemma = source.deinflectedText;
                    if (lemma === token) continue;
                    if (tokens.includes(lemma)) continue;
                    tokens.push(lemma);
                }
            }
        }
        return tokens;
    }

    async version(yomitanUrl?: string) {
        return this._executeAction('yomitanVersion', {}, yomitanUrl);
    }

    private async _executeAction(path: string, body: object, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl || this.settingsProvider.yomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
