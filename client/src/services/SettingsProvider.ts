import {
    AsbplayerSettings,
    AsbplayerSettingsProvider,
    AutoPausePreference,
    KeyBindName,
    KeyBindSet,
} from '@project/common';
import { isMacOs } from 'react-device-detect';

const defaultAnkiConnectUrl = 'http://127.0.0.1:8765';
const defaultSubtitleSize = 36;
const defaultSubtitleColor = '#ffffff';
const defaultSubtitleOutlineThickness = 0;
const defaultSubtitleOutlineColor = '#000000';
const defaultSubtitleBackgroundColor = '#000000';
const defaultSubtitleBackgroundOpacity = 0.5;
const defaultSubtitleFontFamily = '';
const defaultSubtitlePreview = 'アあ安';
const defaultAudioPaddingStart = 0;
const defaultAudioPaddingEnd = 500;
const defaultMaxImageWidth = 0;
const defaultMaxImageHeight = 0;
const defaultSurroundingSubtitlesCountRadius = 2;
const defaultSurroundingSubtitlesTimeRadius = 10000;
const defaultAutoPausePreference = AutoPausePreference.atEnd;
const defaultKeyBindSet: KeyBindSet = {
    togglePlay: { keys: 'space' },
    toggleAutoPause: { keys: isMacOs ? '⇧+P' : 'shift+P' },
    toggleCondensedPlayback: { keys: isMacOs ? '⇧+O' : 'shift+O' },
    toggleSubtitles: { keys: 'S' },
    toggleVideoSubtitleTrack1: { keys: '1' },
    toggleVideoSubtitleTrack2: { keys: '2' },
    toggleAsbplayerSubtitleTrack1: { keys: 'W+1' },
    toggleAsbplayerSubtitleTrack2: { keys: 'W+2' },
    seekBackward: { keys: 'A' },
    seekForward: { keys: 'D' },
    seekToPreviousSubtitle: { keys: 'left' },
    seekToNextSubtitle: { keys: 'right' },
    seekToBeginningOfCurrentSubtitle: { keys: 'down' },
    adjustOffsetToPreviousSubtitle: { keys: isMacOs ? '⇧+left' : 'ctrl+left' },
    adjustOffsetToNextSubtitle: { keys: isMacOs ? '⇧+right' : 'ctrl+right' },
    decreaseOffset: { keys: isMacOs ? '⇧+⌃+right' : 'ctrl+shift+right' },
    increaseOffset: { keys: isMacOs ? '⇧+⌃+left' : 'ctrl+shift+left' },
    copySubtitle: { keys: isMacOs ? '⇧+⌃+Z' : 'ctrl+shift+Z' },
    ankiExport: { keys: isMacOs ? '⇧+⌃+X' : 'ctrl+shift+X' },
    updateLastCard: { keys: isMacOs ? '⇧+⌃+U' : 'ctrl+shift+U' },
    decreasePlaybackRate: { keys: isMacOs ? '⇧+⌃+[' : 'ctrl+shift+[' },
    increasePlaybackRate: { keys: isMacOs ? '⇧+⌃+]' : 'ctrl+shift+]' },
};
const defaultPreferMp3 = true;

const ankiConnectUrlKey = 'ankiConnectUrl';
const deckKey = 'deck';
const noteTypeKey = 'noteType';
const sentenceFieldKey = 'sentenceField';
const definitionFieldKey = 'definitionField';
const audioFieldKey = 'audioField';
const imageFieldKey = 'imageField';
const wordFieldKey = 'wordField';
const sourceFieldKey = 'sourceField';
const urlFieldKey = 'urlField';
const customAnkiFieldsKey = 'customAnkiFields';
const tagsKey = 'tags';
const subtitleSizeKey = 'subtitleSize';
const subtitleColorKey = 'subtitleColor';
const subtitleOutlineThicknessKey = 'subtitleOutlineThickness';
const subtitleOutlineColorKey = 'subtitleOutlineColor';
const subtitleBackgroundColorKey = 'subtitleBackgroundColor';
const subtitleBackgroundOpacityKey = 'subtitleBackgroundOpacity';
const subtitleFontFamilyKey = 'subtitleFontFamily';
const subtitlePreviewKey = 'subtitlePreview';
const imageBasedSubtitleScaleFactorKey = 'imageBasedSubtitleScaleFactor';
const audioPaddingStartKey = 'audioPaddingStart';
const audioPaddingEndKey = 'audioPaddingEnd';
const maxImageWidthKey = 'maxImageWidth';
const maxImageHeightKey = 'maxImageHeight';
const surroundingSubtitlesCountRadiusKey = 'surroundingSubtitlesCountRadius';
const surroundingSubtitlesTimeRadiusKey = 'surroundingSubtitlesTimeRadius';
const preferMp3Key = 'preferMp3';
const themeTypeKey = 'themeType';
const copyToClipboardOnMineKey = 'copyToClipboardOnMine';
const autoPausePreferenceKey = 'autoPausePreference';
const keyBindSetKey = 'keyBindSet';
const rememberSubtitleOffsetKey = 'rememberSubtitleOffset';
const autoCopyCurrentSubtitleKey = 'autoCopyCurrentSubtitle';

