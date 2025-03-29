import { VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, inferTracks, trackFromDef } from './util';
import { Parser } from 'm3u8-parser';

export interface Playlist {
    language: string;
    uri: string;
}

function m3U8(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Bypass cache since Chrome might try to use a cached response that doesn't have appropriate CORS headers
            fetch(url, { cache: 'no-store' })
                .then((response) => response.text())
                .then((text) => {
                    const parser = new Parser();
                    parser.push(text);
                    parser.end();
                    resolve(parser.manifest);
                })
                .catch(reject);
        }, 0);
    });
}

function baseUrlForUrl(url: string) {
    return url.substring(0, url.lastIndexOf('/'));
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
        const tracks: VideoDataSubtitleTrack[] = [];

        if (typeof subGroups !== 'object') {
            return [];
        }

        const m3U8UrlObject = new URL(m3U8Url);
        let dataBaseUrl = `${m3U8UrlObject.origin}/${m3U8UrlObject.pathname}`;
        dataBaseUrl = dataBaseUrl.substring(0, dataBaseUrl.lastIndexOf('/'));

        for (const [category, group] of Object.entries(subGroups)) {
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

                const manifest = await m3U8(url);

                if (manifest.playlists instanceof Array && manifest.playlists.length > 0) {
                    const subtitleGroup = manifest.mediaGroups?.SUBTITLES;

                    if (subtitleGroup && subtitleGroup['sub-main']) {
                        const tracks = subtitleGroup['sub-main'];

                        for (const label of Object.keys(tracks)) {
                            const track = tracks[label];

                            if (track && typeof track.language === 'string' && typeof track.uri === 'string') {
                                const baseUrl = baseUrlForUrl(url);
                                const subtitleM3U8Url = `${baseUrl}/${track.uri}`;
                                const m3U8Response = await fetch(subtitleM3U8Url);
                                const parser = new Parser();
                                parser.push(await m3U8Response.text());
                                parser.end();
                                const firstUri = parser.manifest.segments[0].uri;
                                const extension = firstUri.substring(firstUri.lastIndexOf('.') + 1);
                                const subtitleBaseUrl = baseUrlForUrl(subtitleM3U8Url);
                                const urls = parser.manifest.segments
                                    .filter((s: any) => !s.discontinuity && s.uri)
                                    .map((s: any) => `${subtitleBaseUrl}/${s.uri}`);
                                const def = {
                                    label: label,
                                    language: track.language,
                                    url: urls,
                                    extension: extension,
                                };
                                tracks.push(trackFromDef(def));
                            }
                        }
                    }
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

inferTracksFromInterceptedM3u8(/https:\/\/.+\.m3u8.+/);
