import SettingsProvider from './settings-provider';

const volumeKey = 'volume';
const theaterModeKey = 'theaterMode';
const offsetKey = 'offset';
const defaultVolume = 100;

export default class PlaybackPreferences {
    private readonly settingsProvider: SettingsProvider;

    constructor(settingsProvider: SettingsProvider) {
        this.settingsProvider = settingsProvider;
    }

    get volume() {
        const value = localStorage.getItem(volumeKey);

        if (value === null) {
            return defaultVolume;
        }

        return Number(value);
    }

    set volume(volume) {
        localStorage.setItem(volumeKey, String(volume));
    }

    get theaterMode() {
        return localStorage.getItem(theaterModeKey) === 'true' || false;
    }

    set theaterMode(theaterMode) {
        localStorage.setItem(theaterModeKey, String(theaterMode));
    }

    get offset(): number {
        if (!this.settingsProvider.rememberSubtitleOffset) {
            return 0;
        }

        const value = localStorage.getItem(offsetKey);

        if (value === null) {
            return 0;
        }

        return Number(value);
    }

    set offset(offset: number) {
        localStorage.setItem(offsetKey, String(offset));
    }
}
