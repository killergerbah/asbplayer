import { useMemo } from 'react';
import { SubtitleSettings, TextSubtitleSettings, textSubtitleSettingsForTrack } from '../../settings';
import { computeStyleString, computeStyles } from '../../util';

interface TrackStyles {
    styles: { [key: string]: any };
    styleString: string;
    classes: string;
}

export const useSubtitleStyles = (settings: SubtitleSettings, trackCount: number) => {
    return useMemo(() => {
        const tracks: TrackStyles[] = [];
        for (let track = 0; track < trackCount; ++track) {
            const s = textSubtitleSettingsForTrack(settings, track) as TextSubtitleSettings;
            tracks.push({
                styles: computeStyles(s),
                styleString: computeStyleString(s),
                classes: s.subtitleBlur ? 'asbplayer-subtitles-blurred' : '',
            });
        }
        return tracks;
    }, [settings, trackCount]);
};
