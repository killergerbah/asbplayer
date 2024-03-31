import { VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, inferTracks } from './util';
import { parse } from 'mpd-parser';

export interface Playlist {
    attributes: any;
    resolvedUri: string;
}

export const inferTracksFromInterceptedMpd = (
    mpdUrlRegex: RegExp,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrack | undefined
) => {
    const originalFetch = window.fetch;

    const tryExtractSubtitleTracks = async (mpdUrl: string): Promise<VideoDataSubtitleTrack[]> => {
        const manifest = await (await originalFetch(mpdUrl)).text();
        const parsedManifest = parse(manifest, { manifestUri: mpdUrl });
        const subGroups = parsedManifest.mediaGroups?.SUBTITLES?.subs ?? {};
        const tracks: VideoDataSubtitleTrack[] = [];

        if (typeof subGroups !== 'object') {
            return [];
        }

        for (const [language, info] of Object.entries(subGroups)) {
            if (typeof info !== 'object') {
                continue;
            }

            const playlists = (info as any).playlists ?? [];

            if (typeof playlists !== 'object' || !Array.isArray(playlists)) {
                continue;
            }

            for (const playlist of playlists) {
                if (typeof playlist.resolvedUri !== 'string') {
                    continue;
                }

                const track = trackExtractor(playlist, language);

                if (track !== undefined) {
                    tracks.push(track);
                }
            }
        }

        return tracks;
    };

    let lastManifestUrl: string | undefined;

    window.fetch = (...args) => {
        const mpdUrl = args.find((arg) => typeof arg === 'string' && mpdUrlRegex.test(arg)) as string;

        if (mpdUrl !== undefined) {
            lastManifestUrl = mpdUrl;
        }

        return originalFetch(...args);
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            setBasename(document.title);

            if (lastManifestUrl !== undefined) {
                const tracks = await tryExtractSubtitleTracks(lastManifestUrl);
                for (const track of tracks) {
                    addTrack(track);
                }
            }
        },
        waitForBasename: false,
    });
};
