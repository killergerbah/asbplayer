const defaultAnkiConnectUrl = "http://127.0.0.1:8765";
const ankiConnectUrlKey = "ankiConnectUrl";
const deckKey = "deck";
const noteTypeKey = "noteType";
const sentenceFieldKey = "sentenceField";
const definitionFieldKey = "definitionField";
const audioFieldKey = "audioField";

export default class SettingsProvider {

    get settings() {
        return {
            ankiConnectUrl: localStorage.getItem(ankiConnectUrlKey) || defaultAnkiConnectUrl,
            deck: localStorage.getItem(deckKey),
            noteType: localStorage.getItem(noteTypeKey),
            sentenceField: localStorage.getItem(sentenceFieldKey),
            definitionField: localStorage.getItem(definitionFieldKey),
            audioField: localStorage.getItem(audioFieldKey)
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
}