export default class SettingsProvider implements AsbplayerSettingsProvider {
    private _tags?: string[];
    private _keyBindSet?: KeyBindSet;

    constructor() {
        // Cache for use in useEffect dependencies
        this._tags = this.tags;
        this._keyBindSet = this.keyBindSet;
    }

    get settings(): AsbplayerSettings {
        return {
            ankiConnectUrl: this.ankiConnectUrl,
            deck: this.deck,
            noteType: this.noteType,
            sentenceField: this.sentenceField,
            definitionField: this.definitionField,
            audioField: this.audioField,
            imageField: this.imageField,
            wordField: this.wordField,
            urlField: this.urlField,
            customAnkiFields: this.customAnkiFields,
            tags: this.tags,
            sourceField: this.sourceField,
            subtitleSize: this.subtitleSize,
            subtitleColor: this.subtitleColor,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity: this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
            subtitlePreview: this.subtitlePreview,
            imageBasedSubtitleScaleFactor: this.imageBasedSubtitleScaleFactor,
            preferMp3: this.preferMp3,
            themeType: this.themeType,
            audioPaddingStart: this.audioPaddingStart,
            audioPaddingEnd: this.audioPaddingEnd,
            maxImageWidth: this.maxImageWidth,
            maxImageHeight: this.maxImageHeight,
            surroundingSubtitlesCountRadius: this.surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius: this.surroundingSubtitlesTimeRadius,
            copyToClipboardOnMine: this.copyToClipboardOnMine,
            autoPausePreference: this.autoPausePreference,
            keyBindSet: this.keyBindSet,
            rememberSubtitleOffset: this.rememberSubtitleOffset,
            autoCopyCurrentSubtitle: this.autoCopyCurrentSubtitle,
        };
    }

    set settings(newSettings: AsbplayerSettings) {
        this.ankiConnectUrl = newSettings.ankiConnectUrl;
        this.deck = newSettings.deck;
        this.noteType = newSettings.noteType;
        this.sentenceField = newSettings.sentenceField;
        this.definitionField = newSettings.definitionField;
        this.audioField = newSettings.audioField;
        this.imageField = newSettings.imageField;
        this.wordField = newSettings.wordField;
        this.sourceField = newSettings.sourceField;
        this.urlField = newSettings.urlField;
        this.tags = newSettings.tags;
        this.subtitleSize = newSettings.subtitleSize;
        this.subtitleColor = newSettings.subtitleColor;
        this.subtitleOutlineThickness = newSettings.subtitleOutlineThickness;
        this.subtitleOutlineColor = newSettings.subtitleOutlineColor;
        this.subtitleBackgroundColor = newSettings.subtitleBackgroundColor;
        this.subtitleBackgroundOpacity = newSettings.subtitleBackgroundOpacity;
        this.subtitleFontFamily = newSettings.subtitleFontFamily;
        this.subtitlePreview = newSettings.subtitlePreview;
        this.imageBasedSubtitleScaleFactor = newSettings.imageBasedSubtitleScaleFactor;
        this.customAnkiFields = newSettings.customAnkiFields;
        this.preferMp3 = newSettings.preferMp3;
        this.themeType = newSettings.themeType;
        this.audioPaddingStart = newSettings.audioPaddingStart;
        this.audioPaddingEnd = newSettings.audioPaddingEnd;
        this.maxImageWidth = newSettings.maxImageWidth;
        this.maxImageHeight = newSettings.maxImageHeight;
        this.surroundingSubtitlesCountRadius = newSettings.surroundingSubtitlesCountRadius;
        this.surroundingSubtitlesTimeRadius = newSettings.surroundingSubtitlesTimeRadius;
        this.copyToClipboardOnMine = newSettings.copyToClipboardOnMine;
        this.autoPausePreference = newSettings.autoPausePreference;
        this.keyBindSet = newSettings.keyBindSet;
        this.rememberSubtitleOffset = newSettings.rememberSubtitleOffset;
        this.autoCopyCurrentSubtitle = newSettings.autoCopyCurrentSubtitle;
    }

