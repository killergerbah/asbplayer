import { inferTracks } from '@/pages/util';
import { subtitleTrackSegmentsFromM3U8 } from '@/pages/m3u8-util';

export default defineUnlistedScript(() => {
    const requestMseOffsetEventName = 'asbplayer-get-disney-plus-mse-offset';
    const mseOffsetEventName = 'asbplayer-disney-plus-mse-offset';

    interface MediaSourceOffsetState {
        blobUrl?: string;
        audioOffsetSeconds?: number;
        videoOffsetSeconds?: number;
        updatedAt: number;
        notifiedOffsetMs?: number;
    }

    const stateByMediaSource = new WeakMap<MediaSource, MediaSourceOffsetState>();
    const stateByBlobUrl = new Map<string, MediaSourceOffsetState>();
    const mediaSourceBySourceBuffer = new WeakMap<SourceBuffer, MediaSource>();
    const mimeTypeBySourceBuffer = new WeakMap<SourceBuffer, string>();

    const ensureState = (mediaSource: MediaSource) => {
        let state = stateByMediaSource.get(mediaSource);

        if (state === undefined) {
            state = { updatedAt: 0 };
            stateByMediaSource.set(mediaSource, state);
        }

        return state;
    };

    const validOffsetSeconds = (offsetSeconds: number) =>
        Number.isFinite(offsetSeconds) && Math.abs(offsetSeconds) < 86400;

    const stateOffsetMs = (state: MediaSourceOffsetState | undefined) => {
        if (state === undefined) {
            return undefined;
        }

        const offsetSeconds = state.videoOffsetSeconds ?? state.audioOffsetSeconds;

        if (offsetSeconds === undefined || !validOffsetSeconds(offsetSeconds)) {
            return undefined;
        }

        return Math.round(offsetSeconds * 1000);
    };

    const currentOffsetDetail = () => {
        const candidateVideos = [...document.querySelectorAll('video')].filter((video) => video.src.startsWith('blob:'));
        const currentBlobUrl = candidateVideos[candidateVideos.length - 1]?.src;
        const currentState = currentBlobUrl ? stateByBlobUrl.get(currentBlobUrl) : undefined;
        const offsetMs = stateOffsetMs(currentState);

        if (offsetMs !== undefined) {
            return {
                blobUrl: currentBlobUrl,
                mseBaseOffsetMs: offsetMs,
            };
        }

        let latestBlobUrl: string | undefined = undefined;
        let latestState: MediaSourceOffsetState | undefined = undefined;

        for (const [blobUrl, state] of stateByBlobUrl.entries()) {
            if (latestState === undefined || state.updatedAt > latestState.updatedAt) {
                latestBlobUrl = blobUrl;
                latestState = state;
            }
        }

        const latestOffsetMs = stateOffsetMs(latestState);

        if (latestOffsetMs !== undefined) {
            return {
                blobUrl: latestBlobUrl,
                mseBaseOffsetMs: latestOffsetMs,
            };
        }

        return undefined;
    };

    const dispatchOffset = (state: MediaSourceOffsetState) => {
        const offsetMs = stateOffsetMs(state);

        if (offsetMs === undefined || state.notifiedOffsetMs === offsetMs) {
            return;
        }

        state.notifiedOffsetMs = offsetMs;
        document.dispatchEvent(
            new CustomEvent(mseOffsetEventName, {
                detail: {
                    blobUrl: state.blobUrl,
                    mseBaseOffsetMs: offsetMs,
                },
            })
        );
    };

    const captureOffset = (sourceBuffer: SourceBuffer, offsetSeconds: number) => {
        const mediaSource = mediaSourceBySourceBuffer.get(sourceBuffer);

        if (mediaSource === undefined || !validOffsetSeconds(offsetSeconds)) {
            return;
        }

        const state = ensureState(mediaSource);
        state.updatedAt = Date.now();

        if (mimeTypeBySourceBuffer.get(sourceBuffer)?.startsWith('video/')) {
            state.videoOffsetSeconds = offsetSeconds;
        } else {
            state.audioOffsetSeconds = offsetSeconds;
        }

        dispatchOffset(state);
    };

    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (object: Blob | MediaSource) {
        const blobUrl = originalCreateObjectURL(object);

        if (object instanceof MediaSource) {
            const state = ensureState(object);
            state.blobUrl = blobUrl;
            state.updatedAt = Date.now();
            stateByBlobUrl.set(blobUrl, state);
            dispatchOffset(state);
        }

        return blobUrl;
    };

    const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function (mimeType: string) {
        const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);
        mediaSourceBySourceBuffer.set(sourceBuffer, this);
        mimeTypeBySourceBuffer.set(sourceBuffer, mimeType);
        return sourceBuffer;
    };

    const timestampOffsetDescriptor = Object.getOwnPropertyDescriptor(SourceBuffer.prototype, 'timestampOffset');

    if (timestampOffsetDescriptor?.set && timestampOffsetDescriptor.get) {
        Object.defineProperty(SourceBuffer.prototype, 'timestampOffset', {
            configurable: timestampOffsetDescriptor.configurable ?? true,
            enumerable: timestampOffsetDescriptor.enumerable ?? false,
            get() {
                return timestampOffsetDescriptor.get!.call(this);
            },
            set(value: number) {
                timestampOffsetDescriptor.set!.call(this, value);
                captureOffset(this, value);
            },
        });
    }

    document.addEventListener(requestMseOffsetEventName, () => {
        const detail = currentOffsetDetail();

        if (detail !== undefined) {
            document.dispatchEvent(new CustomEvent(mseOffsetEventName, { detail }));
        }
    });

    setTimeout(() => {
        let lastM3U8Url: string | undefined = undefined;
        let lastBasename: string | undefined = undefined;
        const originalParse = JSON.parse;
        JSON.parse = function () {
            // @ts-ignore
            const value = originalParse.apply(this, arguments);
            if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
                const url = value.stream.sources[0].complete?.url;

                if (url) {
                    lastM3U8Url = url;
                }
            }

            if (value?.data?.playerExperience?.title) {
                lastBasename = value?.data?.playerExperience?.title;
                if (value?.data?.playerExperience?.subtitle) {
                    lastBasename += ` ${value?.data?.playerExperience?.subtitle}`;
                }
            }
            return value;
        };
        inferTracks(
            {
                onRequest: async (addTrack, setBasename) => {
                    if (lastBasename !== undefined) {
                        setBasename(lastBasename);
                    }

                    if (lastM3U8Url !== undefined) {
                        const tracks = await subtitleTrackSegmentsFromM3U8(lastM3U8Url);

                        for (const track of tracks) {
                            addTrack(track);
                        }
                    }
                },
                waitForBasename: false,
            },
            60_000
        );
    }, 0);
});
