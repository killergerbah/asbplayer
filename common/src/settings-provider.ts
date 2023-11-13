import {
    AsbplayerSettings,
    AutoPausePreference,
    KeyBindName,
    PostMineAction,
    SubtitleListPreference,
} from '@project/common';
import { isMacOs } from 'react-device-detect';

export const defaultSettings: AsbplayerSettings = {
    ankiConnectUrl: 'http://127.0.0.1:8765',
    deck: '',
    noteType: '',
    sentenceField: '',
    definitionField: '',
    audioField: '',
    imageField: '',
    wordField: '',
    sourceField: '',
    urlField: '',
    subtitleSize: 36,
    subtitleColor: '#ffffff',
    subtitleThickness: 700,
    subtitleOutlineThickness: 1,
    subtitleOutlineColor: '#000000',
    subtitleBackgroundColor: '#000000',
    subtitleBackgroundOpacity: 0.5,
    subtitleFontFamily: '',
    subtitlePreview: 'アあ安Aa',
    audioPaddingStart: 0,
    audioPaddingEnd: 500,
    maxImageWidth: 0,
    maxImageHeight: 0,
    surroundingSubtitlesCountRadius: 2,
    surroundingSubtitlesTimeRadius: 10000,
    autoPausePreference: AutoPausePreference.atEnd,
    keyBindSet: {
        togglePlay: { keys: 'space' },
        toggleAutoPause: { keys: isMacOs ? '⇧+P' : 'shift+P' },
        toggleCondensedPlayback: { keys: isMacOs ? '⇧+O' : 'shift+O' },
        toggleSubtitles: { keys: 'down' },
        toggleVideoSubtitleTrack1: { keys: '1' },
        toggleVideoSubtitleTrack2: { keys: '2' },
        toggleAsbplayerSubtitleTrack1: { keys: 'W+1' },
        toggleAsbplayerSubtitleTrack2: { keys: 'W+2' },
        seekBackward: { keys: 'A' },
        seekForward: { keys: 'D' },
        seekToPreviousSubtitle: { keys: 'left' },
        seekToNextSubtitle: { keys: 'right' },
        seekToBeginningOfCurrentSubtitle: { keys: 'up' },
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
        toggleSidePanel: { keys: '`' },
    },
    preferMp3: true,
    miningHistoryStorageLimit: 25,
    preCacheSubtitleDom: true,
    clickToMineDefaultAction: PostMineAction.showAnkiDialog,
    themeType: 'dark',
    copyToClipboardOnMine: false,
    rememberSubtitleOffset: true,
    autoCopyCurrentSubtitle: false,
    subtitleRegexFilter: '',
    subtitleRegexFilterTextReplacement: '',
    language: 'en',
    customAnkiFields: {},
    tags: [],
    imageBasedSubtitleScaleFactor: 1,
    subtitleCustomStyles: [{ key: 'webkitFontSmoothing', value: 'antialiased' }],
    streamingAppUrl: 'https://killergerbah.github.io/asbplayer',
    streamingDisplaySubtitles: true,
    streamingRecordMedia: true,
    streamingTakeScreenshot: true,
    streamingCleanScreenshot: true,
    streamingCropScreenshot: true,
    streamingSubsDragAndDrop: true,
    streamingAutoSync: false,
    streamingLastLanguagesSynced: {},
    streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
    streamingSubtitlePositionOffset: 75,
    streamingScreenshotDelay: 1000,
    streamingSubtitleAlignment: 'bottom',
    streamingSubtitleListPreference: SubtitleListPreference.noSubtitleList,
};

type SettingsDeserializers = { [key in keyof AsbplayerSettings]: (serialized: string) => any };
export const settingsDeserializers: SettingsDeserializers = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, value]) => {
        if (typeof value === 'string') {
            return [key, (s: string) => s];
        }

        if (typeof value === 'boolean') {
            return [key, (s: string) => Boolean(s)];
        }

        if (typeof value === 'number') {
            return [key, (s: string) => Number(s)];
        }

        if (key === 'keyBindSet') {
            return [
                key,
                (s: string) => {
                    const keyBindSet = JSON.parse(s);

                    for (const key of Object.keys(defaultSettings.keyBindSet)) {
                        const keyBindName = key as KeyBindName;

                        if (keyBindSet[keyBindName] === undefined) {
                            keyBindSet[keyBindName] = defaultSettings.keyBindSet[keyBindName];
                        }
                    }

                    return keyBindSet;
                },
            ];
        }

        if (typeof value === 'object') {
            return [key, (s: string) => JSON.parse(s)];
        }

        throw new Error('Could not determine deserializer for setting');
    })
) as SettingsDeserializers;

type SettingsKey = keyof AsbplayerSettings;

export class SettingsProvider {
    private _storage;

    constructor(storage: SettingsStorage) {
        this._storage = storage;
    }

    async getAll(): Promise<AsbplayerSettings> {
        return this.get(Object.keys(defaultSettings) as SettingsKey[]);
    }

    async getSingle<K extends keyof AsbplayerSettings>(key: K): Promise<AsbplayerSettings[K]> {
        const vals = (await this.get([key])) as Partial<AsbplayerSettings>;
        const val = vals[key];
        return val as AsbplayerSettings[K];
    }

    async get<K extends keyof AsbplayerSettings>(keys: K[]): Promise<Pick<AsbplayerSettings, K>> {
        let parameters: Partial<AsbplayerSettings> = {};

        for (const key of keys) {
            parameters[key] = defaultSettings[key];
        }

        const data = await this._storage.get(parameters);
        const result: any = {};

        for (const key in parameters) {
            result[key] = data[key as SettingsKey] ?? defaultSettings[key as SettingsKey];
        }

        return result;
    }

    async set(settings: Partial<AsbplayerSettings>): Promise<void> {
        await this._storage.set(settings);
    }
}

export interface SettingsStorage {
    get: (keysAndDefaults: Partial<AsbplayerSettings>) => Promise<Partial<AsbplayerSettings>>;
    set: (settings: Partial<AsbplayerSettings>) => Promise<void>;
}
