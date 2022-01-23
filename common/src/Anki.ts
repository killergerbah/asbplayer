import HttpFetcher from './HttpFetcher';

const ankiQuerySpecialCharacters = ['"', '*', '_', '\\', ':'];
const fileNameSpecialCharacters = [':', '/', '\\', '<', '>', '"', '|', '?', '*', '^'];

export default class Anki {
    private readonly settingsProvider: any;
    private readonly fetcher: any;

    constructor(settingsProvider, fetcher = new HttpFetcher()) {
        this.settingsProvider = settingsProvider;
        this.fetcher = fetcher;
    }

    async deckNames(ankiConnectUrl) {
        const response = await this._executeAction('deckNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelNames(ankiConnectUrl) {
        const response = await this._executeAction('modelNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelFieldNames(modelName, ankiConnectUrl) {
        const response = await this._executeAction('modelFieldNames', { modelName: modelName }, ankiConnectUrl);
        return response.result;
    }

    async findNotesWithWord(word, ankiConnectUrl) {
        const response = await this._executeAction(
            'findNotes',
            { query: this.settingsProvider.wordField + ':' + this._escapeQuery(word) },
            ankiConnectUrl
        );
        return response.result;
    }

    async findNotesWithWordGui(word, ankiConnectUrl) {
        const response = await this._executeAction(
            'guiBrowse',
            { query: this.settingsProvider.wordField + ':' + this._escapeQuery(word) },
            ankiConnectUrl
        );
        return response.result;
    }

    _escapeQuery(query) {
        let escaped = '';

        for (let i = 0; i < query.length; ++i) {
            const char = query[i];
            if (ankiQuerySpecialCharacters.includes(char)) {
                escaped += `\\${char}`;
            } else {
                escaped += char;
            }
        }

        return `"${escaped}"`;
    }

    async requestPermission(ankiConnectUrl) {
        const response = await this._executeAction('requestPermission', null, ankiConnectUrl);
        return response.result;
    }

    async export(text, definition, audioClip, image, word, source, url, customFieldValues, tags, mode, ankiConnectUrl) {
        const fields = {};

        this._appendField(fields, this.settingsProvider.sentenceField, text, true);
        this._appendField(fields, this.settingsProvider.definitionField, definition, true);
        this._appendField(fields, this.settingsProvider.wordField, word, false);
        this._appendField(fields, this.settingsProvider.sourceField, source, false);
        this._appendField(fields, this.settingsProvider.urlField, url, false);

        if (customFieldValues) {
            for (const customFieldName of Object.keys(customFieldValues)) {
                this._appendField(
                    fields,
                    this.settingsProvider.customAnkiFields[customFieldName],
                    customFieldValues[customFieldName],
                    false
                );
            }
        }

        const params = {
            note: {
                deckName: this.settingsProvider.deck,
                modelName: this.settingsProvider.noteType,
                tags: tags,
                options: {
                    allowDuplicate: false,
                    duplicateScope: 'deck',
                    duplicateScopeOptions: {
                        deckName: this.settingsProvider.deck,
                        checkChildren: false,
                    },
                },
            },
        };

        const gui = mode === 'gui';

        if (this.settingsProvider.audioField && audioClip) {
            const sanitizedName = this._sanitizeFileName(audioClip.name);

            if (gui) {
                const fileName = (await this._storeMediaFile(sanitizedName, await audioClip.base64(), ankiConnectUrl))
                    .result;
                this._appendField(fields, this.settingsProvider.audioField, `[sound:${fileName}]`, false);
            } else {
                params.note['audio'] = {
                    filename: sanitizedName,
                    data: await audioClip.base64(),
                    fields: [this.settingsProvider.audioField],
                };
            }
        }

        if (this.settingsProvider.imageField && image) {
            const sanitizedName = this._sanitizeFileName(image.name);

            if (gui) {
                const fileName = (await this._storeMediaFile(sanitizedName, await image.base64(), ankiConnectUrl))
                    .result;
                this._appendField(
                    fields,
                    this.settingsProvider.imageField,
                    `<div><img src="${fileName}"></div>`,
                    false
                );
            } else {
                params.note['picture'] = {
                    filename: sanitizedName,
                    data: await image.base64(),
                    fields: [this.settingsProvider.imageField],
                };
            }
        }

        params.note['fields'] = fields;

        switch (mode) {
            case 'gui':
                return (await this._executeAction('guiAddCards', params, ankiConnectUrl)).result;
            case 'updateLast':
                const recentNotes = (
                    await this._executeAction('findNotes', { query: 'added:1' }, ankiConnectUrl)
                ).result.sort();

                if (recentNotes.length === 0) {
                    throw new Error('Could not find note to update');
                }

                const lastNoteId = recentNotes[recentNotes.length - 1];
                params.note['id'] = lastNoteId;
                await this._executeAction('updateNoteFields', params, ankiConnectUrl);
                return lastNoteId;
            case 'default':
                return (await this._executeAction('addNote', params, ankiConnectUrl)).result;
            default:
                throw new Error('Unknown export mode: ' + mode);
        }
    }

    _appendField(fields, fieldName, value, multiline) {
        if (!fieldName || !value) {
            return;
        }

        let newValue = multiline ? value.split('\n').join('<br>') : value;
        const existingValue = fields[fieldName];

        if (existingValue) {
            newValue = existingValue + '<br>' + newValue;
        }

        fields[fieldName] = newValue;
    }

    _sanitizeFileName(name) {
        let sanitized = '';

        for (let i = 0; i < name.length; ++i) {
            const char = name[i];

            if (fileNameSpecialCharacters.includes(char)) {
                sanitized += '_';
            } else {
                sanitized += char;
            }
        }

        return sanitized;
    }

    async _storeMediaFile(name, base64, ankiConnectUrl) {
        return this._executeAction('storeMediaFile', { filename: name, data: base64 }, ankiConnectUrl);
    }

    async _executeAction(action, params, ankiConnectUrl) {
        const body = {
            action: action,
            version: 6,
        };

        if (params) {
            body['params'] = params;
        }

        const json = await this.fetcher.fetch(ankiConnectUrl || this.settingsProvider.ankiConnectUrl, body);

        if (json.error) {
            throw new Error(json.error);
        }

        return json;
    }
}
