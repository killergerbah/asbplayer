import { AsbplayerSettings, SubtitleAlignment } from '@project/common/settings';
import { CachedLocalStorage } from './cached-local-storage';
import ChromeExtension from './chrome-extension';

const volumeKey = 'volume';
const theaterModeKey = 'theaterMode';
const offsetKey = 'offset';
const displaySubtitlesKey = 'displaySubtitles';
const subtitleAlignmentKey = 'subtitleAlignment2';
const subtitlePositionOffetKey = 'subtitlePositionOffset';
const defaultVolume = 100;

export default class PlaybackPreferences {
    private readonly _settings: AsbplayerSettings;
    private readonly _storage = new CachedLocalStorage();
    private readonly _extension: ChromeExtension;

    constructor(settings: AsbplayerSettings, extension: ChromeExtension) {
        this._settings = settings;
        this._extension = extension;
    }

    get volume() {
        const value = this._storage.get(volumeKey);

        if (value === null) {
            return defaultVolume;
        }

        return Number(value);
    }

    set volume(volume) {
        this._storage.set(volumeKey, String(volume));
    }

    get theaterMode() {
        return this._storage.get(theaterModeKey) === 'true' || false;
    }

    set theaterMode(theaterMode) {
        this._storage.set(theaterModeKey, String(theaterMode));
    }

    get offset(): number {
        if (!this._settings.rememberSubtitleOffset) {
            return 0;
        }

        if (this._extension.supportsAppIntegration) {
            return this._settings.lastSubtitleOffset;
        }

        const value = this._storage.get(offsetKey);

        if (value === null) {
            return 0;
        }

        return Number(value);
    }

    set offset(offset: number) {
        if (this._extension.supportsAppIntegration) {
            this._extension.setSettings({ lastSubtitleOffset: offset });
        } else {
            this._storage.set(offsetKey, String(offset));
        }
    }

    get subtitleAlignment() {
        if (this._extension.supportsAppIntegration) {
            return this._settings.subtitleAlignment;
        }

        const val = this._storage.get(subtitleAlignmentKey);

        if (val === null) {
            return 'bottom';
        }

        return val as SubtitleAlignment;
    }

    set subtitleAlignment(alignment: SubtitleAlignment) {
        if (this._extension.supportsAppIntegration) {
            this._extension.setSettings({ subtitleAlignment: alignment });
        } else {
            this._storage.set(subtitleAlignmentKey, String(alignment));
        }
    }

    get subtitlePositionOffset() {
        if (this._extension.supportsAppIntegration) {
            return this._settings.subtitlePositionOffset;
        }

        const val = this._storage.get(subtitlePositionOffetKey);

        if (val === null) {
            return 100;
        }

        return Number(val);
    }

    set subtitlePositionOffset(offset: number) {
        if (this._extension.supportsAppIntegration) {
            this._extension.setSettings({ subtitlePositionOffset: offset });
        } else {
            this._storage.set(subtitlePositionOffetKey, String(offset));
        }
    }

    get displaySubtitles() {
        const value = this._storage.get(displaySubtitlesKey);

        if (value === null) {
            return true;
        }

        return value === 'true';
    }

    set displaySubtitles(displaySubtitles: boolean) {
        this._storage.set(displaySubtitlesKey, String(displaySubtitles));
    }
}
