import { Fetcher, HttpFetcher } from '@project/common';

export class Yomitan {
    private readonly fetcher: Fetcher;
    private readonly settingsProvider = {
        yomitanUrl: 'http://127.0.0.1:19633',
        scanLength: 16,
    };

    constructor(fetcher = new HttpFetcher()) {
        this.fetcher = fetcher;
    }

    async tokenize(text: string, yomitanUrl?: string) {
        const response = await this._executeAction(
            'tokenize',
            { text, scanLength: this.settingsProvider.scanLength },
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

    async deinflectToken(token: string, yomitanUrl?: string): Promise<string[]> {
        const response = await this._executeAction('termEntries', { term: token }, yomitanUrl);
        const tokens: string[] = [];
        for (const entry of response['dictionaryEntries']) {
            for (const headword of entry['headwords']) {
                for (const source of headword['sources']) {
                    if (source.originalText !== token) continue;
                    if (source.matchType !== 'exact') continue;
                    const deToken = source.deinflectedText;
                    if (deToken === token) continue;
                    if (tokens.includes(deToken)) continue;
                    tokens.push(deToken);
                }
            }
        }
        return tokens;
    }

    async version(yomitanUrl?: string) {
        return this._executeAction('version', null, yomitanUrl);
    }

    private async _executeAction(path: string, body: object | null, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl || this.settingsProvider.yomitanUrl}/${path}`, body);
        if (json.error) throw new Error(json.error);
        return json;
    }
}
