import { AnkiExportMode, AutoPausePreference, PostMineAction, PostMinePlayback, SubtitleHtml } from '../src/model';

export enum PauseOnHoverMode {
    disabled = 0,
    inAndOut = 1,
    inNotOut = 2,
}

export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
    readonly copyToClipboardOnMine: boolean;
    readonly autoPausePreference: AutoPausePreference;
    readonly seekDuration: number;
    readonly speedChangeStep: number;
    readonly fastForwardModePlaybackRate: number;
    readonly keyBindSet: KeyBindSet;
    readonly rememberSubtitleOffset: boolean;
    readonly autoCopyCurrentSubtitle: boolean;
    readonly alwaysPlayOnSubtitleRepeat: boolean;
    readonly subtitleHtml: SubtitleHtml;
    readonly subtitleRegexFilter: string;
    readonly subtitleRegexFilterTextReplacement: string;
    readonly miningHistoryStorageLimit: number;
    readonly language: string;
    readonly clickToMineDefaultAction: PostMineAction;
    readonly postMiningPlaybackState: PostMinePlayback;
    readonly lastSubtitleOffset: number;
    readonly lastSelectedAnkiExportMode: AnkiExportMode;
    readonly tabName: string;
    readonly pauseOnHoverMode: PauseOnHoverMode;
}

export type AnkiSettingsFieldKey =
    | 'sentenceField'
    | 'definitionField'
    | 'audioField'
    | 'imageField'
    | 'wordField'
    | 'sourceField'
    | 'urlField'
    | 'track1Field'
    | 'track2Field'
    | 'track3Field';

export interface AnkiSettings {
    readonly ankiConnectUrl: string;
    readonly deck: string;
    readonly noteType: string;
    readonly sentenceField: string;
    readonly definitionField: string;
    readonly audioField: string;
    readonly imageField: string;
    readonly wordField: string;
    readonly sourceField: string;
    readonly urlField: string;
    readonly track1Field: string;
    readonly track2Field: string;
    readonly track3Field: string;
    readonly customAnkiFields: { [key: string]: string };
    readonly tags: string[];
    readonly recordWithAudioPlayback: boolean;
    readonly preferMp3: boolean;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly maxImageWidth: number;
    readonly maxImageHeight: number;
    readonly surroundingSubtitlesCountRadius: number;
    readonly surroundingSubtitlesTimeRadius: number;
    readonly ankiFieldSettings: AnkiFieldSettings;
    readonly customAnkiFieldSettings: CustomAnkiFieldSettings;
}

export interface AnkiField {
    readonly order: number;
    readonly display: boolean;
}

export interface AnkiFieldSettings {
    readonly sentence: AnkiField;
    readonly definition: AnkiField;
    readonly audio: AnkiField;
    readonly image: AnkiField;
    readonly word: AnkiField;
    readonly source: AnkiField;
    readonly url: AnkiField;
    readonly track1: AnkiField;
    readonly track2: AnkiField;
    readonly track3: AnkiField;
}

export type CustomAnkiFieldSettings = { [key: string]: AnkiField };

const ankiSettingsKeysObject: { [key in keyof AnkiSettings]: boolean } = {
    ankiConnectUrl: true,
    deck: true,
    noteType: true,
    sentenceField: true,
    definitionField: true,
    audioField: true,
    imageField: true,
    wordField: true,
    sourceField: true,
    urlField: true,
    track1Field: true,
    track2Field: true,
    track3Field: true,
    customAnkiFields: true,
    tags: true,
    recordWithAudioPlayback: true,
    preferMp3: true,
    audioPaddingStart: true,
    audioPaddingEnd: true,
    maxImageWidth: true,
    maxImageHeight: true,
    surroundingSubtitlesCountRadius: true,
    surroundingSubtitlesTimeRadius: true,
    ankiFieldSettings: true,
    customAnkiFieldSettings: true,
};

export const ankiSettingsKeys: (keyof AnkiSettings)[] = Object.keys(ankiSettingsKeysObject) as (keyof AnkiSettings)[];

