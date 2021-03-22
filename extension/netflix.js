setTimeout(() => {
    document.addEventListener('asbplayer-netflix-seek', (e) => {
        const netflixVideo = netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;

        if (netflixVideo) {
            const playerSessionIds = netflixVideo.getAllPlayerSessionIds();

            if (playerSessionIds.length === 0) {
                console.error("No Netflix player session IDs");
            }

            const playerSessionId = playerSessionIds[playerSessionIds.length - 1];
            const player = netflixVideo.getVideoPlayerBySessionId(playerSessionId);
            player.seek(e.detail);
        } else {
            console.error("Missing netflix global, unable to seek");
        }
    });

    if (typeof netflix !== 'undefined') {
        document.dispatchEvent(new CustomEvent('asbplayer-netflix-enabled', {
            detail: true
        }));
    }
}, 0);