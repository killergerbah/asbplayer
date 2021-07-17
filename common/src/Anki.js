import HttpFetcher from './HttpFetcher';

const specialCharacters = ['"', '*', '_', '\\', ':'];

export default class Anki {

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
        const response = await this._executeAction('modelFieldNames', {modelName: modelName}, ankiConnectUrl);
        return response.result;
    }

    async findNotesWithWord(word, ankiConnectUrl) {
        const response = await this._executeAction(
            'findNotes',
            {query: this.settingsProvider.wordField + ":" + this._escapeQuery(word)},
            ankiConnectUrl
        );
        return response.result;
    }

    async findNotesWithWordGui(word, ankiConnectUrl) {
        const response = await this._executeAction(
            'guiBrowse',
            {query: this.settingsProvider.wordField + ":" + this._escapeQuery(word)},
            ankiConnectUrl
        );
        return response.result;
    }

    _escapeQuery(query) {
        let escaped = "";

        for (let i = 0; i < query.length; ++i) {
            const char = query[i];
            if (specialCharacters.includes(char)) {
                escaped += `\\${char}`;
            } else {
                escaped += char;
            }
        }

        return `"${escaped}"`
    }

    async requestPermission(ankiConnectUrl) {
        const response = await this._executeAction('requestPermission', null, ankiConnectUrl);
        return response.result;
    }

    async export(text, definition, audioClip, image, word, source, customFieldValues, mode, ankiConnectUrl) {
        const fields = {};

        this._appendField(fields, this.settingsProvider.sentenceField, text, true);
        this._appendField(fields, this.settingsProvider.definitionField, definition, true);
        this._appendField(fields, this.settingsProvider.wordField, word, false);
        this._appendField(fields, this.settingsProvider.sourceField, source, false);

        if (customFieldValues) {
            for (const customFieldName of Object.keys(customFieldValues)) {
                this._appendField(fields, this.settingsProvider.customAnkiFields[customFieldName], customFieldValues[customFieldName], false);
            }
        }

        const params = {
            note: {
                deckName: this.settingsProvider.deck,
                modelName: this.settingsProvider.noteType,
                options: {
                    allowDuplicate: false,
                    duplicateScope: 'deck',
                    duplicateScopeOptions: {
                        deckName: this.settingsProvider.deck,
                        checkChildren: false
                    }
                }
            }
        };

        const gui = mode === 'gui';

        if (this.settingsProvider.audioField && audioClip) {
            if (gui) {
                const fileName = (await this._storeMediaFile(audioClip.name, await audioClip.base64(), ankiConnectUrl)).result;
                this._appendField(fields, this.settingsProvider.audioField, `[sound:${fileName}]`, false)
            } else {
                params.note.audio = {
                    filename: audioClip.name,
                    data: await audioClip.base64(),
                    fields: [
                        this.settingsProvider.audioField
                    ]
                };
            }
        }

        if (this.settingsProvider.imageField && image) {
            if (gui) {
                const fileName = (await this._storeMediaFile(image.name, await image.base64(), ankiConnectUrl)).result;
                this._appendField(fields, this.settingsProvider.imageField, `<div><img src="${fileName}"></div>`, false);
            } else {
                params.note.picture = {
                    filename: image.name,
                    data: await image.base64(),
                    fields: [
                        this.settingsProvider.imageField
                    ]
                }
            }
        }

        params.note.fields = fields;

        switch (mode) {
            case 'gui':
                return (await this._executeAction('guiAddCards', params, ankiConnectUrl)).result;
            case 'updateLast':
                const recentNotes = (await this._executeAction(
                    'findNotes',
                    {query: 'added:1'},
                    ankiConnectUrl
                )).result.sort();

                if (recentNotes.length === 0) {
                    throw new Error('Could not find note to update');
                }

                const lastNoteId = recentNotes[recentNotes.length - 1];
                params.note.id = lastNoteId;
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

        let newValue =  multiline ? value.split("\n").join("<br>") : value;
        const existingValue = fields[fieldName];

        if (existingValue) {
            newValue = existingValue + "<br>" + newValue;
        }

        fields[fieldName] = newValue;
    }

    async _storeMediaFile(name, base64, ankiConnectUrl) {
        return this._executeAction('storeMediaFile', {filename: name, data: base64}, ankiConnectUrl);
    }

    async _executeAction(action, params, ankiConnectUrl) {
        const body = {
            action: action,
            version: 6
        };

        if (params) {
            body.params = params;
        }

        const json = await this.fetcher.fetch(ankiConnectUrl || this.settingsProvider.ankiConnectUrl, body);

        if (json.error) {
            throw new Error(json.error);
        }

        return json;
    }
}