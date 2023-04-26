export type SubtitleAlignment = 'top' | 'bottom';
export interface ExtensionKeyBindingsSettings {
    bindPlay: boolean;
    bindAutoPause: boolean;
    bindCondensedPlayback: boolean;
    bindToggleSubtitles: boolean;
    bindToggleSubtitleTrackInVideo: boolean;
    bindToggleSubtitleTrackInAsbplayer: boolean;
    bindSeekToSubtitle: boolean;
    bindAdjustOffsetToSubtitle: boolean;
    bindAdjustOffset: boolean;
    bindResetOffset: boolean;
    bindAdjustPlaybackRate: boolean;
    bindSeekBackwardOrForward: boolean;
    bindSeekToBeginningOfCurrentSubtitle: boolean;
}

export interface ExtensionSettings extends ExtensionKeyBindingsSettings {
    displaySubtitles: boolean;
    recordMedia: boolean;
    screenshot: boolean;
    cleanScreenshot: boolean;
    cropScreenshot: boolean;
    subsDragAndDrop: boolean;
    autoSync: boolean;
    lastLanguagesSynced: { [key: string]: string };
    subtitlePositionOffset: number;
    condensedPlaybackMinimumSkipIntervalMs: number;
    asbplayerUrl: string;
    lastThemeType: 'dark' | 'light';
    lastLanguage: string;
    imageDelay: number;
    subtitleAlignment: SubtitleAlignment;
}
