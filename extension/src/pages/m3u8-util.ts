import { VideoDataSubtitleTrack } from '@project/common';
import { Parser } from 'm3u8-parser';
import { trackFromDef } from './util';
import { Parser as m3U8Parser } from 'm3u8-parser';

function baseUrlForUrl(url: string) {
    return url.substring(0, url.lastIndexOf('/'));
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

export function subtitleTrackSegmentsFromM3U8(url: string): Promise<VideoDataSubtitleTrack[]> {
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const manifest = await m3U8(url);
                const baseUrl = baseUrlForUrl(url);

                if (manifest.playlists instanceof Array && manifest.playlists.length > 0) {
                    const subtitleGroup = manifest.mediaGroups?.SUBTITLES;

                    if (subtitleGroup && subtitleGroup['sub-main']) {
                        const tracks = subtitleGroup['sub-main'];
                        const promises: Promise<VideoDataSubtitleTrack>[] = [];

                        for (const label of Object.keys(tracks)) {
                            if (label.includes('--forced--')) {
                                // These tracks are not for the main content and duplicate the language code
                                // so let's exclude them
                                // Unfortunately could not find a better way to distinguish them from the real subtitle content
                                continue;
                            }

                            const track = tracks[label];

                            if (track && typeof track.language === 'string' && typeof track.uri === 'string') {
                                const fetchTrack = async () => {
                                    const subtitleM3U8Url = `${baseUrl}/${track.uri}`;
                                    const m3U8Response = await fetch(subtitleM3U8Url);
                                    const parser = new m3U8Parser();
                                    parser.push(await m3U8Response.text());
                                    parser.end();
                                    const firstUri = parser.manifest.segments[0].uri;
                                    const extension = firstUri.substring(firstUri.lastIndexOf('.') + 1);
                                    const subtitleBaseUrl = baseUrlForUrl(subtitleM3U8Url);
                                    const urls = parser.manifest.segments
                                        .filter((s: any) => !s.discontinuity && s.uri)
                                        .map((s: any) => `${subtitleBaseUrl}/${s.uri}`);
                                    return trackFromDef({
                                        label: label,
                                        language: track.language,
                                        url: urls,
                                        extension: extension,
                                    });
                                };
                                promises.push(fetchTrack());
                            }
                        }

                        resolve(await Promise.all(promises));
                        return;
                    }
                }

                reject(new Error('Subtitles not found.'));
            } catch (e) {
                reject(e);
            }
        }, 0);
    });
}
