import { parse } from 'mpd-parser';
import { extractExtension, inferTracks } from './util';
import { VideoDataSubtitleTrack } from '@project/common';

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

            tracks.push({
                label: language,
                language,
                url: playlist.resolvedUri,
                extension: extractExtension(playlist.resolvedUri, 'vtt'),
            });
        }
    }

    return tracks;
};

let lastManifestUrl: string | undefined;

window.fetch = (...args) => {
    const mpdUrl = args.find(
        (arg) => typeof arg === 'string' && /https:\/\/.+\.viki\..+manifest\.mpd/.test(arg)
    ) as string;

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
