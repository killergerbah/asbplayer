import { AutoPausePreference } from './Model';

export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
    readonly copyToClipboardOnMine: boolean;
    readonly autoPausePreference: AutoPausePreference;
    readonly keyBindSet: KeyBindSet;
    readonly rememberSubtitleOffset: boolean;
    readonly autoCopyCurrentSubtitle: boolean;
    readonly subtitleRegexFilter:  string;
    readonly subtitleRegexFilterTextReplacement: string;
    readonly miningHistoryStorageLimit: number;
}

export interface AnkiSettings {
    readonly ankiConnectUrl: string;
    readonly deck?: string;
    readonly noteType?: string;
    readonly sentenceField?: string;
    readonly definitionField?: string;
    readonly audioField?: string;
    readonly imageField?: string;
    readonly wordField?: string;
    readonly urlField?: string;
    readonly customAnkiFields: { [key: string]: string };
    readonly tags: string[];
    readonly sourceField?: string;
    readonly preferMp3: boolean;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly maxImageWidth: number;
    readonly maxImageHeight: number;
    readonly surroundingSubtitlesCountRadius: number;
    readonly surroundingSubtitlesTimeRadius: number;
}

export interface SubtitleSettings {
    readonly subtitleSize: number;
    readonly subtitleColor: string;
    readonly subtitleOutlineThickness: number;
    readonly subtitleOutlineColor: string;
    readonly subtitleBackgroundColor: string;
    readonly subtitleBackgroundOpacity: number;
    readonly subtitleFontFamily: string;
    readonly imageBasedSubtitleScaleFactor: number;
}

export interface KeyBind {
    readonly keys: string;
}

export interface KeyBindSet {
    readonly togglePlay: KeyBind;
    readonly toggleAutoPause: KeyBind;
    readonly toggleCondensedPlayback: KeyBind;
    readonly toggleSubtitles: KeyBind;
    readonly toggleVideoSubtitleTrack1: KeyBind;
    readonly toggleVideoSubtitleTrack2: KeyBind;
    readonly toggleAsbplayerSubtitleTrack1: KeyBind;
    readonly toggleAsbplayerSubtitleTrack2: KeyBind;
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

    // Overridable by extension
    readonly copySubtitle: KeyBind;
    readonly ankiExport: KeyBind;
    readonly updateLastCard: KeyBind;
}

export type KeyBindName = keyof KeyBindSet;

export interface AsbplayerSettings extends MiscSettings, AnkiSettings, SubtitleSettings {
    subtitlePreview: string;
}

export interface AsbplayerSettingsProvider extends AsbplayerSettings {
    readonly settings: AsbplayerSettings;
    readonly subtitleSettings: SubtitleSettings;
    readonly ankiSettings: AnkiSettings;
    readonly miscSettings: MiscSettings;
}
