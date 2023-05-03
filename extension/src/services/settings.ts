import { ExtensionSettings, ExtensionKeyBindingsSettings } from '@project/common';

const defaults: ExtensionSettings = {
    displaySubtitles: true,
    recordMedia: true,
    screenshot: true,
    cleanScreenshot: true,
    cropScreenshot: true,
    bindPlay: true,
    bindAutoPause: true,
    bindCondensedPlayback: true,
    bindToggleSubtitles: true,
    bindToggleSubtitleTrackInVideo: true,
    bindToggleSubtitleTrackInAsbplayer: true,
    bindSeekToSubtitle: true,
    bindSeekToBeginningOfCurrentSubtitle: true,
    bindSeekBackwardOrForward: true,
    bindAdjustOffsetToSubtitle: true,
    bindAdjustOffset: true,
    bindResetOffset: true,
    bindAdjustPlaybackRate: true,
    subsDragAndDrop: true,
    autoSync: false,
    lastLanguagesSynced: {},
    condensedPlaybackMinimumSkipIntervalMs: 1000,
    subtitlePositionOffset: 75,
    asbplayerUrl: 'https://killergerbah.github.io/asbplayer/',
    lastThemeType: 'dark',
    lastLanguage: 'en',
    imageDelay: 1000,
    subtitleAlignment: 'bottom',
};

// TypeScript will ensure that this object has all the key binding settings keys.
// We then use the object to export an array of all the key binding settings keys.
// There doesn't seem to be a more direct way to do this with just an array.
const keyBindSettingsObject: { [key in keyof ExtensionKeyBindingsSettings]: boolean } = {
    bindPlay: true,
    bindAutoPause: true,
    bindCondensedPlayback: true,
    bindToggleSubtitles: true,
    bindToggleSubtitleTrackInVideo: true,
    bindToggleSubtitleTrackInAsbplayer: true,
    bindSeekToSubtitle: true,
    bindSeekToBeginningOfCurrentSubtitle: true,
    bindSeekBackwardOrForward: true,
    bindAdjustOffsetToSubtitle: true,
    bindAdjustOffset: true,
    bindResetOffset: true,
    bindAdjustPlaybackRate: true,
};

export const keyBindSettingsKeys = Object.keys(keyBindSettingsObject) as (keyof ExtensionKeyBindingsSettings)[];

type SettingsKey = keyof ExtensionSettings;

export default class Settings {
    async getAll(): Promise<ExtensionSettings> {
        return this.get(Object.keys(defaults) as SettingsKey[]);
    }

    async getSingle<K extends keyof ExtensionSettings>(key: K): Promise<ExtensionSettings[K]> {
        const vals = (await this.get([key])) as Partial<ExtensionSettings>;
        const val = vals[key];
        return val as ExtensionSettings[K];
    }

    async get<K extends keyof ExtensionSettings>(keys: K[]): Promise<Pick<ExtensionSettings, K>> {
        let parameters: Partial<ExtensionSettings> = {};

        for (const key of keys) {
            parameters[key] = defaults[key];
        }

        return new Promise((resolve, reject) => {
            chrome.storage.local.get(parameters, (data) => {
                const result: any = {};

                for (const key in parameters) {
                    result[key] = data[key] ?? defaults[key as SettingsKey];
                }

                resolve(result);
            });
        });
    }

    async set(settings: Partial<ExtensionSettings>) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(settings, () => resolve(undefined));
        });
    }
}
