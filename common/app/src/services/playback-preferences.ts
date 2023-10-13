import { AsbplayerSettings, VideoTabModel } from '@project/common';
import CachedLocalStorage from './cached-local-storage';

const volumeKey = 'volume';
const theaterModeKey = 'theaterMode';
const offsetKey = 'offset';
const subtitleAlignmentKey = 'subtitleAlignment';
const subtitlePositionOffetKey = 'subtitlePositionOffset';
const defaultVolume = 100;

export enum SubtitleAlignment {
    bottom = 0,
    top = 1,
}

export default class PlaybackPreferences {
    private readonly settings: AsbplayerSettings;
    private readonly storage = new CachedLocalStorage();

    constructor(settings: AsbplayerSettings) {
        this.settings = settings;
    }

    get volume() {
        const value = this.storage.get(volumeKey);

        if (value === null) {
            return defaultVolume;
        }

        return Number(value);
    }

    set volume(volume) {
        this.storage.set(volumeKey, String(volume));
    }

    get theaterMode() {
        return this.storage.get(theaterModeKey) === 'true' || false;
    }

    set theaterMode(theaterMode) {
        this.storage.set(theaterModeKey, String(theaterMode));
    }

    get offset(): number {
        if (!this.settings.rememberSubtitleOffset) {
            return 0;
        }

        const value = this.storage.get(offsetKey);

        if (value === null) {
            return 0;
        }

        return Number(value);
    }

    set offset(offset: number) {
        this.storage.set(offsetKey, String(offset));
    }

    get subtitleAlignment() {
        const val = this.storage.get(subtitleAlignmentKey);

        if (val === undefined) {
            return SubtitleAlignment.bottom;
        }

        return Number(val) as SubtitleAlignment;
    }

    set subtitleAlignment(alignment: SubtitleAlignment) {
        this.storage.set(subtitleAlignmentKey, String(alignment));
    }

    get subtitlePositionOffset() {
        const val = this.storage.get(subtitlePositionOffetKey);

        if (val === null) {
            return 100;
        }

        return Number(val);
    }

    set subtitlePositionOffset(offset: number) {
        this.storage.set(subtitlePositionOffetKey, String(offset));
    }
}
