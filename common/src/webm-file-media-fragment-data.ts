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
const webmVideoBitsPerSecond = 2_500_000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const durationFromInterval = (startTimestamp: number, endTimestamp: number) => {
    const duration = Math.abs(endTimestamp - startTimestamp);
    const resolvedDuration = duration > 0 ? duration : minWebmMediaFragmentDurationMs;
    return Math.max(minWebmMediaFragmentDurationMs, resolvedDuration);
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
    await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Could not read blob as data URL'));
        reader.readAsDataURL(blob);
    });

export class WebmFileMediaFragmentData implements MediaFragmentData {
    private readonly _file: FileModel;
    private readonly _startTimestamp: number;
    private readonly _durationMs: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _baseName: string;
    private _video?: HTMLVideoElement;
    private _canvas?: HTMLCanvasElement;
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
        canvas: HTMLCanvasElement | undefined
    ) {
        this._file = file;
        this._startTimestamp = Math.max(0, startTimestamp);
        this._durationMs = durationFromInterval(startTimestamp, endTimestamp);
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
        this._baseName = makeMediaFragmentFileName(file.name, this._startTimestamp);
        this._video = video;
        this._canvas = canvas;
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
            this._canvas
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

    async blob() {
        if (this._cachedBlob) {
            return this._cachedBlob;
        }

        if (this._blobPromise) {
            return await this._blobPromise;
        }

        this._blobPromise = new Promise(async (resolve, reject) => {
            this._blobPromiseReject = reject;

            try {
                const blob = await this._renderWebm();
                this._blobPromiseReject = undefined;
                this._cachedBlob = blob;
                resolve(blob);
            } catch (e) {
                reject(e);
            }
        });

        return await this._blobPromise;
    }

    private async _renderWebm() {
        const mimeType = preferredWebmMediaFragmentMimeType();
        if (!mimeType || typeof MediaRecorder === 'undefined') {
            throw new Error('WebM capture is not supported in this browser');
        }

        const video = await this._videoElement(this._file);
        const { width, height } = this._dimensions(video);

        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
        }

        const canvas = this._canvas;
        if (typeof canvas.captureStream !== 'function') {
            throw new Error('WebM capture stream is not supported in this browser');
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create MediaFragment context');
        }

        const maxVideoDurationMs = Number.isFinite(video.duration)
            ? Math.max(0, video.duration * 1000)
            : this._startTimestamp + this._durationMs;
        const startTimestampMs = clamp(this._startTimestamp, 0, maxVideoDurationMs);
        const targetEndTimestampMs = clamp(startTimestampMs + this._durationMs, startTimestampMs, maxVideoDurationMs);

        const chunks: BlobPart[] = [];
        let stream: MediaStream | undefined;
        let mediaRecorder: MediaRecorder | undefined;
        let stopRecorder: Promise<Blob> | undefined;

        const originalPlaybackRate = video.playbackRate;
        const originalMuted = video.muted;
        const originalVolume = video.volume;
        const originalOnError = video.onerror;
        const originalOnEnded = video.onended;
        const videoWithPreservesPitch = video as HTMLVideoElement & { preservesPitch?: boolean };
        const originalPreservesPitch = videoWithPreservesPitch.preservesPitch;
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

        try {
            stream = canvas.captureStream();
            mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: webmVideoBitsPerSecond,
            });

            const recorder = mediaRecorder;
            stopRecorder = new Promise<Blob>((resolve, reject) => {
                recorder.onerror = (event) => {
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

            await this._seekVideo(video, startTimestampMs / 1000);

            const drawFrame = () => {
                ctx.drawImage(video, 0, 0, width, height);
            };
            const done = () => video.currentTime * 1000 >= targetEndTimestampMs;
            const schedule = (onFrame: () => void) => {
                if (typeof video.requestVideoFrameCallback === 'function') {
                    videoFrameCallbackHandle = video.requestVideoFrameCallback(() => onFrame());
                    return;
                }

                if (typeof requestAnimationFrame === 'function') {
                    animationFrameHandle = requestAnimationFrame(() => onFrame());
                    return;
                }

                fallbackTimer = setTimeout(onFrame, 16);
            };

            drawFrame();
            video.muted = true;
            video.volume = 0;
            video.playbackRate = 1;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = false;
            }

            await video.play();
            mediaRecorder.start();

            await new Promise<void>((resolve, reject) => {
                const finish = () => {
                    clearScheduledFrame();
                    resolve();
                };
                const fail = (error: Error) => {
                    clearScheduledFrame();
                    reject(error);
                };

                const onFrame = () => {
                    try {
                        drawFrame();

                        if (done()) {
                            finish();
                            return;
                        }

                        schedule(onFrame);
                    } catch (error) {
                        fail(error instanceof Error ? error : new Error(String(error)));
                    }
                };

                video.onerror = () => fail(new Error(video.error?.message ?? 'Could not play video to capture WebM'));
                video.onended = () => finish();
                schedule(onFrame);
            });

            video.pause();

            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }

            const blob = await stopRecorder;
            if (blob.size <= 0) {
                throw new Error('Could not encode WebM from local video');
            }

            return blob;
        } finally {
            clearScheduledFrame();

            video.pause();
            video.playbackRate = originalPlaybackRate;
            video.muted = originalMuted;
            video.volume = originalVolume;
            video.onerror = originalOnError;
            video.onended = originalOnEnded;

            if (typeof originalPreservesPitch === 'boolean') {
                videoWithPreservesPitch.preservesPitch = originalPreservesPitch;
            }

            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                await stopRecorder?.catch(() => undefined);
            }

            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        }
    }

    private _dimensions(video: HTMLVideoElement) {
        const widthRatio = this._maxWidth <= 0 ? 1 : this._maxWidth / video.videoWidth;
        const heightRatio = this._maxHeight <= 0 ? 1 : this._maxHeight / video.videoHeight;
        const ratio = Math.min(1, Math.min(widthRatio, heightRatio));

        return {
            width: Math.max(1, Math.floor(video.videoWidth * ratio)),
            height: Math.max(1, Math.floor(video.videoHeight * ratio)),
        };
    }

    private async _seekVideo(video: HTMLVideoElement, timestamp: number) {
        return await new Promise<void>((resolve, reject) => {
            const maxTimestamp = Number.isFinite(video.duration) ? video.duration : timestamp;
            const seekTo = clamp(timestamp, 0, maxTimestamp);
            const resolveWithCleanup = () => {
                video.onseeked = null;
                video.onerror = null;
                resolve();
            };

            video.onseeked = resolveWithCleanup;
            video.onerror = () => reject(video.error?.message ?? 'Could not seek video to create WebM');

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
    }
}
