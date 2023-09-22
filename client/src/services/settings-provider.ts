import {
    AsbplayerSettings,
    AsbplayerSettingsProvider,
    AutoPausePreference,
    KeyBindName,
    KeyBindSet,
} from '@project/common';
import { isMacOs } from 'react-device-detect';
import CachedLocalStorage from './cached-local-storage';

const defaultAnkiConnectUrl = 'http://127.0.0.1:8765';
const defaultSubtitleSize = 36;
const defaultSubtitleColor = '#ffffff';
const defaultSubtitleThickness = 700;
const defaultSubtitleOutlineThickness = 1;
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
    resetOffset: { keys: isMacOs ? '⇧+⌃+down' : 'ctrl+shift+down' },
    copySubtitle: { keys: isMacOs ? '⇧+⌃+Z' : 'ctrl+shift+Z' },
    ankiExport: { keys: isMacOs ? '⇧+⌃+X' : 'ctrl+shift+X' },
    updateLastCard: { keys: isMacOs ? '⇧+⌃+U' : 'ctrl+shift+U' },
    takeScreenshot: { keys: isMacOs ? '⇧+⌃+V' : 'ctrl+shift+V' },
    decreasePlaybackRate: { keys: isMacOs ? '⇧+⌃+[' : 'ctrl+shift+[' },
    increasePlaybackRate: { keys: isMacOs ? '⇧+⌃+]' : 'ctrl+shift+]' },
};
const defaultPreferMp3 = true;
const defaultMiningHistoryStorageLimit = 25;
const defaultPreCacheSubtitleDom = true;

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
const subtitleThicknessKey = 'subtitleThickness';
const subtitleOutlineThicknessKey = 'subtitleOutlineThickness';
const subtitleOutlineColorKey = 'subtitleOutlineColor';
const subtitleBackgroundColorKey = 'subtitleBackgroundColor';
const subtitleBackgroundOpacityKey = 'subtitleBackgroundOpacity';
const subtitleFontFamilyKey = 'subtitleFontFamily';
const subtitlePreviewKey = 'subtitlePreview';
const subtitleCustomStylesKey = 'subtitleCustomStyles';
const preCacheSubtitleDomKey = 'preCacheSubtitleDom2';
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
const subtitleRegexFilterKey = 'subtitleRegexFilter';
const subtitleRegexFilterTextReplacementKey = 'subtitleRegexFilterTextReplacement';
const miningHistoryStorageLimitKey = 'miningHistoryStorageLimit';
const languageKey = 'i18nextLng';

