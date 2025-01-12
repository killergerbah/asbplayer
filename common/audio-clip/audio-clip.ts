import Mp3Encoder from './mp3-encoder';

import { AudioErrorCode, CardModel, FileModel } from '@project/common';
import { download } from '@project/common/util';
import { isActiveBlobUrl } from '../blob-url';
import { base64ToBlob, blobToBase64 } from '../base64';
import { isFirefox } from '../browser-detection';

const maxPrefixLength = 24;

const makeFileName = (prefix: string, start: number) => {
    return `${prefix.replaceAll(' ', '_').substring(0, Math.min(prefix.length, maxPrefixLength))}_${Math.floor(start)}`;
};

interface ExperimentalAudioElement extends HTMLAudioElement {
    audioTracks: any;
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
}

interface AudioData {
    name: string;
    extension: string;
    start: number;
    end: number;
    play: () => Promise<void>;
    stop: () => void;
    blob: () => Promise<Blob>;
    base64: () => Promise<string>;
    slice: (start: number, end: number) => AudioData;
    isSliceable: () => boolean;
    error?: AudioErrorCode;
}

function recorderConfiguration() {
    const AUDIO_TYPES: { [key: string]: string } = {
        'audio/ogg;codecs=opus': 'ogg',
        'audio/webm;codecs=opus': 'webm',
    };
    return Object.keys(AUDIO_TYPES)
        .filter(MediaRecorder.isTypeSupported)
        .map((t) => [t as string, AUDIO_TYPES[t] as string])[0];
}

class Base64AudioData implements AudioData {
    private readonly _name: string;
    private readonly _start: number;
    private readonly _end: number;
    private readonly playbackRate: number;
    private readonly _base64: string;
    private readonly _extension: string;
    private readonly _error?: AudioErrorCode;

    private playingAudio?: HTMLAudioElement;
    private stopAudioTimeout?: NodeJS.Timeout;
    private cachedBlob?: Blob;

    constructor(
        baseName: string,
        start: number,
        end: number,
        playbackRate: number,
        base64: string,
        extension: string,
        error: AudioErrorCode | undefined
    ) {
        this._name = makeFileName(baseName, start);
        this._start = start;
        this._end = end;
        this.playbackRate = playbackRate;
        this._base64 = base64;
        this._extension = extension;
        this._error = error;
    }

    get name(): string {
        return this._name;
    }

    get extension(): string {
        return this._extension;
    }

    get start(): number {
        return this._start;
    }

    get end(): number {
        return this._end;
    }

    async base64() {
        return this._base64;
    }

    async blob() {
        return await this._blob();
    }

    async play(): Promise<void> {
        if (this.playingAudio) {
            this.stop();
            return;
        }

        const blob = await this._blob();
        const audio = new Audio();
        audio.src = URL.createObjectURL(blob);
        audio.preload = 'metadata';
        this.playingAudio = audio;

        await audio.play();

        this.stopAudioTimeout = setTimeout(() => {
            this.stopAudio(audio);
            this.playingAudio = undefined;
            this.stopAudioTimeout = undefined;
        }, (this._end - this._start) / this.playbackRate + 100);
    }

    stop() {
        if (!this.playingAudio) {
            return;
        }

        this.stopAudio(this.playingAudio);
        clearTimeout(this.stopAudioTimeout!);
        this.playingAudio = undefined;
        this.stopAudioTimeout = undefined;
    }

    private stopAudio(audio: HTMLAudioElement) {
        audio.pause();
        const src = audio.src;
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(src);
    }

    async _blob() {
        if (!this.cachedBlob) {
            this.cachedBlob = base64ToBlob(this._base64, `audio/${this.extension}`);
        }

        return this.cachedBlob;
    }

    slice(start: number, end: number): AudioData {
        // Not supported
        return this;
    }

    isSliceable() {
        return false;
    }

    get error() {
        return this._error;
    }
}

class ClippingCancelledError extends Error {}

class FileAudioClipper {
    private readonly _file: FileModel;
    private readonly _start: number;
    private readonly _end: number;
    private readonly _playbackRate: number;
    private readonly _recorderMimeType: string;
    private readonly _trackId?: string;
    private _clippingAudioElement?: HTMLAudioElement;
    private _clippingAudibly?: boolean;
    private _clippingAudioReject?: (error: Error) => void;
    private _stopClippingTimeout?: NodeJS.Timeout;
    private _playingAudioElement?: HTMLAudioElement;
    private _stopAudioTimeout?: NodeJS.Timeout;
    private _blob?: Blob;
    private _blobPromise?: Promise<Blob>;

