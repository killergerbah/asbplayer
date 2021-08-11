const defaultAnkiConnectUrl = "http://127.0.0.1:8765";
const defaultSubtitleSize = 36;
const defaultSubtitleColor = "#ffffff";
const defaultSubtitleOutlineThickness = 0;
const defaultSubtitleOutlineColor = "#000000";
const defaultSubtitleBackgroundColor = "#000000";
const defaultSubtitleBackgroundOpacity = 0.5;
const defaultSubtitleFontFamily = "";
const defaultSubtitlePreview = "アあ安"
const defaultVolume = 100;
const defaultAudioPaddingStart = 0;
const defaultAudioPaddingEnd = 500;
const defaultMaxImageWidth = 0;
const defaultMaxImageHeight = 0;
const defaultSurroundingSubtitlesCountRadius = 1;
const defaultSurroundingSubtitlesTimeRadius = 5000;

const ankiConnectUrlKey = "ankiConnectUrl";
const deckKey = "deck";
const noteTypeKey = "noteType";
const sentenceFieldKey = "sentenceField";
const definitionFieldKey = "definitionField";
const audioFieldKey = "audioField";
const imageFieldKey = "imageField";
const wordFieldKey = "wordField";
const sourceFieldKey = "sourceField";
const customAnkiFieldsKey = "customAnkiFields";
const subtitleSizeKey = "subtitleSize";
const subtitleColorKey = "subtitleColor";
const subtitleOutlineThicknessKey = "subtitleOutlineThickness";
const subtitleOutlineColorKey = "subtitleOutlineColor";
const subtitleBackgroundColorKey = "subtitleBackgroundColor";
const subtitleBackgroundOpacityKey = "subtitleBackgroundOpacity";
const subtitleFontFamilyKey = "subtitleFontFamily";
const subtitlePreviewKey = "subtitlePreview";
const audioPaddingStartKey = "audioPaddingStart";
const audioPaddingEndKey = "audioPaddingEnd";
const maxImageWidthKey = "maxImageWidth";
const maxImageHeightKey = "maxImageHeight";
const volumeKey = "volume";
const preferMp3Key = "preferMp3";
const themeTypeKey = "themeType";

export default class SettingsProvider {

    get settings() {
        return {
            ankiConnectUrl: this.ankiConnectUrl,
            deck: this.deck,
            noteType: this.noteType,
            sentenceField: this.sentenceField,
            definitionField: this.definitionField,
            audioField: this.audioField,
            imageField: this.imageField,
            wordField: this.wordField,
            customAnkiFields: this.customAnkiFields,
            sourceField: this.sourceField,
            subtitleSize: this.subtitleSize,
            subtitleColor: this.subtitleColor,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity : this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
            subtitlePreview: this.subtitlePreview,
            preferMp3: this.preferMp3,
            themeType: this.themeType,
            audioPaddingStart: this.audioPaddingStart,
            audioPaddingEnd: this.audioPaddingEnd,
            maxImageWidth: this.maxImageWidth,
            maxImageHeight: this.maxImageHeight,
            surroundingSubtitlesCountRadius: this.surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius: this.surroundingSubtitlesTimeRadius,
        };
    }

    set settings(newSettings) {
        this.ankiConnectUrl = newSettings.ankiConnectUrl;
        this.deck = newSettings.deck;
        this.noteType = newSettings.noteType;
        this.modelNames = newSettings.modelNames;
        this.sentenceField = newSettings.sentenceField;
        this.definitionField = newSettings.definitionField;
        this.audioField = newSettings.audioField;
        this.imageField = newSettings.imageField;
        this.wordField = newSettings.wordField;
        this.sourceField = newSettings.sourceField;
        this.subtitleSize = newSettings.subtitleSize;
        this.subtitleColor = newSettings.subtitleColor;
        this.subtitleOutlineThickness = newSettings.subtitleOutlineThickness;
        this.subtitleOutlineColor = newSettings.subtitleOutlineColor;
        this.subtitleBackgroundColor = newSettings.subtitleBackgroundColor;
        this.subtitleBackgroundOpacity = newSettings.subtitleBackgroundOpacity;
        this.subtitleFontFamily = newSettings.subtitleFontFamily;
        this.subtitlePreview = newSettings.subtitlePreview;
        this.customAnkiFields = newSettings.customAnkiFields;
        this.preferMp3 = newSettings.preferMp3;
        this.themeType = newSettings.themeType;
        this.audioPaddingStart = newSettings.audioPaddingStart;
        this.audioPaddingEnd = newSettings.audioPaddingEnd;
        this.maxImageWidth = newSettings.maxImageWidth;
        this.maxImageHeight = newSettings.maxImageHeight;
    }

    get subtitleSettings() {
        return {
            subtitleSize: this.subtitleSize,
            subtitleColor: this.subtitleColor,
            subtitleOutlineThickness: this.subtitleOutlineThickness,
            subtitleOutlineColor: this.subtitleOutlineColor,
            subtitleBackgroundColor: this.subtitleBackgroundColor,
            subtitleBackgroundOpacity : this.subtitleBackgroundOpacity,
            subtitleFontFamily: this.subtitleFontFamily,
        };
    }

    get ankiSettings() {
        return {
            ankiConnectUrl: this.ankiConnectUrl,
            deck: this.deck,
            noteType: this.noteType,
            modelNames: this.modelNames,
            sentenceField: this.sentenceField,
            definitionField: this.definitionField,
            audioField: this.audioField,
            imageField: this.imageField,
            wordField: this.wordField,
            sourceField: this.sourceField,
            customAnkiFields: this.customAnkiFields,
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
            themeType: this.themeType
        }
    }

