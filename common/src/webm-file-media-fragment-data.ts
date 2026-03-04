import {
    CancelledMediaFragmentDataRenderingError,
    createVideoElement,
    disposeVideoElement,
    makeMediaFragmentFileName,
    minWebmMediaFragmentDurationMs,
    type MediaFragmentData,
    preferredWebmMediaFragmentMimeType,
    mediaFragmentErrorForFile,
} from './media-fragment';
import { FileModel, MediaFragmentErrorCode } from './model';

const videoSeekEpsilonSeconds = 0.001;
const defaultCaptureFrameRate = 24;
const minWebmVideoBitsPerSecond = 1_000_000;
const maxWebmVideoBitsPerSecond = 24_000_000;
const minVp9WebmVideoBitsPerSecond = 2_000_000;
const defaultFrameRateSamplingCount = 8;
const maxCaptureFrameRate = 120;
const videoSeekTimeoutMs = 3_000;
const frameRateSamplingTimeoutMs = 3_000;
const frameRenderWatchdogTimeoutMs = 3_000;
const frameRateSamplingPlaybackRate = 0.5;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const durationFromInterval = (startTimestamp: number, endTimestamp: number) => {
    const duration = Math.abs(endTimestamp - startTimestamp);
    return Math.max(minWebmMediaFragmentDurationMs, duration);
};

const normalizeDimension = (value: number) => {
    const floored = Math.max(1, Math.floor(value));

    if (floored <= 2) {
        return floored;
    }

    return floored - (floored % 2);
};

const targetBitsPerPixelForMimeType = (mimeType: string) => {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes('av1')) {
        return 0.04;
    }

    if (normalizedMimeType.includes('vp9')) {
        return 0.06;
    }

    return 0.1;
};

const minBitsPerSecondForMimeType = (mimeType: string) => {
    if (mimeType.toLowerCase().includes('vp9')) {
        return minVp9WebmVideoBitsPerSecond;
    }

    return minWebmVideoBitsPerSecond;
};

const estimateVideoBitsPerSecond = (width: number, height: number, frameRate: number, mimeType: string) => {
    const estimated = Math.round(width * height * frameRate * targetBitsPerPixelForMimeType(mimeType));
    return clamp(estimated, minBitsPerSecondForMimeType(mimeType), maxWebmVideoBitsPerSecond);
};

const frameRateFromDeltas = (deltas: number[]) => {
    const validDeltas = deltas.filter((delta) => Number.isFinite(delta) && delta > 0);
    if (validDeltas.length <= 0) {
        return defaultCaptureFrameRate;
    }

    const sortedDeltas = [...validDeltas].sort((a, b) => a - b);
    // Use lower-third deltas so dropped/late frames have less influence.
    const lowWindowSize = Math.max(2, Math.ceil(sortedDeltas.length / 3));
    const lowWindow = sortedDeltas.slice(0, lowWindowSize);
    const representativeDelta = lowWindow.reduce((sum, delta) => sum + delta, 0) / lowWindow.length;
    return clamp(Math.round(1 / representativeDelta), 1, maxCaptureFrameRate);
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
    await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Could not read blob as data URL'));
        reader.readAsDataURL(blob);
    });

type RenderCanvasContext = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
};

type CaptureStreamSetup = {
    stream: MediaStream;
    captureTrack?: CanvasCaptureMediaStreamTrack;
};

type RecorderSetup = {
    recorder: MediaRecorder;
    recorderStarted: Promise<void>;
    stopRecorder: Promise<Blob>;
};

type FrameLoopSetup = {
    video: HTMLVideoElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    captureTrack?: CanvasCaptureMediaStreamTrack;
    startTimestampMs: number;
    targetEndTimestampMs: number;
    fallbackFrameDelayMs: number;
    renderWatchdogTimeoutMs: number;
};

type WebmCaptureSettings = {
    mimeType: string;
    captureMode: 'manual-request-frame' | 'timed-capture-stream';
    sourceWidth: number;
    sourceHeight: number;
    outputWidth: number;
    outputHeight: number;
    startTimestampMs: number;
    endTimestampMs: number;
    durationMs: number;
    captureFrameRate: number;
    fallbackFrameDelayMs: number;
    targetBitsPerPixel: number;
    minBitsPerSecond: number;
    videoBitsPerSecond: number;
    renderWatchdogTimeoutMs: number;
};

