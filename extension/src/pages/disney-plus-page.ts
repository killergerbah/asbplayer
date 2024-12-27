import { VideoDataSubtitleTrack } from '@project/common';
import { Parser } from 'm3u8-parser';
import { inferTracks, trackFromDef } from './util';

setTimeout(() => {
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

    function completeM3U8(url: string): Promise<VideoDataSubtitleTrack[]> {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const manifest = await m3U8(url);

                    if (manifest.playlists instanceof Array && manifest.playlists.length > 0) {
                        const subtitleGroup = manifest.mediaGroups?.SUBTITLES;

                        if (subtitleGroup && subtitleGroup['sub-main']) {
                            const tracks = subtitleGroup['sub-main'];
                            const subtitles: VideoDataSubtitleTrack[] = [];

                            for (const label of Object.keys(tracks)) {
                                const track = tracks[label];

                                if (track && typeof track.language === 'string' && typeof track.uri === 'string') {
                                    const baseUrl = baseUrlForUrl(url);
                                    const subtitleM3U8Url = `${baseUrl}/${track.uri}`;
                                    const def = {
                                        label: label,
                                        language: track.language,
                                        url: subtitleM3U8Url,
                                        extension: 'm3u8',
                                    };
                                    subtitles.push(trackFromDef(def));
                                }
                            }

                            resolve(subtitles);
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
    function basenameFromDOM(): string {
        const titleElements = document.getElementsByClassName('title-field');
        const subtitleElements = document.getElementsByClassName('subtitle-field');
        let title: string | null = null;
        let subtitle: string | null = null;

        if (titleElements.length > 0) {
            title = titleElements[0].textContent;
        }

        if (subtitleElements.length > 0) {
            subtitle = subtitleElements[0].textContent;
        }

        if (title === null) {
            return '';
        }

        if (subtitle === null) {
            return title;
        }

        return `${title} ${subtitle}`;
    }

    async function basenameFromDOMWithRetries(retries: number): Promise<string | undefined> {
        const basename = basenameFromDOM();

        if (retries === 0) {
            return basename;
        }

        if (basename === '') {
            return new Promise((resolve, reject) => {
                setTimeout(async () => resolve(await basenameFromDOMWithRetries(retries - 1)), 1000);
            });
        }

        return undefined;
    }

    let lastM3U8Url: string | undefined = undefined;

    const originalParse = JSON.parse;
    JSON.parse = function () {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);
        if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
            const url = value.stream.sources[0].complete?.url;

            if (url) {
                lastM3U8Url = url;
            }
        }

        return value;
    };
    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            setBasename((await basenameFromDOMWithRetries(10)) ?? '');

            if (lastM3U8Url !== undefined) {
                const tracks = await completeM3U8(lastM3U8Url);

                for (const track of tracks) {
                    addTrack(track);
                }
            }
        },
        waitForBasename: false,
    });
}, 0);
