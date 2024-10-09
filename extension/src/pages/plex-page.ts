import { VideoDataSubtitleTrack } from '@project/common';
import { VideoData } from '@project/common';
import { trackFromDef } from './util';

document.addEventListener(
    'asbplayer-get-synced-data',
    async () => {
        const response: VideoData = { error: '', basename: '', subtitles: [] };
        const miniPlayerWarn =
            'Automatic detection does not work for Plex if you resume playing your previous session from the mini player. Try stopping the video and hitting play on the media directly.';
        const parser = new DOMParser();

        // All the images on the page uses the url we want and also has the token.
        let serverUrl: string | undefined;
        let plexToken: string | undefined;
        const imgTags = document.querySelectorAll('img[src*="plex.direct"]');
        if (!imgTags.length) {
            response.error = `Could not find url to parse token from. ${miniPlayerWarn}`;
            return document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }
        for (const img of imgTags) {
            const src = (img as HTMLImageElement).src;
            serverUrl = src.match(/^.*plex\.direct:\d+/i)?.[0];
            plexToken = src.match(/X-Plex-Token=([^&]*)/i)?.[1];
            if (serverUrl && plexToken) {
                break;
            }
        }
        if (!serverUrl || !plexToken) {
            response.error = `Could not get server URL or token from Plex page. ${miniPlayerWarn}`;
            return document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }

        // Gets ratingKey from the metadata at on the left of the bottom control bar. They are hyperlinks back to the library.
        // Get last item as if it's an episode, the info is series title, then season, then episode num, then episode title.
        // They use the series, season, and episode ratingKeys respectively. Movies only have a single ratingKey.
        const playerMetadata = Array.from(
            document.querySelectorAll('[class*="PlayerControlsMetadata"] a[href*="%2Flibrary%2Fmetadata%2F"]')
        );
        if (!playerMetadata.length) {
            response.error = `Could not get player metadata from Plex page. ${miniPlayerWarn}`;
            return document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }
        const ratingKey = decodeURIComponent(playerMetadata.pop()!.getAttribute('href')!).match(/metadata\/(\d+)/)?.[1];
        if (!ratingKey) {
            response.error = `Could not get ratingKey from Plex page. ${miniPlayerWarn}`;
            return document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }

        let session: string | undefined;
        // const resSession = await fetch(`${serverUrl}/status/sessions?X-Plex-Token=${plexToken}`);
        // if (resSession.ok) {
        //     // Only admin token will have access to this. Likley need to monitor ${serverUrl}/video/:/transcode/universal/subtitles to allow non-admin accounts.
        //     const sessionText = await resSession.text();
        //     const sessionDoc = parser.parseFromString(sessionText, 'application/xml');
        //     const videos = sessionDoc.querySelectorAll('Video');
        //     for (const video of videos) {
        //         if (video.getAttribute('ratingKey') !== ratingKey) {
        //             continue;
        //         }
        //         const key = video.querySelector('TranscodeSession')?.getAttribute('key');
        //         if (!key) {
        //             continue;
        //         }
        //         session = key.split('/').pop();
        //         break;
        //     }
        // }

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
                response.error = `Internal subtitles on Plex are currently not supported for automatic detection. You can use your own subtitles or try Plex's subtitle search.`;
                if (!session) {
                    return;
                }
                if (stream.getAttribute('selected') === '1') {
                    // Internal can only be when transcoding and not burned in. Url request will fail if burned in, user can turn off burn in.
                    subtitles.push(
                        trackFromDef({
                            label: stream.getAttribute('extendedDisplayTitle') ?? '',
                            language: stream.getAttribute('language') ?? '',
                            url: `${serverUrl}/video/:/transcode/universal/subtitles?path=%2Flibrary%2Fmetadata%2F${ratingKey}&session=${session}&X-Plex-Platform=Chrome&X-Plex-Token=${plexToken}`,
                            extension: stream.getAttribute('codec') ?? '',
                        })
                    );
                    return;
                }
                response.error = `Internal subtitles must be currently selected for automatic detection. You can unselect it on the Plex player after asbplayer has it loaded. It also must not be burned in, set "Only image formats" for "Burn Subtitles" in Plex Settings > Player.`;
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
