import { VideoDataSubtitleTrack } from '@project/common';

setTimeout(() => {
    let basename: string | undefined = undefined;
    let subtitles: VideoDataSubtitleTrack[] = [];
    let path = window.location.pathname;

    function tryResetState() {
        if (path !== window.location.pathname) {
            basename = undefined;
            subtitles = [];
            path = window.location.pathname;
        }
    }

    const originalParse = JSON.parse;

    JSON.parse = function () {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);
        if (value?.text_tracks instanceof Array) {
            tryResetState();

            for (const track of value.text_tracks) {
                if (
                    track.kind === 'captions' &&
                    track.mime_type === 'text/webvtt' &&
                    track.sources instanceof Array &&
                    track.sources.length > 0 &&
                    typeof track.sources[0].src === 'string' &&
                    typeof track.srclang === 'string'
                ) {
                    const label =
                        typeof track.label === 'string' ? `${track.srclang} - ${track?.label}` : track.srclang;
                    const language = track.srclang.toLowerCase();

                    if (subtitles.find((s) => s.language === language) === undefined) {
                        subtitles.push({
                            label: label,
                            language: language,
                            url: track.sources[0].src.replace(/^http:\/\//, 'https://'),
                        });
                    }
                }
            }

            if (typeof value?.name === 'string') {
                basename = value?.name;
            }
        }

        return value;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            tryResetState();
            const response = {
                error: '',
                basename: basename ?? document.title,
                extension: 'vtt',
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
