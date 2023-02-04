import { VideoDataSubtitleTrack } from '@project/common';

export function extractExtension(url: string, fallback: string) {
    const dotIndex = url.lastIndexOf('.');
    let extension = fallback;

    if (dotIndex !== -1) {
        extension = url.substring(dotIndex + 1);
    }

    return extension;
}

export function poll(test: () => boolean, timeout: number = 10000): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        if (test()) {
            resolve(true);
        }

        const t0 = Date.now();
        let passed = false;

        while (!passed && Date.now() < t0 + timeout) {
            await new Promise<void>((loopResolve) => {
                setTimeout(() => {
                    passed = test();
                    loopResolve();
                }, 1000);
            });
        }

        resolve(passed);
    });
}

type SubtitlesByPath = { [key: string]: VideoDataSubtitleTrack[] };

export interface InferHooks {
    onJson: (
        value: any,
        addTrack: (track: VideoDataSubtitleTrack) => void,
        setBasename: (basename: string) => void
    ) => void;
    onRequest?: (addTrack: (track: VideoDataSubtitleTrack) => void, setBasename: (basename: string) => void) => void;
    waitForBasename: boolean;
}

export function inferTracksFromJson({ onJson, onRequest, waitForBasename }: InferHooks) {
    setTimeout(() => {
        const subtitlesByPath: SubtitlesByPath = {};
        let basename = '';
        let trackDataRequestHandled = false;

        const originalParse = JSON.parse;

        JSON.parse = function () {
            // @ts-ignore
            const value = originalParse.apply(this, arguments);
            let tracksFound = false;
            let basenameFound = false;

            onJson(
                value,
                (track) => {
                    const path = window.location.pathname;

                    if (typeof subtitlesByPath[path] === 'undefined') {
                        subtitlesByPath[path] = [];
                    }

                    if (
                        subtitlesByPath[path].find((s) => s.label === track.label && s.language === track.language) ===
                        undefined
                    ) {
                        subtitlesByPath[path].push(track);
                        tracksFound = true;
                    }
                },
                (theBasename) => {
                    basename = theBasename;
                    basenameFound = true;
                }
            );

            if (trackDataRequestHandled && (tracksFound || basenameFound)) {
                // Only notify additional tracks after the initial request for track info
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: basename,
                            subtitles: subtitlesByPath[window.location.pathname],
                        },
                    })
                );
            }

            return value;
        };

        function garbageCollect() {
            for (const path of Object.keys(subtitlesByPath)) {
                if (path !== window.location.pathname) {
                    delete subtitlesByPath[path];
                }
            }
        }

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                onRequest?.(
                    (track) => {
                        const path = window.location.pathname;

                        if (typeof subtitlesByPath[path] === 'undefined') {
                            subtitlesByPath[path] = [];
                        }

                        if (
                            subtitlesByPath[path].find(
                                (s) => s.label === track.label && s.language === track.language
                            ) === undefined
                        ) {
                            subtitlesByPath[path].push(track);
                        }
                    },
                    (theBasename) => {
                        basename = theBasename;
                        if (!trackDataRequestHandled) {
                            // Notify basename even if still waiting for subtitle track info
                            document.dispatchEvent(
                                new CustomEvent('asbplayer-synced-data', {
                                    detail: {
                                        error: '',
                                        basename: basename,
                                        subtitles: undefined,
                                    },
                                })
                            );
                        }
                    }
                );

                const ready = () =>
                    (!waitForBasename || basename !== '') && window.location.pathname in subtitlesByPath;

                if (!ready()) {
                    await poll(ready);
                }

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: basename,
                            subtitles: subtitlesByPath[window.location.pathname] ?? [],
                        },
                    })
                );

                garbageCollect();
                trackDataRequestHandled = true;
            },
            false
        );
    }, 0);
}
