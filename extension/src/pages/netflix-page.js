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

    function storeSubTrack(video) {
        const timedTextracks = video.timedtexttracks || [];

        for (const track of timedTextracks) {
            if (track.isForcedNarrative || track.isNoneTrack || !track.cdnlist?.length || !track.ttDownloadables) {
                continue;
            }

            const webvttDL = track.ttDownloadables[webvtt];

            if (!webvttDL?.downloadUrls) {
                continue;
            }

            const url = webvttDL.downloadUrls[track.cdnlist.find((cdn) => webvttDL.downloadUrls[cdn.id])?.id];

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
        player()?.seek(e.detail);
    });

    document.addEventListener('asbplayer-netflix-play', () => {
        player()?.play();
    });

    document.addEventListener('asbplayer-netflix-pause', () => {
        player()?.pause();
    });

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
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

            const videoApi = getAPI()?.getVideoMetadataByVideoId?.(titleId)?.getCurrentVideo?.();
            const season = (videoApi?.getSeason?.()?.getSeasonIndex?.() ?? -1) + 1;
            const ep = videoApi?.getEpisodeNumber?.();
            const title = videoApi?.getTitle?.() || titleId;
            const storedTracks = subTracks.get(titleId) || new Map();

            response.subtitles = np
                .getTimedTextTrackList()
                .filter((track) => storedTracks.has(track.trackId))
                .map((track) => {
                    return {
                        label: `${track.bcp47} - ${track.displayName}${
                            'CLOSEDCAPTIONS' === track.rawTrackType ? ' [CC]' : ''
                        }`,
                        language: track.bcp47.toLowerCase(),
                        url: storedTracks.get(track.trackId),
                    };
                });
            response.basename = `${title}${
                season ? ` S${`${season}`.padStart(2, '0')}E${`${ep}`.padStart(2, '0')}` : ''
            }`;

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
                    objectValue?.profiles?.unshift(webvtt);
                }
            }

            return originalStringify.apply(this, arguments);
        };

        const originalParse = JSON.parse;
        JSON.parse = function () {
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
