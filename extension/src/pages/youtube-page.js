document.addEventListener(
    'asbplayer-get-external-subtitles',
    async () => {
        const response = { error: '', filename: '', subtitles: [] };

        try {
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

            response.filename = `${playerContext.videoDetails?.title || 'youtube'}.ytxml`;
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
                new CustomEvent('asbplayer-external-subtitles', {
                    detail: response,
                })
            );
        }
    },
    false
);