    get ankiConnectUrl() {
        return localStorage.getItem(ankiConnectUrlKey) || defaultAnkiConnectUrl;
    }

    set ankiConnectUrl(url) {
        localStorage.setItem(ankiConnectUrlKey, url);
    }

    get deck() {
        return localStorage.getItem(deckKey);
    }

    set deck(deck) {
        localStorage.setItem(deckKey, deck);
    }

    get noteType() {
        return localStorage.getItem(noteTypeKey);
    }

    set noteType(noteType) {
        localStorage.setItem(noteTypeKey, noteType);
    }

    get sentenceField() {
        return localStorage.getItem(sentenceFieldKey);
    }

    set sentenceField(sentenceField) {
        localStorage.setItem(sentenceFieldKey, sentenceField);
    }

    get definitionField() {
        return localStorage.getItem(definitionFieldKey);
    }

    set definitionField(definitionField) {
        localStorage.setItem(definitionFieldKey, definitionField);
    }

    get audioField() {
        return localStorage.getItem(audioFieldKey);
    }

    set audioField(audioField) {
        localStorage.setItem(audioFieldKey, audioField);
    }

    get imageField() {
        return localStorage.getItem(imageFieldKey);
    }

    set imageField(imageField) {
        localStorage.setItem(imageFieldKey, imageField);
    }

    get wordField() {
        return localStorage.getItem(wordFieldKey);
    }

    set wordField(wordField) {
        localStorage.setItem(wordFieldKey, wordField);
    }

    get sourceField() {
        return localStorage.getItem(sourceFieldKey);
    }

    set sourceField(sourceField) {
        localStorage.setItem(sourceFieldKey, sourceField);
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

    get subtitleColor() {
        return localStorage.getItem(subtitleColorKey) || defaultSubtitleColor;
    }

    set subtitleColor(subtitleColor) {
        localStorage.setItem(subtitleColorKey, subtitleColor);
    }

    get subtitleSize() {
        return localStorage.getItem(subtitleSizeKey) || defaultSubtitleSize;
    }

    set subtitleSize(subtitleSize) {
        localStorage.setItem(subtitleSizeKey, subtitleSize);
    }

    get subtitleOutlineColor() {
        return localStorage.getItem(subtitleOutlineColorKey) || defaultSubtitleOutlineColor;
    }

    set subtitleOutlineColor(subtitleOutlineColor) {
        localStorage.setItem(subtitleOutlineColorKey, subtitleOutlineColor);
    }

    get subtitleOutlineThickness() {
        return localStorage.getItem(subtitleOutlineThicknessKey) || defaultSubtitleOutlineThickness;
    }

    set subtitleOutlineThickness(subtitleOutlineThickness) {
        localStorage.setItem(subtitleOutlineThicknessKey, subtitleOutlineThickness);
    }

    get subtitleBackgroundColor() {
        return localStorage.getItem(subtitleBackgroundColorKey) || defaultSubtitleBackgroundColor;
    }

    set subtitleBackgroundColor(subtitleBackgroundColor) {
        localStorage.setItem(subtitleBackgroundColorKey, subtitleBackgroundColor);
    }

    get subtitleBackgroundOpacity() {
        return localStorage.getItem(subtitleBackgroundOpacityKey) || defaultSubtitleBackgroundOpacity;
    }

    set subtitleBackgroundOpacity(subtitleBackgroundOpacity) {
        localStorage.setItem(subtitleBackgroundOpacityKey, subtitleBackgroundOpacity);
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

    get volume() {
        return localStorage.getItem(volumeKey) || defaultVolume;
    }

    set volume(volume) {
        localStorage.setItem(volumeKey, volume);
    }

    get preferMp3() {
        return localStorage.getItem(preferMp3Key) === 'true' || false;
    }

    set preferMp3(preferMp3) {
        localStorage.setItem(preferMp3Key, preferMp3);
    }

    get themeType() {
        return localStorage.getItem(themeTypeKey) || 'dark';
    }

    set themeType(themeType) {
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
        localStorage.setItem(audioPaddingStartKey, audioPaddingStart);
    }

    get audioPaddingEnd() {
        const value = localStorage.getItem(audioPaddingEndKey);

        if (!value) {
            return defaultAudioPaddingEnd;
        }

        return Number(value);
    }

    set audioPaddingEnd(audioPaddingEnd) {
        localStorage.setItem(audioPaddingEndKey, audioPaddingEnd);
    }

    get maxImageWidth() {
        const value = localStorage.getItem(maxImageWidthKey);

        if (!value) {
            return defaultMaxImageWidth;
        }

        return Number(value);
    }

    set maxImageWidth(maxImageWidth) {
        localStorage.setItem(maxImageWidthKey, maxImageWidth);
    }

    get maxImageHeight() {
        const value = localStorage.getItem(maxImageHeightKey);

        if (!value) {
            return defaultMaxImageHeight;
        }

        return Number(value);
    }

    set maxImageHeight(maxImageHeight) {
        localStorage.setItem(maxImageHeightKey, maxImageHeight);
    }

    get surroundingSubtitlesCountRadius() {
        // For now, not configurable
        return defaultSurroundingSubtitlesCountRadius;
    }

    get surroundingSubtitlesTimeRadius() {
        // For now, not configurable
        return defaultSurroundingSubtitlesTimeRadius;
    }
}