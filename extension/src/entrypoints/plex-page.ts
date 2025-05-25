import { VideoDataSubtitleTrack } from '@project/common';
import { VideoData } from '@project/common';
import { trackFromDef } from '@/pages/util';

export default defineUnlistedScript(() => {
    let serverUrl: string | undefined;
    let plexToken: string | undefined;
    let ratingKey: string | undefined; // Unique identifier for the video
    let selectedSubUrl: string | undefined; // URL to stream current subtitle

    const originalFetch = window.fetch;
    window.fetch = (...args) => {
        for (const arg of args) {
            const url = typeof arg === 'string' ? arg : arg instanceof Request ? arg.url : null;
            if (!url) {
                continue;
            }
            if (!plexToken) {
                const tokenMatch = url.match(/X-Plex-Token=([^&]+)/i);
                if (tokenMatch) {
                    serverUrl = new URL(url).origin;
                    plexToken = tokenMatch[1];
                }
            }
            let ratingKeyMatch = url.match(/library%2Fmetadata%2F(\d+)/i);
            if (ratingKeyMatch) {
                ratingKey = ratingKeyMatch[1];
            }
            ratingKeyMatch = url.match(/ratingKey=(\d+)/i);
            if (ratingKeyMatch) {
                ratingKey = ratingKeyMatch[1];
            }
            const selectedSubUrlMatch = url.match(/\/transcode\/universal\/.+?\?/i);
            if (selectedSubUrlMatch) {
                selectedSubUrl = url.replace(selectedSubUrlMatch[0], '/transcode/universal/subtitles?');
            }
        }
        return originalFetch(...args);
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            const response: VideoData = { error: '', basename: '', subtitles: [] };
            const miniPlayerWarn =
                'Automatic detection does not work for Plex if you resume playing your previous session from the mini player. Try stopping the video and hitting play on the media directly.';
            const internalSubWarn =
                'Internal subtitles must be currently selected for automatic detection. You can unselect it on the Plex player after asbplayer has it loaded. It also must not be burned in, set "Only image formats" for "Burn Subtitles" in Plex Settings > Player.';
            const parser = new DOMParser();

            if (!serverUrl || !plexToken) {
                response.error = `Could not get the Plex server URL or token. ${miniPlayerWarn}`;
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }
            if (!ratingKey) {
                response.error = `Could not get the ratingKey for the Plex media. ${miniPlayerWarn}`;
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }

            const resMeta = await fetch(`${serverUrl}/library/metadata/${ratingKey}?X-Plex-Token=${plexToken}`);
            const xmlText = await resMeta.text();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            const metadata = xmlDoc.querySelector('Video');
            if (!metadata) {
                response.error = `No metadata found for Plex video. ${miniPlayerWarn}: ${xmlText}`;
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }
            response.basename = metadata.getAttribute('title') ?? 'Unknown';

            const subtitles: VideoDataSubtitleTrack[] = [];
            const parts = metadata.querySelectorAll('Part');
            parts.forEach((part) => {
                const streams = part.querySelectorAll('Stream[streamType="3"]');
                streams.forEach((stream) => {
                    const streamKey = stream.getAttribute('key');
                    if (streamKey) {
                        // Only external can be downloaded directly
                        subtitles.push(
                            trackFromDef({
                                label: stream.getAttribute('extendedDisplayTitle') ?? '',
                                language: stream.getAttribute('language') ?? '',
                                url: `${serverUrl}${streamKey}?X-Plex-Token=${plexToken}`,
                                extension: stream.getAttribute('codec') ?? '',
                            })
                        );
                        return;
                    }
                    response.error = `Automatic detection is only available for external subtitles on Plex. If none are available, try Plex's subtitle search or use your own.`;
                    // if (stream.getAttribute('selected') === '1') {
                    //     if (!selectedSubUrl) {
                    //         response.error = `Could not get trancoding url for internal subtitle. ${internalSubWarn}`;
                    //         return;
                    //     }
                    //     subtitles.push(
                    //         trackFromDef({
                    //             label: stream.getAttribute('extendedDisplayTitle') ?? '',
                    //             language: stream.getAttribute('language') ?? '',
                    //             url: selectedSubUrl,
                    //             extension: stream.getAttribute('codec') ?? '',
                    //         })
                    //     );
                    //     return;
                    // }
                    // if (!response.error) {
                    //     response.error = internalSubWarn;
                    // }
                });
            });
            response.subtitles = subtitles;

            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        },
        false
    );
});