const textSubtitleSettingsKeysObject: { [key in keyof TextSubtitleSettings]: boolean } = {
    subtitleColor: true,
    subtitleSize: true,
    subtitleThickness: true,
    subtitleOutlineThickness: true,
    subtitleOutlineColor: true,
    subtitleShadowThickness: true,
    subtitleShadowColor: true,
    subtitleBackgroundOpacity: true,
    subtitleBackgroundColor: true,
    subtitleFontFamily: true,
    subtitleCustomStyles: true,
    subtitleBlur: true,
    subtitleAlignment: true,
};

export const textSubtitleSettingsKeys: (keyof TextSubtitleSettings)[] = Object.keys(
    textSubtitleSettingsKeysObject
) as (keyof TextSubtitleSettings)[];

const subtitleSettingsKeysObject: { [key in keyof SubtitleSettings]: boolean } = {
    subtitleColor: true,
    subtitleSize: true,
    subtitleThickness: true,
    subtitleOutlineThickness: true,
    subtitleOutlineColor: true,
    subtitleShadowThickness: true,
    subtitleShadowColor: true,
    subtitleBackgroundOpacity: true,
    subtitleBackgroundColor: true,
    subtitleFontFamily: true,
    subtitleCustomStyles: true,
    subtitleBlur: true,
    imageBasedSubtitleScaleFactor: true,
    subtitlePositionOffset: true, // bottom offset; name kept for backwards compatibility
    topSubtitlePositionOffset: true,
    subtitleAlignment: true,
    subtitleTracksV2: true,
    subtitlesWidth: true,
};

export const subtitleSettingsKeys: (keyof SubtitleSettings)[] = Object.keys(
    subtitleSettingsKeysObject
) as (keyof SubtitleSettings)[];

export const extractAnkiSettings = <T extends AnkiSettings>(settings: T): AnkiSettings => {
    return Object.fromEntries(ankiSettingsKeys.map((k) => [k, settings[k]])) as unknown as AnkiSettings;
};

export interface CustomStyle {
    readonly key: string;
    readonly value: string;
}

export interface TextSubtitleSettings {
    readonly subtitleColor: string;
    readonly subtitleSize: number;
    readonly subtitleThickness: number;
    readonly subtitleOutlineThickness: number;
    readonly subtitleOutlineColor: string;
    readonly subtitleShadowThickness: number;
    readonly subtitleShadowColor: string;
    readonly subtitleBackgroundOpacity: number;
    readonly subtitleBackgroundColor: string;
    readonly subtitleFontFamily: string;
    readonly subtitleCustomStyles: CustomStyle[];
    readonly subtitleBlur: boolean;
    readonly subtitleAlignment: SubtitleAlignment;
}

export interface SubtitleSettings extends TextSubtitleSettings {
    readonly imageBasedSubtitleScaleFactor: number;
    readonly subtitlePositionOffset: number;
    readonly topSubtitlePositionOffset: number;

    // Settings for (0-based) tracks 1, 2,...
    // We don't configure track 0 here to avoid having to migrate old settings into this new data structure.
    // Track 0 continues to be configured from the top-level settings object.
    readonly subtitleTracksV2: TextSubtitleSettings[];

    // Percentage of containing video width; -1 means 'auto'
    readonly subtitlesWidth: number;
}

export interface KeyBind {
    readonly keys: string;
}

