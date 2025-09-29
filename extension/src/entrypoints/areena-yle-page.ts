import { VideoDataSubtitleTrack } from '@project/common';
import { inferTracks, trackFromDef } from '@/pages/util';
import { Parser } from 'm3u8-parser';
import { fetchM3U8, subtitleTrackSegmentsFromM3U8 } from '@/pages/m3u8-util';

export interface Playlist {
    language: string;
    uri: string;
}

const computeBaseUrl = (url: string) => {
    const urlObj = new URL(url);
    let baseUrl = `${urlObj.origin}/${urlObj.pathname}`;
    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
    return baseUrl;
};

export const inferTracksFromInterceptedM3u8 = (urlRegex: RegExp) => {
    const tryExtractSubtitleTracks = async (m3U8Url: string): Promise<VideoDataSubtitleTrack[]> => {
        const manifest = await (await fetch(m3U8Url)).text();
        const parser = new Parser({
            url: m3U8Url,
        });
        parser.push(manifest);
        parser.end();
        const parsedManifest = parser.manifest;
        const subGroups = parsedManifest.mediaGroups?.SUBTITLES;

        if (typeof subGroups !== 'object') {
            return [];
        }

        let dataBaseUrl = computeBaseUrl(m3U8Url);
        const tracks: VideoDataSubtitleTrack[] = [];

        for (const [, group] of Object.entries(subGroups)) {
            if (typeof group !== 'object' || !group) {
                continue;
            }

            for (const [label, info] of Object.entries(group)) {
                if (typeof info !== 'object' || !info) {
                    continue;
                }

                const url = (info as any).uri;
                const language = (info as any).language;

                if (!url || !language) {
                    continue;
                }

                const subM3U8Url = `${dataBaseUrl}/${url}`;
                const subManifest = await fetchM3U8(subM3U8Url);
                if (subManifest.segments && subManifest.segments.length > 0) {
                    const firstUri = subManifest.segments[0].uri;
                    const extension = firstUri.substring(firstUri.lastIndexOf('.') + 1);
                    const subManifestBaseUrl = computeBaseUrl(subM3U8Url);
                    tracks.push(
                        trackFromDef({
                            label: label,
                            language: language,
                            url: subManifest.segments.map((s: any) => `${subManifestBaseUrl}/${s.uri}`),
                            extension: extension,
                        })
                    );
                }
            }
        }

        return tracks;
    };

    let lastManifestUrl: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function () {
        const url = arguments[1];

        if (typeof url === 'string' && urlRegex.test(url)) {
            lastManifestUrl = url;
        }

        // @ts-ignore
        originalXhrOpen.apply(this, arguments);
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

export default defineUnlistedScript(() => {
    inferTracksFromInterceptedM3u8(/https:\/\/.+\.m3u8.+/);
});
