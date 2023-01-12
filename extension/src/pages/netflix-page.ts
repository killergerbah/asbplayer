declare const netflix: any | undefined;

setTimeout(() => {
    const webvtt = 'webvtt-lssdh-ios8';
    const manifestPattern = new RegExp('manifest|licensedManifest');
    const subTracks = new Map();

    function getAPI() {
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
            return undefined;
        }

        return webvttDL.urls[0].url;
    }

    function storeSubTrack(video: any) {
        const timedTextracks = video.timedtexttracks || [];

        for (const track of timedTextracks) {
            const url = extractUrlLegacy(track) ?? extractUrl(track);

            if (!url) {
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

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            const response = { error: '', basename: '', extension: 'nfvtt', subtitles: [] };
            const np = player();
            const titleId = np?.getMovieId();

            if (!np || !titleId) {
                response.error = 'Netflix Player or Title Id not found...';
                return document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            }

            response.basename = await determineBasenameWithRetries(titleId, 5);
            const storedTracks = subTracks.get(titleId) || new Map();
            response.subtitles = np
                .getTimedTextTrackList()
                .filter((track: any) => storedTracks.has(track.trackId))
                .map((track: any) => {
                    return {
                        label: `${track.bcp47} - ${track.displayName}${
                            'CLOSEDCAPTIONS' === track.rawTrackType ? ' [CC]' : ''
                        }`,
                        language: track.bcp47.toLowerCase(),
                        url: storedTracks.get(track.trackId),
                    };
                });

            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        },
        false
    );

    if (getVideoPlayer()) {
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

        document.dispatchEvent(
            new CustomEvent('asbplayer-netflix-enabled', {
                detail: true,
            })
        );
    }
}, 0);
