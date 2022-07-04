export interface ExtensionKeyBindingsSettings {
    bindPlay: boolean;
    bindAutoPause: boolean;
    bindToggleSubtitles: boolean;
    bindToggleSubtitleTrackInVideo: boolean;
    bindToggleSubtitleTrackInAsbplayer: boolean;
    bindSeekToSubtitle: boolean;
    bindAdjustOffsetToSubtitle: boolean;
    bindAdjustOffset: boolean;
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
    lastLanguageSynced: string;
    subtitlePositionOffsetBottom: number;
    asbplayerUrl: string;
    lastThemeType: 'dark' | 'light';
}
