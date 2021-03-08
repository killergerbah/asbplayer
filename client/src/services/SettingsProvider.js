const defaultAnkiConnectUrl = "http://127.0.0.1:8765";
const defaultSubtitleSize = 36;
const defaultSubtitleColor = "#ffffff";
const defaultSubtitleOutlineThickness = 0;
const defaultSubtitleOutlineColor = "#000000";
const defaultSubtitleBackgroundColor = "#000000";
const defaultSubtitleBackgroundOpacity = 0.5

const ankiConnectUrlKey = "ankiConnectUrl";
const deckKey = "deck";
const noteTypeKey = "noteType";
const sentenceFieldKey = "sentenceField";
const definitionFieldKey = "definitionField";
const audioFieldKey = "audioField";
const subtitleSizeKey = "subtitleSize";
const subtitleColorKey = "subtitleColor";
const subtitleOutlineThicknessKey = "subtitleOutlineThickness";
const subtitleOutlineColorKey = "subtitleOutlineColor";
const subtitleBackgroundColorKey = "subtitleBackgroundColor";
const subtitleBackgroundOpacityKey = "subtitleBackgroundOpacity";

export default class SettingsProvider {

    get settings() {
        return {
            ankiConnectUrl: localStorage.getItem(ankiConnectUrlKey) || defaultAnkiConnectUrl,
            deck: localStorage.getItem(deckKey),
            noteType: localStorage.getItem(noteTypeKey),
            sentenceField: localStorage.getItem(sentenceFieldKey),
            definitionField: localStorage.getItem(definitionFieldKey),
            audioField: localStorage.getItem(audioFieldKey),
            subtitleSize: localStorage.getItem(subtitleSizeKey) || defaultSubtitleSize,
            subtitleColor: localStorage.getItem(subtitleColorKey) || defaultSubtitleColor,
            subtitleOutlineThickness: localStorage.getItem(subtitleOutlineThicknessKey) || defaultSubtitleOutlineThickness,
            subtitleOutlineColor: localStorage.getItem(subtitleOutlineColorKey) || defaultSubtitleOutlineColor,
            subtitleBackgroundColor: localStorage.getItem(subtitleBackgroundColorKey) || defaultSubtitleBackgroundColor,
            subtitleBackgroundOpacity : localStorage.getItem(subtitleBackgroundOpacityKey) || defaultSubtitleBackgroundOpacity,
        };
    }

    get subtitleSettings() {
        return {
            subtitleSize: localStorage.getItem(subtitleSizeKey) || defaultSubtitleSize,
            subtitleColor: localStorage.getItem(subtitleColorKey) || defaultSubtitleColor,
            subtitleOutlineThickness: localStorage.getItem(subtitleOutlineThicknessKey) || defaultSubtitleOutlineThickness,
            subtitleOutlineColor: localStorage.getItem(subtitleOutlineColorKey) || defaultSubtitleOutlineColor,
            subtitleBackgroundColor: localStorage.getItem(subtitleBackgroundColorKey) || defaultSubtitleBackgroundColor,
            subtitleBackgroundOpacity : localStorage.getItem(subtitleBackgroundOpacityKey) || defaultSubtitleBackgroundOpacity,
        };
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
}