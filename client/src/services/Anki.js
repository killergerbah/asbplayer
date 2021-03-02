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

    async modelFieldNames(ankiConnectUrl, modelName) {
        const response = await this._executeAction(ankiConnectUrl, 'modelFieldNames', {modelName: modelName});
        return response.result;
    }

    async export(ankiConnectUrl, text, definition, audioOptions) {
        const {audioBlob, audioFileName, audioFileExtension, audioBase64: providedAudioBase64} = audioOptions;
        let audioBase64;

        if (providedAudioBase64) {
            audioBase64 = providedAudioBase64;
        } else {
            audioBase64 = audioBlob ? await this._blobToBase64(audioBlob) : null;
        }

        const fields = {};
        fields[this.settingsProvider.sentenceField] = text;
        fields[this.settingsProvider.definitionField] = definition;

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

        if (audioBase64 && audioFileName) {
            params.note.audio = {
                filename: audioFileName + "_" + Date.now() + "." + audioFileExtension,
                data: audioBase64,
                fields: [
                    this.settingsProvider.audioField
                ]
            };
        }

        await this._executeAction(ankiConnectUrl, 'addNote', params);
    }

    async _executeAction(ankiConnectUrl, action, params) {
        const body = {
            action: action,
            version: 6
        };

        if (params) {
            body.params = params;
        }

        const response = await fetch(ankiConnectUrl, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const json = await response.json();

        if (json.error) {
            throw new Error(json.error);
        }

        return json;
    }

    async _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result;
                const base64 = result.substr(result.indexOf(',') + 1);
                resolve(base64);
            }
        });
    }
}