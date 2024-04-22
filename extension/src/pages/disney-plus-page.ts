import { VideoDataSubtitleTrack } from '@project/common';
import { Parser } from 'm3u8-parser';

setTimeout(() => {
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

    async function basenameFromDOMWithRetries(retries: number) {
        const basename = basenameFromDOM();

        if (retries === 0) {
            return basename;
        }

        if (basename === '') {
            return new Promise((resolve, reject) => {
                setTimeout(async () => resolve(await basenameFromDOMWithRetries(retries - 1)), 1000);
            });
        }

        return basename;
    }

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
                                    subtitles.push({
                                        label: label,
                                        language: track.language,
                                        url: subtitleM3U8Url,
                                        m3U8BaseUrl: baseUrlForUrl(subtitleM3U8Url),
                                        extension: 'm3u8',
                                    });
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

    let subtitlesPromise: Promise<VideoDataSubtitleTrack[]> | undefined;

    const originalParse = JSON.parse;
    JSON.parse = function () {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);
        if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
            const url = value.stream.sources[0].complete?.url;

            if (url) {
                subtitlesPromise = completeM3U8(url);
            }
        }

        return value;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            if (!subtitlesPromise) {
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: 'Could not extract subtitle track information.',
                            basename: '',
                            subtitles: [],
                        },
                    })
                );
                return;
            }

            try {
                const subtitles = await subtitlesPromise;
                subtitlesPromise = undefined;
                subtitles.sort((a, b) => {
                    if (a.label < b.label) {
                        return -1;
                    }

                    if (a.label > b.label) {
                        return 1;
                    }

                    return 0;
                });
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: (await basenameFromDOMWithRetries(10)) ?? '',
                            extension: 'm3u8',
                            subtitles: subtitles,
                        },
                    })
                );
            } catch (e) {
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: e instanceof Error ? e.message : String(e),
                            basename: '',
                            extension: 'm3u8',
                            subtitles: [],
                        },
                    })
                );
            }
        },
        false
    );
}, 0);
