document.addEventListener(
    'asbplayer-get-synced-data',
    async () => {
        const response = { error: '', basename: '', extension: 'ytxml', subtitles: [] };

        try {
            const urlObj = new URL(window.location.href);

            if (!urlObj.pathname.startsWith('/watch')) {
                return;
            }

            const playerContext = await fetch(window.location.href)
                .then((webResponse) => {
                    if (!webResponse.ok) {
                        throw new Error(
                            `YT Context Retrieval failed with Status ${webResponse.status}/${webResponse.statusText}...`
                        );
                    }
                    return webResponse.text();
                })
                .then((pageString) => new window.DOMParser().parseFromString(pageString, 'text/html'))
                .then((page) => {
                    const playerScript = [...page.body.querySelectorAll('script')].find((elm) =>
                        elm.textContent.includes('ytInitialPlayerResponse')
                    );

                    if (!playerScript) {
                        throw new Error('YT Player Context not found...');
                    }

                    return new Function(`${playerScript.textContent}; return ytInitialPlayerResponse;`)();
                });

            if (!playerContext) {
                throw new Error('YT Player Context not found...');
            }

            response.basename = playerContext.videoDetails?.title || document.title;
            response.subtitles = (playerContext?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map(
                (track) => {
                    return {
                        label: `${track.languageCode} - ${track.name?.simpleText}`,
                        language: track.languageCode.toLowerCase(),
                        url: track.baseUrl,
                    };
                }
            );
        } catch (error) {
            response.error = error.message;
        } finally {
            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }
    },
    false
);
