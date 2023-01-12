import { VideoDataSubtitleTrack } from '@project/common';

setTimeout(() => {
    let basename: string | undefined = '';
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

        if (value?.subtitleUrls instanceof Array) {
            tryResetState();
            for (const track of value.subtitleUrls) {
                if (
                    typeof value?.catalogMetadata?.catalog?.title === 'string' &&
                    typeof track.url === 'string' &&
                    typeof track.languageCode === 'string' &&
                    typeof track.displayName === 'string'
                ) {
                    subtitles.push({
                        label: `${value.catalogMetadata.catalog.title} ${track.displayName}`,
                        language: track.languageCode.toLowerCase(),
                        url: track.url,
                    });
                }
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
                basename: basename,
                extension: 'dfxp',
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
