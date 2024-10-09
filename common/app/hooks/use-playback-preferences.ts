import { MiscSettings, SubtitleSettings } from '../../settings';
import { useMemo } from 'react';
import PlaybackPreferences from '../services/playback-preferences';
import ChromeExtension from '../services/chrome-extension';

export const usePlaybackPreferences = (settings: SubtitleSettings & MiscSettings, extension: ChromeExtension) => {
    const {
        rememberSubtitleOffset,
        lastSubtitleOffset,
        subtitleAlignment,
        subtitlePositionOffset,
        topSubtitlePositionOffset,
    } = settings;
    return useMemo(
        () =>
            new PlaybackPreferences(
                {
                    rememberSubtitleOffset,
                    lastSubtitleOffset,
                    subtitleAlignment,
                    subtitlePositionOffset,
                    topSubtitlePositionOffset,
                },
                extension
            ),
        [
            rememberSubtitleOffset,
            lastSubtitleOffset,
            subtitleAlignment,
            subtitlePositionOffset,
            topSubtitlePositionOffset,
            extension,
        ]
    );
};
