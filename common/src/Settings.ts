import { AutoPausePreference } from './Model';

export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
    readonly copyToClipboardOnMine: boolean;
    readonly autoPausePreference: AutoPausePreference;
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

export interface AsbplayerSettings extends MiscSettings, AnkiSettings, SubtitleSettings {
    readonly subtitlePreview: string;
    readonly volume: number;
    readonly theaterMode: boolean;
}

export interface AsbplayerSettingsProvider extends AsbplayerSettings {
    readonly settings: AsbplayerSettings;
    readonly subtitleSettings: SubtitleSettings;
    readonly ankiSettings: AnkiSettings;
    readonly miscSettings: MiscSettings;

    subtitlePreview: string;
    volume: number;
    theaterMode: boolean;
}
