import { VideoDataSubtitleTrack } from '@project/common';
import { Parser } from 'm3u8-parser';

setTimeout(() => {
    let basename: string = '';
    let subtitles: VideoDataSubtitleTrack[] = [];
    let path = window.location.pathname;

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

    function tryResetState() {
        if (path !== window.location.pathname) {
            basename = basenameFromDOM();
            subtitles = [];
            path = window.location.pathname;
        }
    }

    function baseUrlForUrl(url: string) {
        return url.substring(0, url.lastIndexOf('/'));
    }

    function m3U8(url: string, callback: (m3u8: any) => void) {
        setTimeout(() => {
            fetch(url)
                .then((response) => response.text())
                .then((text) => {
                    const parser = new Parser();
                    parser.push(text);
                    parser.end();
                    callback(parser.manifest);
                });
        }, 0);
    }

    function completeM3U8(url: string) {
        setTimeout(() => {
            m3U8(url, (manifest: any) => {
                if (manifest.playlists instanceof Array && manifest.playlists.length > 0) {
                    const subtitleGroup = manifest.mediaGroups?.SUBTITLES;

                    if (subtitleGroup && subtitleGroup['sub-main']) {
                        const tracks = subtitleGroup['sub-main'];
                        for (const label of Object.keys(tracks)) {
                            const track = tracks[label];

                            if (track && typeof track.language === 'string' && typeof track.uri === 'string') {
                                const baseUrl = baseUrlForUrl(url);
                                tryResetState();
                                const subtitleM3U8Url = `${baseUrl}/${track.uri}`;
                                subtitles.push({
                                    label: label,
                                    language: track.language,
                                    url: `${baseUrl}/${track.uri}`,
                                    m3U8BaseUrl: baseUrlForUrl(subtitleM3U8Url),
                                });
                            }
                        }
                    }
                }
            });
        }, 0);
    }

    const originalParse = JSON.parse;
    JSON.parse = function (stringified) {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);
        if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
            const url = value.stream.sources[0].complete?.url;

            if (url) {
                completeM3U8(url);
            }
        }

        return value;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            tryResetState();
            subtitles.sort((a, b) => {
                if (a.label < b.label) {
                    return -1;
                }

                if (a.label > b.label) {
                    return 1;
                }

                return 0;
            });
            const response = {
                error: '',
                basename: basename === '' ? await basenameFromDOMWithRetries(5) : basename,
                extension: 'm3u8',
                subtitles: subtitles,
            };
            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        },
        false
    );
}, 0);
