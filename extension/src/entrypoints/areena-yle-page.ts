import { VideoDataSubtitleTrack } from '@project/common';
import { inferTracks } from '@/pages/util';
import { Parser } from 'm3u8-parser';
import { subtitleTrackSegmentsFromM3U8 } from '@/pages/m3u8-util';

export interface Playlist {
    language: string;
    uri: string;
}

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

        const m3U8UrlObject = new URL(m3U8Url);
        let dataBaseUrl = `${m3U8UrlObject.origin}/${m3U8UrlObject.pathname}`;
        dataBaseUrl = dataBaseUrl.substring(0, dataBaseUrl.lastIndexOf('/'));

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

                return await subtitleTrackSegmentsFromM3U8(url);
            }
        }

        return [];
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
