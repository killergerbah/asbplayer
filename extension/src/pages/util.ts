import { VideoDataSubtitleTrack } from '@project/common';

export function extractExtension(url: string, fallback: string) {
    const dotIndex = url.lastIndexOf('.');
    let extension = fallback;

    if (dotIndex !== -1) {
        extension = url.substring(dotIndex + 1);
    }

    return extension;
}

export function poll(test: () => boolean, timeout: number = 10000) {
    return new Promise<void>(async (resolve, reject) => {
        if (test()) {
            resolve();
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

        resolve();
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
        let waiting = false;

        const originalParse = JSON.parse;

        JSON.parse = function () {
            // @ts-ignore
            const value = originalParse.apply(this, arguments);
            let tracksFound = false;

            onJson(
                value,
                (track) => {
                    if (typeof subtitlesByPath[window.location.pathname] === 'undefined') {
                        subtitlesByPath[window.location.pathname] = [];
                    }

                    if (
                        subtitlesByPath[window.location.pathname].find(
                            (s) => s.label === track.label && s.language === track.language
                        ) === undefined
                    ) {
                        subtitlesByPath[window.location.pathname].push(track);
                        tracksFound = true;
                    }
                },
                (theBasename) => {
                    basename = theBasename;
                }
            );

            if (!waiting && tracksFound) {
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: basename,
                            subtitles: subtitlesByPath[window.location.pathname] ?? [],
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
                        if (typeof subtitlesByPath[window.location.pathname] === 'undefined') {
                            subtitlesByPath[window.location.pathname] = [];
                        }

                        if (
                            subtitlesByPath[window.location.pathname].find(
                                (s) => s.label === track.label && s.language === track.language
                            ) === undefined
                        ) {
                            subtitlesByPath[window.location.pathname].push(track);
                        }
                    },
                    (theBasename) => {
                        basename = theBasename;
                    }
                );

                const ready = () =>
                    (!waitForBasename || basename !== '') && window.location.pathname in subtitlesByPath;

                if (!ready()) {
                    waiting = true;
                    await poll(ready);
                    waiting = false;
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
            },
            false
        );
    }, 0);
}
