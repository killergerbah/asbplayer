setTimeout(() => {
    function player() {
        const netflixVideo = netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;

        if (netflixVideo) {
            const playerSessionIds = netflixVideo.getAllPlayerSessionIds();

            if (playerSessionIds.length === 0) {
                console.error('No Netflix player session IDs');
                return null;
            }

            const playerSessionId = playerSessionIds[playerSessionIds.length - 1];
            return netflixVideo.getVideoPlayerBySessionId(playerSessionId);
        }

        console.error('Missing netflix global');
        return null;
    }

    document.addEventListener('asbplayer-netflix-seek', (e) => {
        player()?.seek(e.detail);
    });

    document.addEventListener('asbplayer-netflix-play', (e) => {
        player()?.play();
    });

    document.addEventListener('asbplayer-netflix-pause', (e) => {
        player()?.pause();
    });

    if (
        typeof netflix !== 'undefined' &&
        typeof netflix.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer !== 'undefined'
    ) {
        document.dispatchEvent(
            new CustomEvent('asbplayer-netflix-enabled', {
                detail: true,
            })
        );
    }
}, 0);
