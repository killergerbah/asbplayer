export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
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
    readonly tags: string[],
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
}

export interface AsbplayerSettings extends MiscSettings, AnkiSettings, SubtitleSettings {}

export interface AsbplayerSettingsProvider extends AsbplayerSettings {
    readonly settings: AsbplayerSettings;
    readonly subtitleSettings: SubtitleSettings;
    readonly ankiSettings: AnkiSettings;
    readonly miscSettings: MiscSettings;
    readonly subtitlePreview: string;

    // themeType: 'dark' | 'light';
    // ankiConnectUrl: string;
    // deck?: string;
    // noteType?: string;
    // sentenceField?: string;
    // definitionField?: string;
    // audioField?: string;
    // imageField?: string;
    // wordField?: string;
    // customAnkiFields: { [key: string]: string };
    // sourceField?: string;
    // preferMp3: boolean;
    // audioPaddingStart: number;
    // audioPaddingEnd: number;
    // maxImageWidth: number;
    // maxImageHeight: number;
    // surroundingSubtitlesCountRadius: number;
    // surroundingSubtitlesTimeRadius: number;
    // subtitleSize: number;
    // subtitleColor: string;
    // subtitleOutlineThickness: number;
    // subtitleOutlineColor: string;
    // subtitleBackgroundOpacity: number;
    // subtitleBackgroundColor: string;
    // subtitleFontFamily: string;
    // subtitlePreview: string;
    // volume: number;
}