    get subtitleSettings() {
        return {
            subtitleSize: this.subtitleSize,
            subtitleColor: this.subtitleColor,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity: this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
            imageBasedSubtitleScaleFactor: this.imageBasedSubtitleScaleFactor,
        };
    }

    get ankiSettings() {
        return {
            ankiConnectUrl: this.ankiConnectUrl,
            deck: this.deck,
            noteType: this.noteType,
            sentenceField: this.sentenceField,
            definitionField: this.definitionField,
            audioField: this.audioField,
            imageField: this.imageField,
            wordField: this.wordField,
            sourceField: this.sourceField,
            urlField: this.urlField,
            customAnkiFields: this.customAnkiFields,
            tags: this.tags,
            preferMp3: this.preferMp3,
            audioPaddingStart: this.audioPaddingStart,
            audioPaddingEnd: this.audioPaddingEnd,
            maxImageWidth: this.maxImageWidth,
            maxImageHeight: this.maxImageHeight,
            surroundingSubtitlesCountRadius: this.surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius: this.surroundingSubtitlesTimeRadius,
        };
    }

    get miscSettings() {
        return {
            themeType: this.themeType,
            copyToClipboardOnMine: this.copyToClipboardOnMine,
            autoPausePreference: this.autoPausePreference,
            keyBindSet: this.keyBindSet,
            rememberSubtitleOffset: this.rememberSubtitleOffset,
            autoCopyCurrentSubtitle: this.autoCopyCurrentSubtitle,
        };
    }

    _getNumberItem(key: string, defaultValue: number) {
        const value = localStorage.getItem(key);

        if (value === null) {
            return defaultValue;
        }

        return Number(value);
    }

