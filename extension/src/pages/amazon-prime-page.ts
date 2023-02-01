import { VideoDataSubtitleTrack } from '@project/common';
import { extractExtension } from './util';

setTimeout(() => {
    const subtitlesByPath: { [key: string]: VideoDataSubtitleTrack[] } = {};
    const originalParse = JSON.parse;

    JSON.parse = function () {
        // @ts-ignore
        const value = originalParse.apply(this, arguments);

        if (value?.subtitleUrls instanceof Array) {
            for (const track of value.subtitleUrls) {
                if (
                    typeof value?.catalogMetadata?.catalog?.title === 'string' &&
                    typeof track.url === 'string' &&
                    typeof track.languageCode === 'string' &&
                    typeof track.displayName === 'string'
                ) {
                    if (typeof subtitlesByPath[window.location.pathname] === 'undefined') {
                        subtitlesByPath[window.location.pathname] = [];
                    }

                    subtitlesByPath[window.location.pathname].push({
                        label: `${value.catalogMetadata.catalog.title} ${track.displayName}`,
                        language: track.languageCode.toLowerCase(),
                        url: track.url,
                        extension: extractExtension(track.url, 'dfxp'),
                    });
                }
            }
        }

        return value;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            const response = {
                error: '',
                basename: '',
                subtitles: subtitlesByPath[window.location.pathname] ?? [],
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
