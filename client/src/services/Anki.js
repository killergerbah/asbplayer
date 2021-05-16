const specialCharacters = ['"', '*', '_', '\\', ':'];

export default class Anki {

    constructor(settingsProvider) {
        this.settingsProvider = settingsProvider;
    }

    async deckNames(ankiConnectUrl) {
        const response = await this._executeAction(ankiConnectUrl, 'deckNames');
        return response.result;
    }

    async modelNames(ankiConnectUrl) {
        const response = await this._executeAction(ankiConnectUrl, 'modelNames');
        return response.result;
    }

    async modelFieldNames(modelName, ankiConnectUrl) {
        const response = await this._executeAction(ankiConnectUrl, 'modelFieldNames', {modelName: modelName});
        return response.result;
    }

    async findNotesWithWord(word, ankiConnectUrl) {
        const response = await this._executeAction(
            ankiConnectUrl,
            'findNotes',
            {query: this.settingsProvider.wordField + ":" + this._escapeQuery(word)}
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

    async export(text, definition, audioClip, image, word, source, customFieldValues, ankiConnectUrl) {
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
                fields: fields,
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

        if (this.settingsProvider.audioField && audioClip) {
            params.note.audio = {
                filename: audioClip.name,
                data: await audioClip.base64(),
                fields: [
                    this.settingsProvider.audioField
                ]
            };
        }

        if (this.settingsProvider.imageField && image) {
            params.note.picture = {
                filename: image.name,
                data: await image.base64(),
                fields: [
                    this.settingsProvider.imageField
                ]
            }
        }

        const response = await this._executeAction(ankiConnectUrl, 'addNote', params);
        return response.result;
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

    async _executeAction(ankiConnectUrl, action, params) {
        const body = {
            action: action,
            version: 6
        };

        if (params) {
            body.params = params;
        }

        const response = await fetch(ankiConnectUrl || this.settingsProvider.ankiConnectUrl, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const json = await response.json();

        if (json.error) {
            throw new Error(json.error);
        }

        return json;
    }
}