type FrameSchedulerMode = 'video-frame-callback' | 'animation-frame' | 'timeout';

export class WebmFileMediaFragmentData implements MediaFragmentData {
    private readonly _file: FileModel;
    private readonly _startTimestamp: number;
    private readonly _durationMs: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _baseName: string;
    private _video?: HTMLVideoElement;
    private _canvas?: HTMLCanvasElement;
    private _ctx?: CanvasRenderingContext2D;
    private _blobPromise?: Promise<Blob>;
    private _blobPromiseReject?: (error: Error) => void;
    private _cachedBlob?: Blob;
    private _cachedDataUrl?: string;

    constructor(
        file: FileModel,
        startTimestamp: number,
        endTimestamp: number,
        maxWidth: number,
        maxHeight: number,
        video: HTMLVideoElement | undefined,
        canvas: HTMLCanvasElement | undefined,
        ctx?: CanvasRenderingContext2D
    ) {
        this._file = file;
        this._startTimestamp = Math.max(0, startTimestamp);
        this._durationMs = durationFromInterval(startTimestamp, endTimestamp);
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
        this._baseName = makeMediaFragmentFileName(file.name, this._startTimestamp);
        this._video = video;
        this._canvas = canvas;
        this._ctx = ctx;
    }

    get name() {
        return `${this._baseName}.webm`;
    }

    get timestamp() {
        return this._startTimestamp;
    }

    get extension() {
        return 'webm';
    }

    get error(): MediaFragmentErrorCode | undefined {
        return mediaFragmentErrorForFile(this._file);
    }

    atTimestamp(timestamp: number) {
        if (timestamp === this._startTimestamp) {
            return this;
        }

        this._blobPromiseReject?.(new CancelledMediaFragmentDataRenderingError());
        return new WebmFileMediaFragmentData(
            this._file,
            timestamp,
            timestamp + this._durationMs,
            this._maxWidth,
            this._maxHeight,
            this._video,
            this._canvas,
            this._ctx
        );
    }

    get canChangeTimestamp() {
        return true;
    }

    async base64() {
        const dataUrl = await this.dataUrl();
        return dataUrl.substring(dataUrl.indexOf(',') + 1);
    }

    async dataUrl() {
        if (this._cachedDataUrl) {
            return this._cachedDataUrl;
        }

        this._cachedDataUrl = await blobToDataUrl(await this.blob());
        return this._cachedDataUrl;
    }

    async blob(): Promise<Blob> {
        if (this._cachedBlob) {
            return this._cachedBlob;
        }

        if (this._blobPromise) {
            return this._blobPromise;
        }

        const blobPromise = new Promise<Blob>((resolve, reject) => {
            this._blobPromiseReject = (error) => {
                // Allow a clean retry after cancellation/failure.
                this._blobPromise = undefined;
                reject(error);
            };
            this._renderWebm().then(resolve, reject);
        })
            .then((blob) => {
                this._cachedBlob = blob;
                return blob;
            })
            .catch((error) => {
                this._blobPromise = undefined;
                throw error;
            })
            .finally(() => {
                this._blobPromiseReject = undefined;
            });

        this._blobPromise = blobPromise;
        return blobPromise;
    }

