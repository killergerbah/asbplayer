import { AudioClip } from '@project/common/audio-clip';
import { Image } from '@project/common';
import { HttpFetcher, Fetcher } from '@project/common';
import { AnkiSettings } from '@project/common';
import sanitize from 'sanitize-filename';
import { AudioModel, ImageModel, SubtitleModel } from '@project/common';
import { extractText } from '@project/common';

const ankiQuerySpecialCharacters = ['"', '*', '_', '\\', ':'];

export type AnkiExportMode = 'gui' | 'updateLast' | 'default';

export async function updateLastCard(
    ankiSettings: AnkiSettings,
    subtitle: SubtitleModel,
    surroundingSubtitles: SubtitleModel[],
    audioModel: AudioModel | undefined,
    imageModel: ImageModel | undefined,
    sourceString: string,
    url: string | undefined
) {
    const anki = new Anki(ankiSettings);
    let audioClip =
        audioModel === undefined
            ? undefined
            : AudioClip.fromBase64(
                  sourceString,
                  subtitle.start,
                  subtitle.end,
                  audioModel.playbackRate ?? 1,
                  audioModel.base64,
                  audioModel.extension
              );

    return await anki.export(
        extractText(subtitle, surroundingSubtitles),
        undefined,
        audioClip,
        imageModel === undefined
            ? undefined
            : Image.fromBase64(sourceString, subtitle.start, imageModel.base64, imageModel.extension),
        undefined,
        sourceString,
        url,
        {},
        ankiSettings.tags,
        'updateLast'
    );
}

export class Anki {
    private readonly settingsProvider: AnkiSettings;
    private readonly fetcher: Fetcher;

    constructor(settingsProvider: AnkiSettings, fetcher = new HttpFetcher()) {
        this.settingsProvider = settingsProvider;
        this.fetcher = fetcher;
    }

    async deckNames(ankiConnectUrl?: string) {
        const response = await this._executeAction('deckNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelNames(ankiConnectUrl?: string) {
        const response = await this._executeAction('modelNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelFieldNames(modelName: string, ankiConnectUrl?: string) {
        const response = await this._executeAction('modelFieldNames', { modelName: modelName }, ankiConnectUrl);
        return response.result;
    }

    async findNotesWithWord(word: string, ankiConnectUrl?: string) {
        const response = await this._executeAction(
            'findNotes',
            { query: this.settingsProvider.wordField + ':' + this._escapeQuery(word) },
            ankiConnectUrl
        );
        return response.result;
    }

    async findNotesWithWordGui(word: string, ankiConnectUrl?: string) {
        const response = await this._executeAction(
            'guiBrowse',
            { query: this.settingsProvider.wordField + ':' + this._escapeQuery(word) },
            ankiConnectUrl
        );
        return response.result;
    }

    private _escapeQuery(query: string) {
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

    async requestPermission(ankiConnectUrl?: string) {
        const response = await this._executeAction('requestPermission', null, ankiConnectUrl);
        return response.result;
    }

    async export(
        text: string | undefined,
        definition: string | undefined,
        audioClip: AudioClip | undefined,
        image: Image | undefined,
        word: string | undefined,
        source: string | undefined,
        url: string | undefined,
        customFieldValues: { [key: string]: string },
        tags: string[],
        mode: AnkiExportMode,
        ankiConnectUrl?: string
    ) {
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
                    true
                );
            }
        }

        const params: any = {
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
        const updateLast = mode === 'updateLast';

        if (this.settingsProvider.audioField && audioClip && audioClip.isPlayable()) {
            const sanitizedName = this._sanitizeFileName(audioClip.name);

            if (gui || updateLast) {
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

        if (this.settingsProvider.imageField && image && image.available) {
            const sanitizedName = this._sanitizeFileName(image.name);

            if (gui || updateLast) {
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
                const infoResponse = await this._executeAction('notesInfo', { notes: [lastNoteId] });

                if (infoResponse.result.length > 0 && infoResponse.result[0].noteId === lastNoteId) {
                    const info = infoResponse.result[0];

                    if (
                        this.settingsProvider.sentenceField &&
                        info.fields &&
                        typeof info.fields[this.settingsProvider.sentenceField]?.value === 'string' &&
                        typeof params.note.fields[this.settingsProvider.sentenceField] === 'string'
                    ) {
                        params.note.fields[this.settingsProvider.sentenceField] = this._inheritHtmlMarkup(
                            params.note.fields[this.settingsProvider.sentenceField],
                            info.fields[this.settingsProvider.sentenceField].value
                        );
                    }

                    await this._executeAction('updateNoteFields', params, ankiConnectUrl);

                    if (tags.length > 0) {
                        await this._executeAction(
                            'addTags',
                            { notes: [lastNoteId], tags: tags.join(' ') },
                            ankiConnectUrl
                        );
                    }

                    if (!this.settingsProvider.wordField || !info.fields) {
                        return info.noteId;
                    }

                    const wordField = info.fields[this.settingsProvider.wordField];

                    if (!wordField || !wordField.value) {
                        return info.noteId;
                    }

                    return wordField.value;
                }

                throw new Error('Could not update last card because the card info could not be fetched');
            case 'default':
                return (await this._executeAction('addNote', params, ankiConnectUrl)).result;
            default:
                throw new Error('Unknown export mode: ' + mode);
        }
    }

    private _appendField(fields: any, fieldName: string | undefined, value: string | undefined, multiline: boolean) {
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

    private _sanitizeFileName(name: string) {
        return sanitize(name, { replacement: '_' });
    }

    private _inheritHtmlMarkup(original: string, markedUp: string) {
        const htmlTagRegex = RegExp('<[^>]*>(.*?)</[^>]*>', 'ig');
        const markedUpWithoutBreaklines = markedUp.replace('<br>', '');
        let inherited = original;

        while (true) {
            const match = htmlTagRegex.exec(markedUpWithoutBreaklines);

            if (match === null || match.length < 2) {
                break;
            }

            inherited = inherited.replace(match[1], match[0]);
        }

        return inherited;
    }

    private async _storeMediaFile(name: string, base64: string, ankiConnectUrl?: string) {
        return this._executeAction('storeMediaFile', { filename: name, data: base64 }, ankiConnectUrl);
    }

    private async _executeAction(action: string, params: any, ankiConnectUrl?: string) {
        const body: any = {
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
