import { AudioClip } from '@project/common/audio-clip';
import { AnkiExportMode, CardModel, Image } from '@project/common';
import { HttpFetcher, Fetcher } from '@project/common';
import { AnkiSettings, AnkiSettingsFieldKey } from '@project/common/settings';
import sanitize from 'sanitize-filename';
import { extractText, sourceString } from '@project/common/util';

const ankiQuerySpecialCharacters = ['"', '*', '_', '\\', ':'];
const alphaNumericCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const unsafeURLChars = /[:\/\?#\[\]@!$&'()*+,;= "<>%{}|\\^`]/g;
const replacement = '_';

const randomString = () => {
    let string = '';

    for (let i = 0; i < 8; ++i) {
        string += alphaNumericCharacters.charAt(Math.floor(Math.random() * alphaNumericCharacters.length));
    }

    return string;
};

// Makes a file name unique with reasonable probability by appending a string of random characters.
// Leaves more room for the original file name than Anki's appended hash when `storeMediaFile`
// is called with `deleteExisting` == true.
// Also, AnkiConnect Android doesn't support `deleteExisting` anyway.
const makeUniqueFileName = (fileName: string) => {
    const match = /(.*)\.(.*)/.exec(fileName);

    if (match === null || match.length < 3) {
        // Give up (not likely since we expect fileName to have an extension)
        return fileName;
    }

    const baseName = match[1];
    const exension = match[2];
    return `${baseName}_${randomString()}.${exension}`;
};

const htmlTagRegexString = '<([^/ >])*[^>]*>(.*?)</\\1>';

// Given <a><b>content</b></a> return ['<a><b>content</b></a>', '<b>content</b>', 'content']
const tagContent = (html: string) => {
    const htmlTagRegex = new RegExp(htmlTagRegexString);
    let content = html;
    let contents = [html];

    while (true) {
        const match = htmlTagRegex.exec(content);

        if (match === null || match.length < 3) {
            break;
        }

        content = match[2];
        contents.push(content);
    }

    return contents;
};

export const inheritHtmlMarkup = (original: string, markedUp: string) => {
    const htmlTagRegex = new RegExp(htmlTagRegexString, 'ig');
    const markedUpWithoutBreaklines = markedUp.replaceAll('<br>', '');
    let inherited = original;

    while (true) {
        const match = htmlTagRegex.exec(markedUpWithoutBreaklines);

        if (match === null || match.length < 3) {
            break;
        }

        let newInherited = inherited;

        if (!inherited.includes(match[0])) {
            const candidateTargets = tagContent(match[2]);

            for (const target of candidateTargets) {
                newInherited = inherited.replace(target, match[0]);

                if (newInherited !== inherited) {
                    break;
                }
            }
        }

        inherited = newInherited;
    }

    return inherited;
};

export interface ExportParams {
    text: string | undefined;
    track1: string | undefined;
    track2: string | undefined;
    track3: string | undefined;
    definition: string | undefined;
    audioClip: AudioClip | undefined;
    image: Image | undefined;
    word: string | undefined;
    source: string | undefined;
    url: string | undefined;
    customFieldValues: { [key: string]: string };
    tags: string[];
    mode: AnkiExportMode;
    ankiConnectUrl?: string;
}

export async function exportCard(
    card: CardModel,
    ankiSettings: AnkiSettings,
    exportMode: AnkiExportMode = 'default'
): Promise<string> {
    const anki = new Anki(ankiSettings);
    const source = sourceString(card.subtitleFileName, card.mediaTimestamp);
    let audioClip =
        card.audio === undefined
            ? undefined
            : AudioClip.fromBase64(
                  source,
                  card.subtitle.start,
                  card.subtitle.end,
                  card.audio.playbackRate ?? 1,
                  card.audio.base64,
                  card.audio.extension,
                  card.audio.error
              );

    return await anki.export({
        text: card.text ?? extractText(card.subtitle, card.surroundingSubtitles),
        track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
        track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
        track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
        definition: card.definition,
        audioClip,
        image:
            card.image === undefined
                ? undefined
                : Image.fromBase64(
                      source,
                      card.subtitle.start,
                      card.image.base64,
                      card.image.extension,
                      card.image.error
                  ),
        word: card.word,
        source: source,
        url: card.url,
        customFieldValues: card.customFieldValues ?? {},
        tags: ankiSettings.tags,
        mode: exportMode,
    });
}

export interface CreateModelParams {
    modelName: string;
    inOrderFields: string[];
    css: string;
    cardTemplates: { Front: string; Back: string }[];
}

export class DuplicateNoteError extends Error {
    constructor(message: string = 'duplicate') {
        super(message);
        this.name = 'DuplicateNoteError';
    }
}

export class Anki {
    private readonly settingsProvider: AnkiSettings;
    private readonly fetcher: Fetcher;
    private readonly wordCardCache: Map<number, Map<string, number[]>>;
    private readonly sentenceCardCache: Map<number, Map<string, number[]>>;
    private readonly cardInfoCache: Map<number, any>;

    constructor(settingsProvider: AnkiSettings, fetcher = new HttpFetcher()) {
        this.settingsProvider = settingsProvider;
        this.fetcher = fetcher;
        this.wordCardCache = new Map();
        this.sentenceCardCache = new Map();
        this.cardInfoCache = new Map();
    }

    get ankiConnectUrl() {
        return this.settingsProvider.ankiConnectUrl;
    }

    resetCache() {
        this.wordCardCache.clear();
        this.sentenceCardCache.clear();
        this.cardInfoCache.clear();
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

    async findCardsWithWord(track: number, word: string, fields: string[], ankiConnectUrl?: string): Promise<number[]> {
        if (!fields.length) return [];
        let cardIds = this.wordCardCache.get(track)?.get(word);
        if (cardIds) return cardIds;

        const response = await this._executeAction(
            'findCards',
            { query: fields.map((field) => `"${field}:${this._escapeQuery(word)}"`).join(' OR ') },
            ankiConnectUrl
        );
        cardIds = response.result as number[];
        if (!this.wordCardCache.has(track)) this.wordCardCache.set(track, new Map());
        this.wordCardCache.get(track)!.set(word, cardIds);
        return cardIds;
    }

    async findCardsContainingWord(
        track: number,
        word: string,
        fields: string[],
        ankiConnectUrl?: string
    ): Promise<number[]> {
        if (!fields.length) return [];
        let cardIds = this.sentenceCardCache.get(track)?.get(word);
        if (cardIds) return cardIds;

        const response = await this._executeAction(
            'findCards',
            { query: fields.map((field) => `"${field}:*${this._escapeQuery(word)}*"`).join(' OR ') },
            ankiConnectUrl
        );
        cardIds = response.result as number[];
        if (!this.sentenceCardCache.has(track)) this.sentenceCardCache.set(track, new Map());
        this.sentenceCardCache.get(track)!.set(word, cardIds);
        return cardIds;
    }

    async findNotesWithWord(word: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction(
            'findNotes',
            { query: `"${this.settingsProvider.wordField}:${this._escapeQuery(word)}"` },
            ankiConnectUrl
        );
        return response.result;
    }

    async findNotesWithWordGui(word: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction(
            'guiBrowse',
            { query: `"${this.settingsProvider.wordField}:${this._escapeQuery(word)}"` },
            ankiConnectUrl
        );
        return response.result;
    }

    async findRecentlyEditedCards(fields: string[], sinceDays: number, ankiConnectUrl?: string): Promise<number[]> {
        if (!fields.length) return [];
        if (sinceDays < 1) sinceDays = 1;
        const response = await this._executeAction(
            'findCards',
            { query: `edited:${sinceDays} (${fields.map((field) => `"${field}:_*"`).join(' OR ')})` },
            ankiConnectUrl
        );
        return response.result;
    }

    async cardsInfo(cardIds: number[], ankiConnectUrl?: string): Promise<any[]> {
        const cardInfos = [];
        const cardIdsToFetch = [];
        for (const cardId of cardIds) {
            const cachedInfo = this.cardInfoCache.get(cardId);
            if (cachedInfo) cardInfos.push(cachedInfo);
            else cardIdsToFetch.push(cardId);
        }
        if (!cardIdsToFetch.length) return cardInfos;

        const response = await this._executeAction('cardsInfo', { cards: cardIdsToFetch }, ankiConnectUrl);
        response.result.forEach((cardInfo: any) => {
            this.cardInfoCache.set(cardInfo.cardId, cardInfo);
            cardInfos.push(cardInfo);
        });
        return cardInfos;
    }

    async findCards(query: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction('findCards', { query: query }, ankiConnectUrl);
        return response.result;
    }

    async createDeck(name: string, ankiConnectUrl?: string) {
        const response = await this._executeAction('createDeck', { deck: name }, ankiConnectUrl);
        return response.result;
    }

    async createModel(params: CreateModelParams, ankiConnectUrl?: string) {
        const response = await this._executeAction('createModel', params, ankiConnectUrl);
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

        return `${escaped}`;
    }

    async requestPermission(ankiConnectUrl?: string) {
        const response = await this._executeAction('requestPermission', null, ankiConnectUrl);
        return response.result;
    }

    async version(ankiConnectUrl?: string) {
        const response = await this._executeAction('version', null, ankiConnectUrl);
        return response.result;
    }

    async export({
        text,
        track1,
        track2,
        track3,
        definition,
        audioClip,
        image,
        word,
        source,
        url,
        customFieldValues,
        tags,
        mode,
        ankiConnectUrl,
    }: ExportParams) {
        const fields = {};

        this._appendField(fields, this.settingsProvider.sentenceField, text, true);
        this._appendField(fields, this.settingsProvider.track1Field, track1, true);
        this._appendField(fields, this.settingsProvider.track2Field, track2, true);
        this._appendField(fields, this.settingsProvider.track3Field, track3, true);
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
                    allowDuplicate: true,
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

        if (this.settingsProvider.audioField && audioClip && audioClip.error === undefined) {
            const sanitizedName = this._sanitizeFileName(audioClip.name);
            const data = await audioClip.base64();

            if (data) {
                if (gui || updateLast) {
                    const fileName = (await this._storeMediaFile(sanitizedName, data, ankiConnectUrl)).result;
                    this._appendField(fields, this.settingsProvider.audioField, `[sound:${fileName}]`, false);
                } else {
                    params.note['audio'] = {
                        filename: sanitizedName,
                        data,
                        fields: [this.settingsProvider.audioField],
                    };
                }
            }
        }

        if (this.settingsProvider.imageField && image && image.error === undefined) {
            const sanitizedName = this._sanitizeFileName(image.name);
            const data = await image.base64();

            if (data) {
                if (gui || updateLast) {
                    const fileName = (await this._storeMediaFile(sanitizedName, data, ankiConnectUrl)).result;
                    this._appendField(fields, this.settingsProvider.imageField, `<img src="${fileName}">`, false);
                } else {
                    params.note['picture'] = {
                        filename: sanitizedName,
                        data,
                        fields: [this.settingsProvider.imageField],
                    };
                }
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

                    this._inheritHtmlMarkupFromField('sentenceField', info, params);
                    this._inheritHtmlMarkupFromField('track1Field', info, params);
                    this._inheritHtmlMarkupFromField('track2Field', info, params);
                    this._inheritHtmlMarkupFromField('track3Field', info, params);

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

    private _sanitizeUnsafeURLChars(name: string) {
        return name.replace(unsafeURLChars, replacement);
    }

    private _sanitizeFileName(name: string) {
        if (typeof name.toWellFormed === 'function') {
            name = name.toWellFormed();
        }

        // Sanitize unsafe URL characters for AnkiWeb compatibility.
        name = this._sanitizeUnsafeURLChars(name);
        // Sanitize for file system compatibility on various operating systems.
        return sanitize(name, { replacement: replacement });
    }

    private async _storeMediaFile(name: string, base64: string, ankiConnectUrl?: string) {
        return this._executeAction(
            'storeMediaFile',
            { filename: makeUniqueFileName(name), data: base64, deleteExisting: false },
            ankiConnectUrl
        );
    }

    private _inheritHtmlMarkupFromField(fieldKey: AnkiSettingsFieldKey, info: any, params: any) {
        const fieldName = this.settingsProvider[fieldKey];

        if (
            fieldName &&
            info.fields &&
            typeof info.fields[fieldName]?.value === 'string' &&
            typeof params.note.fields[fieldName] === 'string'
        ) {
            params.note.fields[fieldName] = inheritHtmlMarkup(
                params.note.fields[fieldName],
                info.fields[fieldName].value
            );
        }
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
            if (json.error.includes('duplicate')) {
                throw new DuplicateNoteError(json.error);
            }
            throw new Error(json.error);
        }

        return json;
    }
}