    private async _renderWebm(): Promise<Blob> {
        const mimeType = preferredWebmMediaFragmentMimeType();
        if (!mimeType || typeof MediaRecorder === 'undefined') {
            throw new Error('WebM capture is not supported in this browser');
        }
        console.info(`[MediaFragment] Using WebM codec: ${mimeType}`);
        if (!mimeType.includes('av1')) {
            console.info(`[MediaFragment] WebM codec fallback triggered: preferred AV1 unavailable, using ${mimeType}`);
        }

        const video = await this._videoElement(this._file);
        const { width, height } = this._dimensions(video);
        const { canvas, ctx } = this._setupCanvasContext(video, width, height);

        const maxVideoDurationMs = Number.isFinite(video.duration)
            ? Math.max(0, video.duration * 1000)
            : this._startTimestamp + this._durationMs;
        const startTimestampMs = clamp(this._startTimestamp, 0, maxVideoDurationMs);
        const targetEndTimestampMs = clamp(startTimestampMs + this._durationMs, startTimestampMs, maxVideoDurationMs);
        const captureFrameRate = await this._sampleCaptureFrameRate(video, startTimestampMs / 1000);
        const fallbackFrameDelayMs = Math.max(1, Math.round(1000 / captureFrameRate));
        const videoBitsPerSecond = estimateVideoBitsPerSecond(width, height, captureFrameRate, mimeType);
        // Per-frame stall watchdog (not a total render budget).
        const renderWatchdogTimeoutMs = frameRenderWatchdogTimeoutMs;

        const chunks: BlobPart[] = [];
        let stream: MediaStream | undefined;
        let mediaRecorder: MediaRecorder | undefined;
        let stopRecorder: Promise<Blob> | undefined;
        let recorderStarted: Promise<void> | undefined;
        let captureTrack: CanvasCaptureMediaStreamTrack | undefined;

        const originalPlaybackRate = video.playbackRate;
        const originalMuted = video.muted;
        const originalVolume = video.volume;
        const originalOnError = video.onerror;
        const originalOnEnded = video.onended;
        const videoWithPreservesPitch = video as HTMLVideoElement & { preservesPitch?: boolean };
        const originalPreservesPitch = videoWithPreservesPitch.preservesPitch;

        try {
            const captureStreamSetup = this._setupCaptureStream(canvas, captureFrameRate);
            stream = captureStreamSetup.stream;
            captureTrack = captureStreamSetup.captureTrack;

            this._logWebmCaptureSettings({
                mimeType,
                captureMode: captureTrack ? 'manual-request-frame' : 'timed-capture-stream',
                sourceWidth: video.videoWidth,
                sourceHeight: video.videoHeight,
                outputWidth: width,
                outputHeight: height,
                startTimestampMs,
                endTimestampMs: targetEndTimestampMs,
                durationMs: Math.max(0, targetEndTimestampMs - startTimestampMs),
                captureFrameRate,
                fallbackFrameDelayMs,
                targetBitsPerPixel: targetBitsPerPixelForMimeType(mimeType),
                minBitsPerSecond: minBitsPerSecondForMimeType(mimeType),
                videoBitsPerSecond,
                renderWatchdogTimeoutMs,
            });

            const recorderSetup = this._setupRecorder(stream, mimeType, videoBitsPerSecond, chunks);
            mediaRecorder = recorderSetup.recorder;
            recorderStarted = recorderSetup.recorderStarted;
            stopRecorder = recorderSetup.stopRecorder;

            await this._seekVideo(video, startTimestampMs / 1000);

            video.muted = true;
            video.volume = 0;
            video.playbackRate = 1;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = false;
            }

            mediaRecorder.start();
            if (mediaRecorder.state !== 'recording') {
                await recorderStarted;
            }

            await this._runFrameLoop({
                video,
                ctx,
                width,
                height,
                captureTrack,
                startTimestampMs,
                targetEndTimestampMs,
                fallbackFrameDelayMs,
                renderWatchdogTimeoutMs,
            });

            video.pause();

            const blob = await this._stopAndFlushRecorder(mediaRecorder, stopRecorder);
            if (!blob || blob.size <= 0) {
                throw new Error('Could not encode WebM from local video');
            }
            mediaRecorder = undefined;
            stopRecorder = undefined;

            return blob;
        } finally {
            video.pause();
            video.playbackRate = originalPlaybackRate;
            video.muted = originalMuted;
            video.volume = originalVolume;
            video.onerror = originalOnError;
            video.onended = originalOnEnded;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = originalPreservesPitch;
            }