    constructor(
        file: FileModel,
        start: number,
        end: number,
        playbackRate: number,
        recorderMimeType: string,
        trackId?: string
    ) {
        this._file = file;
        this._start = start;
        this._end = end;
        this._playbackRate = playbackRate;
        this._recorderMimeType = recorderMimeType;
        this._trackId = trackId;
    }

    latestBlobPromise(): Promise<Blob> | undefined {
        return this._blobPromise;
    }

    get isPlayingAudibly(): boolean {
        return (
            (!isFirefox && this._clippingAudioElement !== undefined && this._clippingAudibly === true) ||
            this._playingAudioElement !== undefined
        );
    }

    get isRecordingSilently(): boolean {
        return this._clippingAudioElement !== undefined && this._clippingAudibly === false;
    }

    get finishedRecording(): boolean {
        return this._blob !== undefined;
    }

    async play() {
        if (this._playingAudioElement) {
            this._stopPlayingAudio();
            return;
        }

        if (this._blob) {
            const audio = await this._audioElement(URL.createObjectURL(this._blob), false);
            audio.currentTime = 0;
            await audio.play();
            this._playingAudioElement = audio;
        } else {
            const audio = await this._audioElement(this._file.blobUrl, true);
            audio.oncanplay = async (e) => {
                audio.play();
                audio.oncanplay = null;
            };
            this._playingAudioElement = audio;
        }

        this._stopAudioTimeout = setTimeout(() => {
            if (this._playingAudioElement !== undefined) {
                this._stopAudio(this._playingAudioElement, true);
                this._playingAudioElement = undefined;
            }

            this._stopAudioTimeout = undefined;
        }, (this._end - this._start) / this._playbackRate + 100);
    }

    async clip(audible: boolean): Promise<Blob> {
        this._stopClippingAudio();
        this._clippingAudibly = audible;
        this._blobPromise = new Promise(async (resolve, reject) => {
            try {
                const audio = await this._audioElement(this._file.blobUrl, true);
                audio.oncanplay = async (e) => {
                    if (!audible) {
                        // Direct audio to destination other than speakers
                        const audioContext = new AudioContext();
                        const destination = audioContext.createMediaStreamDestination();
                        const source = audioContext.createMediaElementSource(audio);
                        source.connect(destination);
                    }

                    audio.play();
                    const stream = this._captureStream(audio);
                    const recorder = new MediaRecorder(stream, { mimeType: this._recorderMimeType });
                    const chunks: BlobPart[] = [];

                    recorder.ondataavailable = (e) => {
                        chunks.push(e.data);
                    };

                    let finished = false;

                    recorder.onstop = (e) => {
                        if (finished) {
                            this._blob = new Blob(chunks, { type: this._recorderMimeType });
                            resolve(this._blob);
                        }
                    };

                    recorder.start();

                    this._clippingAudioReject = reject;
                    this._clippingAudioElement = audio;
                    this._stopClippingTimeout = setTimeout(() => {
                        this._stopAudio(audio, false);
                        this._clippingAudioElement = undefined;
                        this._stopClippingTimeout = undefined;
                        this._clippingAudioReject = undefined;
                        finished = true;
                        recorder.stop();
                        for (const track of stream.getAudioTracks()) {
                            track.stop();
                        }
                    }, (this._end - this._start) / this._playbackRate + 100);
                    audio.oncanplay = null;
                };
            } catch (e) {
                reject(e);
            }
        });
        return this._blobPromise;
    }

    stop() {
        if (this._playingAudioElement) {
            this._stopPlayingAudio();
        }

        if (this._clippingAudioElement) {
            this._stopClippingAudio();
        }
    }

    private _stopClippingAudio() {
        if (!this._clippingAudioElement) {
            return;
        }

        this._stopAudio(this._clippingAudioElement, false);
        clearTimeout(this._stopClippingTimeout!);
        this._clippingAudioReject?.(new ClippingCancelledError());
        this._clippingAudioElement = undefined;
        this._stopClippingTimeout = undefined;
        this._clippingAudioReject = undefined;
        this._blobPromise = undefined;
    }

    private _stopPlayingAudio() {
        if (!this._playingAudioElement) {
            return;
        }

        this._stopAudio(this._playingAudioElement, true);
        clearTimeout(this._stopAudioTimeout!);
        this._playingAudioElement = undefined;
        this._stopAudioTimeout = undefined;
    }

    private _audioElement(blobUrl: string, selectTrack: boolean): Promise<ExperimentalAudioElement> {
        const audio = new Audio() as ExperimentalAudioElement;
        audio.preload = 'metadata';
        audio.src = blobUrl;

        return new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
                if (selectTrack && this._trackId && audio.audioTracks && audio.audioTracks.length > 0) {
                    // @ts-ignore
                    for (const t of audio.audioTracks) {
                        t.enabled = this._trackId === t.id;
                    }
                }

                audio.currentTime = this._start / 1000;
                audio.playbackRate = this._playbackRate;
                resolve(audio);
            };

