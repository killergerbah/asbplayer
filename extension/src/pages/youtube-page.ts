import { VideoData } from '@project/common';

declare global {
    interface Window {
        trustedTypes?: any;
    }
}

let trustedPolicy: any = undefined;

if (window.trustedTypes !== undefined) {
    trustedPolicy = window.trustedTypes.createPolicy('passThrough', {
        createHTML: (s: string) => s,
        createScript: (s: string) => s,
        createScriptURL: (s: string) => s,
    });

    if (window.trustedTypes.defaultPolicy === null) {
        window.trustedTypes.createPolicy('default', {
            createHTML: (s: string) => s,
            createScript: (s: string) => s,
            createScriptURL: (s: string) => s,
        });
    }
}

document.addEventListener(
    'asbplayer-get-synced-data',
    async () => {
        const response: VideoData = { error: '', basename: '', subtitles: [] };

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
                .then((pageString) => {
                    if (trustedPolicy !== undefined) {
                        pageString = trustedPolicy.createHTML(pageString);
                    }

                    return new window.DOMParser().parseFromString(pageString, 'text/html');
                })
                .then((page) => {
                    const scriptElements = page.body.querySelectorAll('script');

                    for (let i = 0; i < scriptElements.length; ++i) {
                        const elm = scriptElements[i];

                        if (elm.textContent?.includes('ytInitialPlayerResponse')) {
                            let scriptString = `${elm.textContent}; return ytInitialPlayerResponse;`;

                            if (trustedPolicy !== undefined) {
                                scriptString = trustedPolicy.createScript(scriptString);
                            }

                            const context = new Function(scriptString)();

                            if (context) {
                                return context;
                            }
                        }
                    }

                    return undefined;
                });

            if (!playerContext) {
                throw new Error('YT Player Context not found...');
            }

            response.basename = playerContext.videoDetails?.title || document.title;
            response.subtitles = (playerContext?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map(
                (track: any) => {
                    return {
                        label: `${track.languageCode} - ${track.name?.simpleText ?? track.name?.runs?.[0]?.text}`,
                        language: track.languageCode.toLowerCase(),
                        url: track.baseUrl,
                        extension: 'ytxml',
                    };
                }
            );
        } catch (error) {
            if (error instanceof Error) {
                response.error = error.message;
            } else {
                response.error = String(error);
            }
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