            await this._stopAndFlushRecorder(mediaRecorder, stopRecorder).catch(() => undefined);

            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        }
    }

    private _setupCanvasContext(video: HTMLVideoElement, width: number, height: number): RenderCanvasContext {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
        }

        const canvas = this._canvas;
        if (typeof canvas.captureStream !== 'function') {
            throw new Error('WebM capture stream is not supported in this browser');
        }

        canvas.width = width;
        canvas.height = height;

        if (!this._ctx || this._ctx.canvas !== canvas) {
            this._ctx = canvas.getContext('2d') ?? undefined;
        }

        if (!this._ctx) {
            throw new Error('Could not create WebM capture canvas context');
        }

        const scalingRatio = Math.min(width / Math.max(1, video.videoWidth), height / Math.max(1, video.videoHeight));
        this._ctx.imageSmoothingEnabled = scalingRatio < 0.9;
        this._ctx.imageSmoothingQuality = 'medium';

        return {
            canvas,
            ctx: this._ctx,
        };
    }

    private _setupCaptureStream(canvas: HTMLCanvasElement, captureFrameRate: number): CaptureStreamSetup {
        let manualCaptureStream: MediaStream | undefined;
        try {
            manualCaptureStream = canvas.captureStream(0);
        } catch (_) {
            manualCaptureStream = undefined;
        }

        const manualCaptureTrack = manualCaptureStream?.getVideoTracks()[0] as
            | CanvasCaptureMediaStreamTrack
            | undefined;

        if (manualCaptureStream && manualCaptureTrack && typeof manualCaptureTrack.requestFrame === 'function') {
            return {
                stream: manualCaptureStream,
                captureTrack: manualCaptureTrack,
            };
        }

        console.info(
            `[MediaFragment] Capture-stream fallback triggered: requestFrame unavailable, using timed capture at ${captureFrameRate}fps`
        );

        for (const track of manualCaptureStream?.getTracks() ?? []) {
            track.stop();
        }

        return {
            stream: canvas.captureStream(captureFrameRate),
            captureTrack: undefined,
        };
    }

    private _setupRecorder(
        stream: MediaStream,
        mimeType: string,
        videoBitsPerSecond: number,
        chunks: BlobPart[]
    ): RecorderSetup {
        const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond,
        });

        let resolveRecorderStarted: (() => void) | undefined;
        const recorderStarted = new Promise<void>((resolve) => {
            resolveRecorderStarted = resolve;
        });
        const stopRecorder = new Promise<Blob>((resolve, reject) => {
            recorder.onstart = () => {
                resolveRecorderStarted?.();
                resolveRecorderStarted = undefined;
            };
            recorder.onerror = (event) => {
                resolveRecorderStarted?.();
                resolveRecorderStarted = undefined;
                const error = event.error;
                reject(error instanceof Error ? error : new Error('Could not encode WebM'));
            };
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        });

        return {
            recorder,
            recorderStarted,
            stopRecorder,
        };
    }

    private async _runFrameLoop({
        video,
        ctx,
        width,
        height,
        captureTrack,
        startTimestampMs,
        targetEndTimestampMs,
        fallbackFrameDelayMs,
        renderWatchdogTimeoutMs,
    }: FrameLoopSetup): Promise<void> {
        let videoFrameCallbackHandle: number | undefined;
        let animationFrameHandle: number | undefined;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

        const clearScheduledFrame = () => {
            if (videoFrameCallbackHandle !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
                video.cancelVideoFrameCallback(videoFrameCallbackHandle);
                videoFrameCallbackHandle = undefined;
            }

            if (animationFrameHandle !== undefined) {
                cancelAnimationFrame(animationFrameHandle);
                animationFrameHandle = undefined;
            }

            if (fallbackTimer !== undefined) {
                clearTimeout(fallbackTimer);
                fallbackTimer = undefined;
            }
        };

        const drawFrame = () => {
            ctx.drawImage(video, 0, 0, width, height);
            captureTrack?.requestFrame();
        };
        const frameSchedulerMode: FrameSchedulerMode =
            typeof video.requestVideoFrameCallback === 'function'
                ? 'video-frame-callback'
                : typeof requestAnimationFrame === 'function'
                  ? 'animation-frame'
                  : 'timeout';
        if (frameSchedulerMode !== 'video-frame-callback') {
            const fallbackLabel = frameSchedulerMode === 'animation-frame' ? 'requestAnimationFrame' : 'setTimeout';
            console.info(`[MediaFragment] Frame-scheduler fallback triggered: using ${fallbackLabel}`);
        }
        const done = (mediaTimeSeconds?: number) => {
            const mediaTimeMs = (mediaTimeSeconds ?? video.currentTime) * 1000;
            // Fallback schedulers can observe a slightly stale currentTime, so bias the end threshold a bit earlier.
            const thresholdMs =
                mediaTimeSeconds === undefined
                    ? Math.max(startTimestampMs, targetEndTimestampMs - fallbackFrameDelayMs / 2)
                    : targetEndTimestampMs;
            return mediaTimeMs >= thresholdMs;
        };
        const schedule = (onFrame: (mediaTimeSeconds?: number) => void) => {
            if (frameSchedulerMode === 'video-frame-callback') {
                videoFrameCallbackHandle = video.requestVideoFrameCallback((_, metadata) =>
                    onFrame(metadata.mediaTime)
                );
                return;
            }

            if (frameSchedulerMode === 'animation-frame') {
                animationFrameHandle = requestAnimationFrame(() => onFrame());
                return;
            }

            fallbackTimer = setTimeout(onFrame, fallbackFrameDelayMs);
        };

        drawFrame();
        await video.play();

        try {
            await new Promise<void>((resolve, reject) => {
                let settled = false;
                let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
                const clearWatchdog = () => {
                    if (watchdogTimer !== undefined) {
                        clearTimeout(watchdogTimer);
                        watchdogTimer = undefined;
                    }
                };
                const armWatchdog = () => {
                    clearWatchdog();
                    watchdogTimer = setTimeout(() => {
                        fail(new Error(`WebM rendering timed out after ${renderWatchdogTimeoutMs}ms`));
                    }, renderWatchdogTimeoutMs);
                };
                const finish = () => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    clearWatchdog();
                    clearScheduledFrame();
                    resolve();
                };
                const fail = (error: Error) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    clearWatchdog();
                    clearScheduledFrame();
                    reject(error);
                };

                const onFrame = (mediaTimeSeconds?: number) => {
                    try {
                        if (done(mediaTimeSeconds)) {
                            finish();
                            return;
                        }

                        drawFrame();

                        if (done(mediaTimeSeconds)) {
                            finish();
                            return;
                        }

                        armWatchdog();
                        schedule(onFrame);
                    } catch (error) {
                        fail(error instanceof Error ? error : new Error(String(error)));
                    }
                };

                video.onerror = () => fail(new Error(video.error?.message ?? 'Could not play video to capture WebM'));
                video.onended = () => finish();
                armWatchdog();
                schedule(onFrame);
            });
        } finally {
            clearScheduledFrame();
        }
    }

    private _dimensions(video: HTMLVideoElement) {
        if (video.videoWidth <= 0 || video.videoHeight <= 0) {
            throw new Error('Could not determine source video dimensions for WebM capture');
        }

        const widthRatio = this._maxWidth <= 0 ? 1 : this._maxWidth / video.videoWidth;
        const heightRatio = this._maxHeight <= 0 ? 1 : this._maxHeight / video.videoHeight;
        const ratio = Math.min(1, Math.min(widthRatio, heightRatio));

        return {
            width: normalizeDimension(video.videoWidth * ratio),
            height: normalizeDimension(video.videoHeight * ratio),
        };
    }

    private async _sampleCaptureFrameRate(
        video: HTMLVideoElement,
        startTimestampSeconds: number,
        sampleCount: number = defaultFrameRateSamplingCount
    ): Promise<number> {
        if (typeof video.requestVideoFrameCallback !== 'function') {
            console.info(
                `[MediaFragment] Frame-rate sampling fallback triggered: requestVideoFrameCallback unavailable, using ${defaultCaptureFrameRate}fps`
            );
            return defaultCaptureFrameRate;
        }

        const resolvedSampleCount = Math.max(1, Math.floor(sampleCount));
        const originalPlaybackRate = video.playbackRate;
        const originalMuted = video.muted;
        const originalVolume = video.volume;
        const originalOnError = video.onerror;
        const originalOnEnded = video.onended;
        const videoWithPreservesPitch = video as HTMLVideoElement & { preservesPitch?: boolean };
        const originalPreservesPitch = videoWithPreservesPitch.preservesPitch;
        let videoFrameCallbackHandle: number | undefined;

        try {
            await this._seekVideo(video, startTimestampSeconds);
            video.muted = true;
            video.volume = 0;
            video.playbackRate = frameRateSamplingPlaybackRate;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = false;
            }

            const frameRate = await new Promise<number>((resolve, reject) => {
                const deltas: number[] = [];
                let lastMediaTime: number | undefined;
                let timeout: ReturnType<typeof setTimeout> | undefined;
                let settled = false;
                const resolveSampledFrameRate = () => {
                    finish(frameRateFromDeltas(deltas));
                };

                const cleanup = () => {
                    if (timeout !== undefined) {
                        clearTimeout(timeout);
                        timeout = undefined;
                    }

                    if (
                        videoFrameCallbackHandle !== undefined &&
                        typeof video.cancelVideoFrameCallback === 'function'
                    ) {
                        video.cancelVideoFrameCallback(videoFrameCallbackHandle);
                        videoFrameCallbackHandle = undefined;
                    }
                };
                const finish = (value: number) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    resolve(value);
                };
                const fail = (error: Error) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    reject(error);
                };

                timeout = setTimeout(() => {
                    fail(new Error(`Could not sample frame rate within ${frameRateSamplingTimeoutMs}ms`));
                }, frameRateSamplingTimeoutMs);

                const sample = (_: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
                    if (lastMediaTime !== undefined) {
                        const delta = metadata.mediaTime - lastMediaTime;
                        if (Number.isFinite(delta) && delta > 0) {
                            deltas.push(delta);
                        }
                    }

                    lastMediaTime = metadata.mediaTime;

                    if (deltas.length >= resolvedSampleCount) {
                        resolveSampledFrameRate();
                        return;
                    }

                    videoFrameCallbackHandle = video.requestVideoFrameCallback(sample);
                };

                video.onerror = () => {
                    fail(new Error(video.error?.message ?? 'Could not sample frame rate from video'));
                };
                video.onended = () => {
                    if (deltas.length > 0) {
                        console.info(
                            `[MediaFragment] Frame-rate sampling fallback triggered: source ended early; resolving from ${deltas.length} sampled delta(s)`
                        );
                        resolveSampledFrameRate();
                        return;
                    }

                    fail(new Error('Video ended before frame rate sampling completed'));
                };
                videoFrameCallbackHandle = video.requestVideoFrameCallback(sample);
                video.play().catch((error) => {
                    fail(error instanceof Error ? error : new Error(String(error)));
                });
            });

            return frameRate;
        } catch (error) {
            console.warn(
                `[MediaFragment] Falling back to default capture frame rate (${defaultCaptureFrameRate}fps)`,
                error
            );
            return defaultCaptureFrameRate;
        } finally {
            if (videoFrameCallbackHandle !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
                video.cancelVideoFrameCallback(videoFrameCallbackHandle);
                videoFrameCallbackHandle = undefined;
            }

            video.pause();
            video.playbackRate = originalPlaybackRate;
            video.muted = originalMuted;
            video.volume = originalVolume;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = originalPreservesPitch;
            }

            video.onerror = originalOnError;
            video.onended = originalOnEnded;
        }
    }

    private async _stopAndFlushRecorder(
        recorder: MediaRecorder | undefined,
        stopRecorder: Promise<Blob> | undefined
    ): Promise<Blob | undefined> {
        if (!recorder || !stopRecorder) {
            return undefined;
        }

        if (recorder.state !== 'inactive') {
            recorder.stop();
        }

        return await stopRecorder;
    }

    private _logWebmCaptureSettings(settings: WebmCaptureSettings) {
        console.info('[MediaFragment] WebM capture settings', settings);
    }

    private async _seekVideo(video: HTMLVideoElement, timestamp: number): Promise<void> {
        return await new Promise<void>((resolve, reject) => {
            const maxTimestamp = Number.isFinite(video.duration) ? video.duration : timestamp;
            const seekTo = clamp(timestamp, 0, maxTimestamp);
            let timeout: ReturnType<typeof setTimeout> | undefined;
            let settled = false;
            const cleanup = () => {
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                    timeout = undefined;
                }

                video.onseeked = null;
                video.onerror = null;
            };
            const finish = () => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                resolve();
            };
            const fail = (error: Error) => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                reject(error);
            };
            const resolveWithCleanup = () => {
                finish();
            };

            video.onseeked = resolveWithCleanup;
            video.onerror = () => fail(new Error(video.error?.message ?? 'Could not seek video to create WebM'));
            timeout = setTimeout(() => {
                fail(new Error(`Video seek timed out after ${videoSeekTimeoutMs}ms`));
            }, videoSeekTimeoutMs);

            if (Math.abs(video.currentTime - seekTo) <= videoSeekEpsilonSeconds) {
                resolveWithCleanup();
                return;
            }

            video.currentTime = seekTo;
        });
    }

    private async _videoElement(file: FileModel): Promise<HTMLVideoElement> {
        if (!this._video) {
            this._video = await createVideoElement(file.blobUrl);
        }

        return this._video;
    }

    dispose() {
        this._blobPromiseReject?.(new CancelledMediaFragmentDataRenderingError());

        disposeVideoElement(this._video);
        this._video = undefined;
        this._canvas?.remove();
        this._ctx = undefined;
    }
}