export interface KeyBindSet {
    readonly togglePlay: KeyBind;
    readonly toggleAutoPause: KeyBind;
    readonly toggleCondensedPlayback: KeyBind;
    readonly toggleFastForwardPlayback: KeyBind;
    readonly toggleSubtitles: KeyBind;
    readonly toggleVideoSubtitleTrack1: KeyBind;
    readonly toggleVideoSubtitleTrack2: KeyBind;
    readonly toggleVideoSubtitleTrack3: KeyBind;
    readonly toggleAsbplayerSubtitleTrack1: KeyBind;
    readonly toggleAsbplayerSubtitleTrack2: KeyBind;
    readonly toggleAsbplayerSubtitleTrack3: KeyBind;
    readonly unblurAsbplayerTrack1: KeyBind;
    readonly unblurAsbplayerTrack2: KeyBind;
    readonly unblurAsbplayerTrack3: KeyBind;
    readonly seekBackward: KeyBind;
    readonly seekForward: KeyBind;
    readonly seekToPreviousSubtitle: KeyBind;
    readonly seekToNextSubtitle: KeyBind;
    readonly seekToBeginningOfCurrentSubtitle: KeyBind;
    readonly adjustOffsetToPreviousSubtitle: KeyBind;
    readonly adjustOffsetToNextSubtitle: KeyBind;
    readonly decreaseOffset: KeyBind;
    readonly increaseOffset: KeyBind;
    readonly resetOffset: KeyBind;
    readonly decreasePlaybackRate: KeyBind;
    readonly increasePlaybackRate: KeyBind;
    readonly toggleSidePanel: KeyBind;
    readonly toggleRepeat: KeyBind;
    readonly moveBottomSubtitlesUp: KeyBind;
    readonly moveBottomSubtitlesDown: KeyBind;
    readonly moveTopSubtitlesUp: KeyBind;
    readonly moveTopSubtitlesDown: KeyBind;

    // Bound from Chrome if extension is installed
    readonly copySubtitle: KeyBind;
    readonly ankiExport: KeyBind;
    readonly updateLastCard: KeyBind;
    readonly exportCard: KeyBind;
    readonly takeScreenshot: KeyBind;
    readonly toggleRecording: KeyBind;
}

export interface WebSocketClientSettings {
    readonly webSocketServerUrl: string;
    readonly webSocketClientEnabled: boolean;
}

export type ChromeBoundKeyBindName = 'copySubtitle' | 'ankiExport' | 'updateLastCard' | 'exportCard' | 'takeScreenshot';
export type SubtitleAlignment = 'top' | 'bottom';
export enum SubtitleListPreference {
    noSubtitleList = 'noSubtitleList',
    app = 'app',
}

export interface StreamingVideoSettings {
    readonly streamingAppUrl: string;
    readonly streamingDisplaySubtitles: boolean;
    readonly streamingRecordMedia: boolean;
    readonly streamingTakeScreenshot: boolean;
    readonly streamingCleanScreenshot: boolean;
    readonly streamingCropScreenshot: boolean;
    readonly streamingSubsDragAndDrop: boolean;
    readonly streamingAutoSync: boolean;
    readonly streamingAutoSyncPromptOnFailure: boolean;
    // Last language selected in subtitle track selector, keyed by domain
    // Used to auto-selecting a language in subtitle track selector, if it's available
    readonly streamingLastLanguagesSynced: { [key: string]: string[] };
    readonly streamingCondensedPlaybackMinimumSkipIntervalMs: number;
    readonly streamingScreenshotDelay: number;
    readonly streamingSubtitleListPreference: SubtitleListPreference;
    readonly streamingEnableOverlay: boolean;
}

export type KeyBindName = keyof KeyBindSet;

export interface AsbplayerSettings
    extends MiscSettings,
        AnkiSettings,
        SubtitleSettings,
        StreamingVideoSettings,
        WebSocketClientSettings {
    readonly subtitlePreview: string;
}

const keyBindNameMap: any = {
    'copy-subtitle': 'copySubtitle',
    'copy-subtitle-with-dialog': 'ankiExport',
    'update-last-card': 'updateLastCard',
    'export-card': 'exportCard',
    'take-screenshot': 'takeScreenshot',
    'toggle-recording': 'toggleRecording',
    'toggle-video-select': 'selectSubtitleTrack',
};

export function chromeCommandBindsToKeyBinds(chromeCommands: { [key: string]: string | undefined }) {
    const keyBinds: { [key: string]: string | undefined } = {};

    for (const commandName of Object.keys(chromeCommands)) {
        keyBinds[keyBindNameMap[commandName]] = chromeCommands[commandName];
    }

    return keyBinds;
}