            audio.onerror = () => {
                reject(audio.error?.message ?? 'Could not load audio');
            };
        });
    }

    private _stopAudio(audio: HTMLAudioElement, revokeBlobUrl: boolean) {
        audio.pause();
        const src = audio.src;
        audio.removeAttribute('src');
        audio.load();

        if (revokeBlobUrl) {
            URL.revokeObjectURL(src);
        }
    }

    private _captureStream(audio: ExperimentalAudioElement) {
        let stream: MediaStream | undefined;

        if (typeof audio.captureStream === 'function') {
            stream = audio.captureStream();
        }

        if (typeof audio.mozCaptureStream === 'function') {
            stream = audio.mozCaptureStream();
        }

        if (stream === undefined) {
            throw new Error('Unable to capture stream from audio');
        }

        const audioStream = new MediaStream();

        for (const track of stream.getVideoTracks()) {
            track.stop();
        }

        for (const track of stream.getAudioTracks()) {
            if (track.enabled) {
                audioStream.addTrack(track);
            }
        }

        return audioStream;
    }
}
class FileAudioData implements AudioData {
    private readonly _file: FileModel;
    private readonly _name: string;
    private readonly _start: number;
    private readonly _end: number;
    private readonly _playbackRate: number;
    private readonly _recordAudibly: boolean;
    private readonly _trackId?: string;
    private readonly _extension: string;
    private readonly _recorderMimeType: string;

    private _blobClipper: FileAudioClipper;
    private _playClipper?: FileAudioClipper;

    constructor(
        file: FileModel,
        start: number,
        end: number,
        playbackRate: number,
        recordAudibly: boolean,
        trackId?: string
    ) {
        const [recorderMimeType, recorderExtension] = recorderConfiguration();
        this._recorderMimeType = recorderMimeType;
        this._file = file;
        this._name = makeFileName(file.name, start);
        this._start = start;
        this._end = end;
        this._playbackRate = playbackRate;
        this._recordAudibly = recordAudibly;
        this._trackId = trackId;
        this._extension = recorderExtension;
        this._blobClipper = new FileAudioClipper(file, start, end, playbackRate, recorderMimeType, trackId);
    }

    get name(): string {
        return this._name;
    }

    get extension(): string {
        return this._extension;
    }

    get start() {
        return this._start;
    }

    get end() {
        return this._end;
    }

    async base64() {
        return new Promise<string>(async (resolve, reject) => {
            var reader = new FileReader();
            const blob = await this.blob();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.substring(result.indexOf(',') + 1);
                resolve(base64);
            };
        });
    }

    async play() {
        if (this._blobClipper.isPlayingAudibly) {
            this._blobClipper.stop();
        } else if (this._playClipper?.isPlayingAudibly) {
            this._playClipper.stop();
        } else if (this._blobClipper.isRecordingSilently) {
            this._playClipper =
                this._playClipper ??
                new FileAudioClipper(
                    this._file,
                    this._start,
                    this._end,
                    this._playbackRate,
                    this._recorderMimeType,
                    this._trackId
                );
            this._playClipper.play();
        } else if (this._blobClipper.finishedRecording) {
            this._blobClipper.play();
            this._playClipper = undefined;
        } else {
            this._blobClipper.clip(true).catch((e) => {
                if (!(e instanceof ClippingCancelledError)) {
                    console.error(e);
                }
            });
        }
    }

    stop() {
        this._blobClipper.stop();
        this._playClipper?.stop();
    }

    async blob() {
        return this._blobClipper.latestBlobPromise() ?? this._blobClipper.clip(this._recordAudibly);
    }

    slice(start: number, end: number) {
        return new FileAudioData(this._file, start, end, this._playbackRate, this._recordAudibly, this._trackId);
    }

    isSliceable() {
        return true;
    }

    get error() {
        if (this._file.blobUrl) {
            return isActiveBlobUrl(this._file.blobUrl) ? undefined : AudioErrorCode.fileLinkLost;
        }

        return undefined;
    }
}

class Mp3AudioData implements AudioData {
    private readonly data: AudioData;
    private readonly workerFactory: () => Worker;
    private _blob?: Blob;

    constructor(data: AudioData, workerFactory: () => Worker) {
        this.data = data;
        this.workerFactory = workerFactory;
    }

    get name() {
        return this.data.name;
    }

    get extension() {
        return 'mp3';
    }

    get start() {
        return this.data.start;
    }

    get end() {
        return this.data.end;
    }

    async base64() {
        return blobToBase64(await this.blob());
    }

    async play() {
        await this.data.play();
    }

    stop() {
        this.data.stop();
    }