export default class SettingsProvider implements AsbplayerSettingsProvider {
    private _tags?: string[];
    private _keyBindSet?: KeyBindSet;
    private _storage = new CachedLocalStorage();

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
            subtitleThickness: this.subtitleThickness,
            subtitleColor: this.subtitleColor,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity: this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
            subtitlePreview: this.subtitlePreview,
            subtitleCustomStyles: this.subtitleCustomStyles,
            preCacheSubtitleDom: this.preCacheSubtitleDom,
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
            subtitleRegexFilter: this.subtitleRegexFilter,
            subtitleRegexFilterTextReplacement: this.subtitleRegexFilterTextReplacement,
            miningHistoryStorageLimit: this.miningHistoryStorageLimit,
            language: this.language,
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
        this.subtitleThickness = newSettings.subtitleThickness;
        this.subtitleColor = newSettings.subtitleColor;
        this.subtitleOutlineThickness = newSettings.subtitleOutlineThickness;
        this.subtitleOutlineColor = newSettings.subtitleOutlineColor;
        this.subtitleBackgroundColor = newSettings.subtitleBackgroundColor;
        this.subtitleBackgroundOpacity = newSettings.subtitleBackgroundOpacity;
        this.subtitleFontFamily = newSettings.subtitleFontFamily;
        this.subtitlePreview = newSettings.subtitlePreview;
        this.subtitleCustomStyles = newSettings.subtitleCustomStyles;
        this.preCacheSubtitleDom = newSettings.preCacheSubtitleDom;
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
        this.miningHistoryStorageLimit = newSettings.miningHistoryStorageLimit;
        this.subtitleRegexFilter = newSettings.subtitleRegexFilter;
        this.subtitleRegexFilterTextReplacement = newSettings.subtitleRegexFilterTextReplacement;
        this.language = newSettings.language;
    }

    get subtitleSettings() {
        return {
            subtitleSize: this.subtitleSize,
            subtitleColor: this.subtitleColor,
            subtitleThickness: this.subtitleThickness,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity: this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
            imageBasedSubtitleScaleFactor: this.imageBasedSubtitleScaleFactor,
            subtitleCustomStyles: this.subtitleCustomStyles,
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
            subtitleRegexFilter: this.subtitleRegexFilter,
            subtitleRegexFilterTextReplacement: this.subtitleRegexFilterTextReplacement,
            miningHistoryStorageLimit: this.miningHistoryStorageLimit,
            language: this.language,
            preCacheSubtitleDom: this.preCacheSubtitleDom,
        };
    }

    _getNumberItem(key: string, defaultValue: number) {
        const value = this._storage.get(key);

        if (value === null) {
            return defaultValue;
        }

        return Number(value);
    }

    _setOptionalItem(key: string, value?: string) {
        if (typeof value === 'undefined') {
            this._storage.delete(key);
        } else {
            this._storage.set(key, value);
        }
    }

    get ankiConnectUrl() {
        return this._storage.get(ankiConnectUrlKey) || defaultAnkiConnectUrl;
    }

    set ankiConnectUrl(url) {
        this._storage.set(ankiConnectUrlKey, url);
    }

    get deck() {
        return this._storage.get(deckKey) ?? undefined;
    }

    set deck(deck) {
        this._setOptionalItem(deckKey, deck);
    }

    get noteType() {
        return this._storage.get(noteTypeKey) ?? undefined;
    }

    set noteType(noteType) {
        this._setOptionalItem(noteTypeKey, noteType);
    }

    get sentenceField() {
        return this._storage.get(sentenceFieldKey) ?? undefined;
    }

    set sentenceField(sentenceField) {
        this._setOptionalItem(sentenceFieldKey, sentenceField);
    }

    get definitionField() {
        return this._storage.get(definitionFieldKey) ?? undefined;
    }

    set definitionField(definitionField) {
        this._setOptionalItem(definitionFieldKey, definitionField);
    }

    get audioField() {
        return this._storage.get(audioFieldKey) ?? undefined;
    }

    set audioField(audioField) {
        this._setOptionalItem(audioFieldKey, audioField);
    }

    get imageField() {
        return this._storage.get(imageFieldKey) ?? undefined;
    }

    set imageField(imageField) {
        this._setOptionalItem(imageFieldKey, imageField);
    }

    get wordField() {
        return this._storage.get(wordFieldKey) ?? undefined;
    }

    set wordField(wordField) {
        this._setOptionalItem(wordFieldKey, wordField);
    }

    get sourceField() {
        return this._storage.get(sourceFieldKey) ?? undefined;
    }

    set sourceField(sourceField) {
        this._setOptionalItem(sourceFieldKey, sourceField);
    }

    get urlField() {
        return this._storage.get(urlFieldKey) ?? undefined;
    }

    set urlField(urlField) {
        this._setOptionalItem(urlFieldKey, urlField);
    }

    get customAnkiFields() {
        const ankiFieldsString = this._storage.get(customAnkiFieldsKey);

        if (ankiFieldsString) {
            return JSON.parse(ankiFieldsString);
        }

        return {};
    }

    set customAnkiFields(customAnkiFields) {
        this._storage.set(customAnkiFieldsKey, JSON.stringify(customAnkiFields));
    }

    get tags() {
        if (typeof this._tags !== 'undefined') {
            return this._tags;
        }

        const tagsString = this._storage.get(tagsKey);

        if (tagsString) {
            this._tags = JSON.parse(tagsString) as string[];
            return this._tags;
        }

        return [];
    }

    set tags(tags) {
        this._storage.set(tagsKey, JSON.stringify(tags));
        this._tags = undefined;
    }

    get subtitleColor() {
        return this._storage.get(subtitleColorKey) || defaultSubtitleColor;
    }

    set subtitleColor(subtitleColor) {
        this._storage.set(subtitleColorKey, subtitleColor);
    }

    get subtitleSize() {
        return this._getNumberItem(subtitleSizeKey, defaultSubtitleSize);
    }

    set subtitleSize(subtitleSize) {
        this._storage.set(subtitleSizeKey, String(subtitleSize));
    }

    get subtitleThickness() {
        return this._getNumberItem(subtitleThicknessKey, defaultSubtitleThickness);
    }

    set subtitleThickness(subtitleThickness) {
        this._storage.set(subtitleThicknessKey, String(subtitleThickness));
    }

    get subtitleOutlineColor() {
        return this._storage.get(subtitleOutlineColorKey) || defaultSubtitleOutlineColor;
    }

    set subtitleOutlineColor(subtitleOutlineColor) {
        this._storage.set(subtitleOutlineColorKey, subtitleOutlineColor);
    }

    get subtitleOutlineThickness() {
        return this._getNumberItem(subtitleOutlineThicknessKey, defaultSubtitleOutlineThickness);
    }

    set subtitleOutlineThickness(subtitleOutlineThickness) {
        this._storage.set(subtitleOutlineThicknessKey, String(subtitleOutlineThickness));
    }

    get subtitleBackgroundColor() {
        return this._storage.get(subtitleBackgroundColorKey) || defaultSubtitleBackgroundColor;
    }

    set subtitleBackgroundColor(subtitleBackgroundColor) {
        this._storage.set(subtitleBackgroundColorKey, subtitleBackgroundColor);
    }

    get subtitleBackgroundOpacity() {
        return this._getNumberItem(subtitleBackgroundOpacityKey, defaultSubtitleBackgroundOpacity);
    }

    set subtitleBackgroundOpacity(subtitleBackgroundOpacity) {
        this._storage.set(subtitleBackgroundOpacityKey, String(subtitleBackgroundOpacity));
    }

    get subtitleFontFamily() {
        return this._storage.get(subtitleFontFamilyKey) || defaultSubtitleFontFamily;
    }

    set subtitleFontFamily(subtitleFontFamily) {
        this._storage.set(subtitleFontFamilyKey, subtitleFontFamily);
    }

    get subtitlePreview() {
        return this._storage.get(subtitlePreviewKey) || defaultSubtitlePreview;
    }

    set subtitlePreview(subtitlePreview) {
        this._storage.set(subtitlePreviewKey, subtitlePreview);
    }

    get subtitleCustomStyles() {
        const stylesString = this._storage.get(subtitleCustomStylesKey);

        if (stylesString === null) {
            return [];
        }

        return JSON.parse(stylesString);
    }

    set subtitleCustomStyles(value) {
        this._storage.set(subtitleCustomStylesKey, JSON.stringify(value));
    }

    get preCacheSubtitleDom(): boolean {
        return this._storage.get(preCacheSubtitleDomKey) === 'true' || defaultPreCacheSubtitleDom;
    }

    set preCacheSubtitleDom(preCacheSubtitleDom: boolean) {
        this._storage.set(preCacheSubtitleDomKey, String(preCacheSubtitleDom));
    }

    get imageBasedSubtitleScaleFactor() {
        return this._getNumberItem(imageBasedSubtitleScaleFactorKey, 1);
    }

    set imageBasedSubtitleScaleFactor(imageBasedSubtitleScaleFactor: number) {
        this._storage.set(imageBasedSubtitleScaleFactorKey, String(imageBasedSubtitleScaleFactor));
    }

    get preferMp3(): boolean {
        const value = this._storage.get(preferMp3Key);

        if (value !== null) {
            if (value === 'true') {
                return true;
            }

            return false;
        }

        return defaultPreferMp3;
    }

    set preferMp3(preferMp3) {
        this._storage.set(preferMp3Key, String(preferMp3));
    }

    get themeType() {
        const themeType = this._storage.get(themeTypeKey) as 'dark' | 'light' | null;

        if (themeType === null) {
            return 'dark';
        }

        return themeType;
    }

    set themeType(themeType: 'dark' | 'light') {
        this._storage.set(themeTypeKey, themeType);
    }

    get audioPaddingStart() {
        const value = this._storage.get(audioPaddingStartKey);

        if (!value) {
            return defaultAudioPaddingStart;
        }

        return Number(value);
    }

    set audioPaddingStart(audioPaddingStart) {
        this._storage.set(audioPaddingStartKey, String(audioPaddingStart));
    }

    get audioPaddingEnd() {
        return this._getNumberItem(audioPaddingEndKey, defaultAudioPaddingEnd);
    }

    set audioPaddingEnd(audioPaddingEnd) {
        this._storage.set(audioPaddingEndKey, String(audioPaddingEnd));
    }

    get maxImageWidth() {
        const value = this._storage.get(maxImageWidthKey);

        if (!value) {
            return defaultMaxImageWidth;
        }

        return Number(value);
    }

    set maxImageWidth(maxImageWidth) {
        this._storage.set(maxImageWidthKey, String(maxImageWidth));
    }

    get maxImageHeight() {
        return this._getNumberItem(maxImageHeightKey, defaultMaxImageHeight);
    }

    set maxImageHeight(maxImageHeight) {
        this._storage.set(maxImageHeightKey, String(maxImageHeight));
    }

    get surroundingSubtitlesCountRadius() {
        return this._getNumberItem(surroundingSubtitlesCountRadiusKey, defaultSurroundingSubtitlesCountRadius);
    }

    set surroundingSubtitlesCountRadius(surroundingSubtitlesCountRadius) {
        this._storage.set(surroundingSubtitlesCountRadiusKey, String(surroundingSubtitlesCountRadius));
    }

    get surroundingSubtitlesTimeRadius() {
        return this._getNumberItem(surroundingSubtitlesTimeRadiusKey, defaultSurroundingSubtitlesTimeRadius);
    }

    set surroundingSubtitlesTimeRadius(surroundingSubtitlesTimeRadius) {
        this._storage.set(surroundingSubtitlesTimeRadiusKey, String(surroundingSubtitlesTimeRadius));
    }

    get copyToClipboardOnMine() {
        return this._storage.get(copyToClipboardOnMineKey) === 'true' || false;
    }

    set copyToClipboardOnMine(copyToClipboardOnMine) {
        this._storage.set(copyToClipboardOnMineKey, String(copyToClipboardOnMine));
    }

    get autoPausePreference() {
        return this._getNumberItem(autoPausePreferenceKey, defaultAutoPausePreference);
    }

    set autoPausePreference(autoPausePreference) {
        this._storage.set(autoPausePreferenceKey, String(autoPausePreference));
    }

    get keyBindSet() {
        if (this._keyBindSet !== undefined) {
            return this._keyBindSet;
        }

        let serialized = this._storage.get(keyBindSetKey);

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
        this._storage.set(keyBindSetKey, JSON.stringify(keyBindSet));
        this._keyBindSet = undefined;
    }

    get rememberSubtitleOffset() {
        return this._storage.get(rememberSubtitleOffsetKey) === 'true' || false;
    }

    set rememberSubtitleOffset(rememberSubtitleOffset) {
        this._storage.set(rememberSubtitleOffsetKey, String(rememberSubtitleOffset));
    }

    get autoCopyCurrentSubtitle() {
        return this._storage.get(autoCopyCurrentSubtitleKey) === 'true' || false;
    }

    set autoCopyCurrentSubtitle(autoCopyCurrentSubtitle) {
        this._storage.set(autoCopyCurrentSubtitleKey, String(autoCopyCurrentSubtitle));
    }

    get subtitleRegexFilter() {
        return this._storage.get(subtitleRegexFilterKey) ?? '';
    }

    set subtitleRegexFilter(subtitleRegexFilter: string) {
        this._storage.set(subtitleRegexFilterKey, subtitleRegexFilter);
    }

    get subtitleRegexFilterTextReplacement() {
        return this._storage.get(subtitleRegexFilterTextReplacementKey) ?? '';
    }

    set subtitleRegexFilterTextReplacement(subtitleRegexFilterTextReplacement: string) {
        this._storage.set(subtitleRegexFilterTextReplacementKey, subtitleRegexFilterTextReplacement);
    }

    get miningHistoryStorageLimit() {
        return this._getNumberItem(miningHistoryStorageLimitKey, defaultMiningHistoryStorageLimit);
    }

    set miningHistoryStorageLimit(miningHistoryStorageLimit: number) {
        this._storage.set(miningHistoryStorageLimitKey, String(miningHistoryStorageLimit));
    }

    get language() {
        return this._storage.get(languageKey) ?? 'en';
    }

    set language(language: string) {
        this._storage.set(languageKey, language);
    }
}