    _setOptionalItem(key: string, value?: string) {
        if (typeof value === 'undefined') {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    }

    get ankiConnectUrl() {
        return localStorage.getItem(ankiConnectUrlKey) || defaultAnkiConnectUrl;
    }

    set ankiConnectUrl(url) {
        localStorage.setItem(ankiConnectUrlKey, url);
    }

    get deck() {
        return localStorage.getItem(deckKey) ?? undefined;
    }

    set deck(deck) {
        this._setOptionalItem(deckKey, deck);
    }

    get noteType() {
        return localStorage.getItem(noteTypeKey) ?? undefined;
    }

    set noteType(noteType) {
        this._setOptionalItem(noteTypeKey, noteType);
    }

    get sentenceField() {
        return localStorage.getItem(sentenceFieldKey) ?? undefined;
    }

    set sentenceField(sentenceField) {
        this._setOptionalItem(sentenceFieldKey, sentenceField);
    }

    get definitionField() {
        return localStorage.getItem(definitionFieldKey) ?? undefined;
    }

    set definitionField(definitionField) {
        this._setOptionalItem(definitionFieldKey, definitionField);
    }

    get audioField() {
        return localStorage.getItem(audioFieldKey) ?? undefined;
    }

    set audioField(audioField) {
        this._setOptionalItem(audioFieldKey, audioField);
    }

    get imageField() {
        return localStorage.getItem(imageFieldKey) ?? undefined;
    }

    set imageField(imageField) {
        this._setOptionalItem(imageFieldKey, imageField);
    }

    get wordField() {
        return localStorage.getItem(wordFieldKey) ?? undefined;
    }

    set wordField(wordField) {
        this._setOptionalItem(wordFieldKey, wordField);
    }

    get sourceField() {
        return localStorage.getItem(sourceFieldKey) ?? undefined;
    }

    set sourceField(sourceField) {
        this._setOptionalItem(sourceFieldKey, sourceField);
    }

    get urlField() {
        return localStorage.getItem(urlFieldKey) ?? undefined;
    }

    set urlField(urlField) {
        this._setOptionalItem(urlFieldKey, urlField);
    }

    get customAnkiFields() {
        const ankiFieldsString = localStorage.getItem(customAnkiFieldsKey);

        if (ankiFieldsString) {
            return JSON.parse(ankiFieldsString);
        }

        return {};
    }

    set customAnkiFields(customAnkiFields) {
        localStorage.setItem(customAnkiFieldsKey, JSON.stringify(customAnkiFields));
    }

    get tags() {
        if (typeof this._tags !== 'undefined') {
            return this._tags;
        }

        const tagsString = localStorage.getItem(tagsKey);

        if (tagsString) {
            this._tags = JSON.parse(tagsString) as string[];
            return this._tags;
        }

        return [];
    }

    set tags(tags) {
        localStorage.setItem(tagsKey, JSON.stringify(tags));
        this._tags = undefined;
    }

    get subtitleColor() {
        return localStorage.getItem(subtitleColorKey) || defaultSubtitleColor;
    }

    set subtitleColor(subtitleColor) {
        localStorage.setItem(subtitleColorKey, subtitleColor);
    }

    get subtitleSize() {
        return this._getNumberItem(subtitleSizeKey, defaultSubtitleSize);
    }

    set subtitleSize(subtitleSize) {
        localStorage.setItem(subtitleSizeKey, String(subtitleSize));
    }

    get subtitleOutlineColor() {
        return localStorage.getItem(subtitleOutlineColorKey) || defaultSubtitleOutlineColor;
    }

    set subtitleOutlineColor(subtitleOutlineColor) {
        localStorage.setItem(subtitleOutlineColorKey, subtitleOutlineColor);
    }

    get subtitleOutlineThickness() {
        return this._getNumberItem(subtitleOutlineThicknessKey, defaultSubtitleOutlineThickness);
    }

    set subtitleOutlineThickness(subtitleOutlineThickness) {
        localStorage.setItem(subtitleOutlineThicknessKey, String(subtitleOutlineThickness));
    }

    get subtitleBackgroundColor() {
        return localStorage.getItem(subtitleBackgroundColorKey) || defaultSubtitleBackgroundColor;
    }

    set subtitleBackgroundColor(subtitleBackgroundColor) {
        localStorage.setItem(subtitleBackgroundColorKey, subtitleBackgroundColor);
    }

    get subtitleBackgroundOpacity() {
        return this._getNumberItem(subtitleBackgroundOpacityKey, defaultSubtitleBackgroundOpacity);
    }

    set subtitleBackgroundOpacity(subtitleBackgroundOpacity) {
        localStorage.setItem(subtitleBackgroundOpacityKey, String(subtitleBackgroundOpacity));
    }

    get subtitleFontFamily() {
        return localStorage.getItem(subtitleFontFamilyKey) || defaultSubtitleFontFamily;
    }

    set subtitleFontFamily(subtitleFontFamily) {
        localStorage.setItem(subtitleFontFamilyKey, subtitleFontFamily);
    }

    get subtitlePreview() {
        return localStorage.getItem(subtitlePreviewKey) || defaultSubtitlePreview;
    }

    set subtitlePreview(subtitlePreview) {
        localStorage.setItem(subtitlePreviewKey, subtitlePreview);
    }

    get imageBasedSubtitleScaleFactor() {
        return this._getNumberItem(imageBasedSubtitleScaleFactorKey, 1);
    }

    set imageBasedSubtitleScaleFactor(imageBasedSubtitleScaleFactor: number) {
        localStorage.setItem(imageBasedSubtitleScaleFactorKey, String(imageBasedSubtitleScaleFactor));
    }

    get preferMp3(): boolean {
        const value = localStorage.getItem(preferMp3Key);

        if (value !== null) {
            if (value === 'true') {
                return true;
            }

            return false;
        }


        return defaultPreferMp3;
    }

    set preferMp3(preferMp3) {
        localStorage.setItem(preferMp3Key, String(preferMp3));
    }

    get themeType() {
        const themeType = localStorage.getItem(themeTypeKey) as 'dark' | 'light' | null;

        if (themeType === null) {
            return 'dark';
        }

        return themeType;
    }

    set themeType(themeType: 'dark' | 'light') {
        localStorage.setItem(themeTypeKey, themeType);
    }

    get audioPaddingStart() {
        const value = localStorage.getItem(audioPaddingStartKey);

        if (!value) {
            return defaultAudioPaddingStart;
        }

        return Number(value);
    }

    set audioPaddingStart(audioPaddingStart) {
        localStorage.setItem(audioPaddingStartKey, String(audioPaddingStart));
    }

    get audioPaddingEnd() {
        return this._getNumberItem(audioPaddingEndKey, defaultAudioPaddingEnd);
    }

    set audioPaddingEnd(audioPaddingEnd) {
        localStorage.setItem(audioPaddingEndKey, String(audioPaddingEnd));
    }

    get maxImageWidth() {
        const value = localStorage.getItem(maxImageWidthKey);

        if (!value) {
            return defaultMaxImageWidth;
        }

        return Number(value);
    }

    set maxImageWidth(maxImageWidth) {
        localStorage.setItem(maxImageWidthKey, String(maxImageWidth));
    }

    get maxImageHeight() {
        return this._getNumberItem(maxImageHeightKey, defaultMaxImageHeight);
    }

    set maxImageHeight(maxImageHeight) {
        localStorage.setItem(maxImageHeightKey, String(maxImageHeight));
    }

    get surroundingSubtitlesCountRadius() {
        return this._getNumberItem(surroundingSubtitlesCountRadiusKey, defaultSurroundingSubtitlesCountRadius);
    }

    set surroundingSubtitlesCountRadius(surroundingSubtitlesCountRadius) {
        localStorage.setItem(surroundingSubtitlesCountRadiusKey, String(surroundingSubtitlesCountRadius));
    }

    get surroundingSubtitlesTimeRadius() {
        return this._getNumberItem(surroundingSubtitlesTimeRadiusKey, defaultSurroundingSubtitlesTimeRadius);
    }

    set surroundingSubtitlesTimeRadius(surroundingSubtitlesTimeRadius) {
        localStorage.setItem(surroundingSubtitlesTimeRadiusKey, String(surroundingSubtitlesTimeRadius));
    }

    get copyToClipboardOnMine() {
        return localStorage.getItem(copyToClipboardOnMineKey) === 'true' || false;
    }

    set copyToClipboardOnMine(copyToClipboardOnMine) {
        localStorage.setItem(copyToClipboardOnMineKey, String(copyToClipboardOnMine));
    }

    get autoPausePreference() {
        return this._getNumberItem(autoPausePreferenceKey, defaultAutoPausePreference);
    }

    set autoPausePreference(autoPausePreference) {
        localStorage.setItem(autoPausePreferenceKey, String(autoPausePreference));
    }

    get keyBindSet() {
        if (this._keyBindSet !== undefined) {
            return this._keyBindSet;
        }

        let serialized = localStorage.getItem(keyBindSetKey);

        if (serialized === null) {
            this._keyBindSet = defaultKeyBindSet;
            return defaultKeyBindSet;
        }

        const keyBindSet = JSON.parse(serialized);

        for (const key of Object.keys(defaultKeyBindSet)) {
            const keyBindName = key as KeyBindName;

            if (keyBindSet[keyBindName] === undefined) {
                keyBindSet[keyBindName] = defaultKeyBindSet[keyBindName];
            }
        }

        this._keyBindSet = keyBindSet;
        return keyBindSet as KeyBindSet;
    }

    set keyBindSet(keyBindSet) {
        localStorage.setItem(keyBindSetKey, JSON.stringify(keyBindSet));
        this._keyBindSet = undefined;
    }

    get rememberSubtitleOffset() {
        return localStorage.getItem(rememberSubtitleOffsetKey) === 'true' || false;
    }

    set rememberSubtitleOffset(rememberSubtitleOffset) {
        localStorage.setItem(rememberSubtitleOffsetKey, String(rememberSubtitleOffset));
    }

    get autoCopyCurrentSubtitle() {
        return localStorage.getItem(autoCopyCurrentSubtitleKey) === 'true' || false;
    }

    set autoCopyCurrentSubtitle(autoCopyCurrentSubtitle) {
        localStorage.setItem(autoCopyCurrentSubtitleKey, String(autoCopyCurrentSubtitle));
    }
}