    async blob() {
        if (!this._blob) {
            this._blob = await Mp3Encoder.encode(await this.data.blob(), this.workerFactory);
        }

        return this._blob;
    }

    slice(start: number, end: number) {
        return new Mp3AudioData(this.data.slice(start, end), this.workerFactory);
    }

    isSliceable() {
        return this.data.isSliceable();
    }

    get error() {
        return this.data.error;
    }
}

class EncodedAudioData implements AudioData {
    private readonly _data: AudioData;
    private readonly _encoder: (blob: Blob, extension: string) => Promise<Blob>;
    private readonly _extension: string;
    private _blob?: Blob;

    constructor(data: AudioData, encoder: (blob: Blob, extension: string) => Promise<Blob>, extension: string) {
        this._data = data;
        this._encoder = encoder;
        this._extension = extension;
    }

    get name() {
        return this._data.name;
    }

    get extension() {
        return 'mp3';
    }

    get start() {
        return this._data.start;
    }

    get end() {
        return this._data.end;
    }

    async base64() {
        return blobToBase64(await this.blob());
    }

    async play() {
        await this._data.play();
    }

    stop() {
        this._data.stop();
    }

    async blob() {
        if (this._blob === undefined) {
            this._blob = await this._encoder(await this._data.blob(), this._data.extension);
        }

        return this._blob;
    }

    slice(start: number, end: number) {
        return new EncodedAudioData(this._data.slice(start, end), this._encoder, this._extension);
    }

    isSliceable() {
        return this._data.isSliceable();
    }

    get error() {
        return this._data.error;
    }
}

export default class AudioClip {
    private readonly data: AudioData;

    constructor(data: AudioData) {
        this.data = data;
    }

    static fromCard(card: CardModel, paddingStart: number, paddingEnd: number, recordAudibly: boolean) {
        if (card.audio) {
            const start = card.audio.start ?? card.subtitle.start;
            const end = card.audio.end ?? card.subtitle.end;

            return AudioClip.fromBase64(
                card.subtitleFileName!,
                Math.max(0, start - (card.audio.paddingStart ?? 0)),
                end + (card.audio.paddingEnd ?? 0),
                card.audio.playbackRate ?? 1,
                card.audio.base64,
                card.audio.extension,
                card.audio.error
            );
        }

        if (card.file) {
            return AudioClip.fromFile(
                card.file,
                Math.max(0, card.subtitle.start - paddingStart),
                card.subtitle.end + paddingEnd,
                card.file?.playbackRate ?? 1,
                recordAudibly,
                card.file?.audioTrack
            );
        }

        return undefined;
    }

    static fromBase64(
        subtitleFileName: string,
        start: number,
        end: number,
        playbackRate: number,
        base64: string,
        extension: string,
        error: AudioErrorCode | undefined
    ) {
        return new AudioClip(
            new Base64AudioData(
                subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')),
                start,
                end,
                playbackRate,
                base64,
                extension,
                error
            )
        );
    }

    static fromFile(
        file: FileModel,
        start: number,
        end: number,
        playbackRate: number,
        recordAudibly: boolean,
        trackId?: string
    ) {
        return new AudioClip(new FileAudioData(file, start, end, playbackRate, recordAudibly, trackId));
    }

    get start() {
        return this.data.start;
    }

    get end() {
        return this.data.end;
    }

    get name() {
        return this.data.name + '.' + this.data.extension;
    }

    get extension() {
        return this.data.extension;
    }

    async play() {
        await this.data.play();
    }

    stop() {
        this.data.stop();
    }

    async base64() {
        return await this.data.base64();
    }

    async blob() {
        return await this.data.blob();
    }

    async download() {
        const blob = await this.data.blob();
        download(blob, this.name);
    }

    toMp3(mp3WorkerFactory: () => Worker) {
        if (this.data instanceof Mp3AudioData) {
            return this;
        }

        if (this.data.extension === 'mp3') {
            return this;
        }

        return new AudioClip(new Mp3AudioData(this.data, mp3WorkerFactory));
    }

    toEncoded(encoder: (blob: Blob, extension: string) => Promise<Blob>, extension: string) {
        return new AudioClip(new EncodedAudioData(this.data, encoder, extension));
    }

    slice(start: number, end: number) {
        return new AudioClip(this.data.slice(start, end));
    }

    isSliceable() {
        return this.data.isSliceable();
    }

    get error() {
        return this.data.error;
    }

    get errorLocKey() {
        if (this.data.error === undefined) {
            return undefined;
        }

        switch (this.data.error) {
            case AudioErrorCode.drmProtected:
                return 'audioCaptureFailed.message';
            case AudioErrorCode.fileLinkLost:
                return 'ankiDialog.audioFileLinkLost';
        }
    }
}
