import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { poll, trackFromDef } from '@/pages/util';

declare const netflix: any | undefined;

export default defineUnlistedScript(() => {
    setTimeout(() => {
        const webvtt = 'webvtt-lssdh-ios8';
        const manifestPattern = new RegExp('manifest|licensedManifest');
        const subTracks = new Map();

        function getAPI() {
            if (typeof netflix === 'undefined') {
                return undefined;
            }

            return netflix?.appContext?.state?.playerApp?.getAPI?.();
        }

        function getVideoPlayer() {
            return getAPI()?.videoPlayer;
        }

        function player() {
            const netflixVideo = getVideoPlayer();

            if (netflixVideo) {
                const playerSessionIds = netflixVideo.getAllPlayerSessionIds?.() || [];

                if (0 === playerSessionIds.length) {
                    console.error('No Netflix player session IDs');
                    return undefined;
                }

                const playerSessionId = playerSessionIds[playerSessionIds.length - 1];
                return netflixVideo.getVideoPlayerBySessionId?.(playerSessionId);
            }

            console.error('Missing netflix global');
            return undefined;
        }

        function extractUrlLegacy(track: any) {
            if (track.isForcedNarrative || track.isNoneTrack || !track.cdnlist?.length || !track.ttDownloadables) {
                return undefined;
            }

            const webvttDL = track.ttDownloadables[webvtt];

            if (!webvttDL?.downloadUrls) {
                return undefined;
            }

            return webvttDL.downloadUrls[track.cdnlist.find((cdn: any) => webvttDL.downloadUrls[cdn.id])?.id];
        }

        function extractUrl(track: any) {
            if (track.isForcedNarrative || track.isNoneTrack || !track.ttDownloadables) {
                return undefined;
            }

            const webvttDL = track.ttDownloadables[webvtt];

            if (!webvttDL?.urls || webvttDL.urls.length === 0) {
                return 'lazy';
            }

            return webvttDL.urls[0].url;
        }

        function storeSubTrack(video: any) {
            const timedTextracks = video.timedtexttracks || [];

            for (const track of timedTextracks) {
                const url = extractUrlLegacy(track) ?? extractUrl(track);

                if (url === undefined) {
                    continue;
                }

                if (!subTracks.has(video.movieId)) {
                    subTracks.set(video.movieId, new Map());
                }

                subTracks.get(video.movieId).set(track.new_track_id, url);
            }
        }

        document.addEventListener('asbplayer-netflix-seek', (e) => {
            player()?.seek((e as CustomEvent).detail);
        });

        document.addEventListener('asbplayer-netflix-play', () => {
            player()?.play();
        });

        document.addEventListener('asbplayer-netflix-pause', () => {
            player()?.pause();
        });

        function determineBasename(titleId: string): [string, boolean] {
            const videoApi = getAPI()?.getVideoMetadataByVideoId?.(titleId)?.getCurrentVideo?.();
            const actualTitle = videoApi?.getTitle?.();

            if (typeof actualTitle !== 'string') {
                return [`${titleId}`, true];
            }

            let basename = actualTitle;

            if (videoApi?.isEpisodic?.() === true) {
                const season = `${videoApi?.getSeason()?._season?.seq}`.padStart(2, '0');
                const ep = `${videoApi?.getEpisodeNumber?.()}`.padStart(2, '0');
                const epTitle = videoApi?.getEpisodeTitle?.();
                basename += ` S${season}E${ep} ${epTitle}`;
            }

            return [basename, false];
        }

        async function determineBasenameWithRetries(titleId: string, retries: number): Promise<string> {
            if (retries <= 0) {
                return `${titleId}`;
            }

            const [basename, shouldRetry] = determineBasename(titleId);

            if (shouldRetry) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return await determineBasenameWithRetries(titleId, --retries);
            }

            return basename;
        }

        const dataForTrack = (track: any, storedTracks: Map<string, string>): VideoDataSubtitleTrack | undefined => {
            if (!track.bcp47) {
                return undefined;
            }

            const isClosedCaptions = 'CLOSEDCAPTIONS' === track.rawTrackType;
            const language = isClosedCaptions ? `${track.bcp47.toLowerCase()}-CC` : track.bcp47.toLowerCase();
            const label = `${track.bcp47} - ${track.displayName}${isClosedCaptions ? ' [CC]' : ''}`;

            return trackFromDef({
                label,
                language,
                // 'lazy' is a sentinel value indicating to the content script that it should
                // make a lazy language-specific request to get the URL
                url: storedTracks.get(track.trackId) ?? 'lazy',
                extension: 'nfvtt',
            });
        };

        const buildResponse = async () => {
            const response: VideoData = { error: '', basename: '', subtitles: [] };
            const np = player();
            const titleId = np?.getMovieId();

            if (!np || !titleId) {
                response.error = 'Netflix Player or Title Id not found...';
                return response;
            }

            response.basename = await determineBasenameWithRetries(titleId, 5);
            const storedTracks = subTracks.get(titleId) || new Map();
            response.subtitles = np
                .getTimedTextTrackList()
                .filter((track: any) => storedTracks.has(track.trackId))
                .map((track: any) => {
                    return dataForTrack(track, storedTracks);
                })
                .filter((data: VideoDataSubtitleTrack | undefined) => data !== undefined);
            return response;
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                const response: VideoData = await buildResponse();

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            },
            false
        );

        const fetchDataForLanguage = async (e: Event) => {
            const fail = (message?: string) => {
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-language-data', {
                        detail: {
                            error: message ?? 'Failed to fetch subtitles for requested language',
                            basename: '',
                            subtitles: [],
                        },
                    })
                );
            };

            const np = player();

            if (np === undefined) {
                fail();
                return;
            }

            const previousTrack = np.getTimedTextTrack();
            let shouldRevert = false;

            try {
                const event = e as CustomEvent;
                const language = event.detail as string;
                const storedTracks = subTracks.get(np.getMovieId()) || new Map();
                const track = np
                    .getTimedTextTrackList()
                    ?.find((track: any) => dataForTrack(track, storedTracks)?.language === language);

                if (track === undefined) {
                    fail();
                    return;
                }

                const alreadyStoredTrack = storedTracks.get(track.trackId);

                if (alreadyStoredTrack !== undefined && alreadyStoredTrack !== 'lazy') {
                    // If track is already stored (e.g. from previous request) then
                    // send response now and early-out
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-language-data', {
                            detail: await buildResponse(),
                        })
                    );
                    return;
                }

                // Trigger tracks to be refetched by temporarily setting the text track to the desired language
                await np.setTimedTextTrack(track);
                shouldRevert = true;

                // Wait for the track to appear
                const succeeded = await poll(() => {
                    const t = storedTracks.get(track.trackId);
                    return t !== undefined && t !== 'lazy';
                });

                if (!succeeded) {
                    fail();
                    return;
                }

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-language-data', {
                        detail: await buildResponse(),
                    })
                );
            } catch (e) {
                fail(e instanceof Error ? e.message : String(e));
            } finally {
                if (shouldRevert && previousTrack !== undefined) {
                    await np.setTimedTextTrack(previousTrack);
                }
            }
        };

        let currentFetchForLanguagePromise: Promise<void> | undefined;

        document.addEventListener(
            'asbplayer-get-synced-language-data',
            // Fetch data for specific language, since Netflix does not provide all URLs in the initial data sync
            async (e) => {
                if (currentFetchForLanguagePromise === undefined) {
                    currentFetchForLanguagePromise = fetchDataForLanguage(e);
                } else {
                    currentFetchForLanguagePromise.then(() => fetchDataForLanguage(e));
                }

                await currentFetchForLanguagePromise;
                currentFetchForLanguagePromise = undefined;
            },
            false
        );

        const originalStringify = JSON.stringify;
        JSON.stringify = function (value) {
            if ('string' === typeof value?.url && -1 < value.url.search(manifestPattern)) {
                for (let objectValue of Object.values(value)) {
                    (objectValue as any)?.profiles?.unshift(webvtt);
                }
            }

            // @ts-ignore
            return originalStringify.apply(this, arguments);
        };

        const originalParse = JSON.parse;
        JSON.parse = function () {
            // @ts-ignore
            const value = originalParse.apply(this, arguments);

            if (value?.result?.movieId) storeSubTrack(value.result);

            return value;
        };

        Function.prototype.apply = new Proxy(Function.prototype.apply, {
            apply: function (target, originalThis, args) {
                if (args && args[1] && typeof args[1][0] === 'string') {
                    const property = args[1][0];

                    if (
                        property === 'preciseSeeking' ||
                        property === 'preciseseeking' ||
                        property === 'preciseseekingontwocoredevice'
                    ) {
                        return true;
                    }
                }

                // @ts-ignore
                return target.call(originalThis, ...args);
            },
        });

        document.addEventListener('asbplayer-query-netflix', async () => {
            const apiAvailable = await poll(() => getVideoPlayer() !== undefined, 30000);
            document.dispatchEvent(
                new CustomEvent('asbplayer-netflix-enabled', {
                    detail: apiAvailable,
                })
            );
        });
    }, 0);
});
