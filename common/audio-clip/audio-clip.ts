import Mp3Encoder from './mp3-encoder';

import { AudioErrorCode, CardModel, FileModel } from '@project/common';
import { download } from '@project/common/util';
import { isActiveBlobUrl } from '../blob-url';
import { base64ToBlob, blobToBase64 } from '../base64';

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

class FileAudioData implements AudioData {
    private readonly file: FileModel;
    private readonly _name: string;
    private readonly _start: number;
    private readonly _end: number;
    private readonly playbackRate: number;
    private readonly trackId?: string;
    private readonly _extension: string;
    private readonly recorderMimeType: string;

    private clippingAudio?: HTMLAudioElement;
    private clippingAudioReject?: (error: string) => void;
    private stopClippingTimeout?: NodeJS.Timeout;

    private playingAudio?: HTMLAudioElement;
    private stopAudioTimeout?: NodeJS.Timeout;

    private _blob?: Blob;

    constructor(file: FileModel, start: number, end: number, playbackRate: number, trackId?: string) {
        const [recorderMimeType, recorderExtension] = recorderConfiguration();
        this.recorderMimeType = recorderMimeType;
        this.file = file;
        this._name = makeFileName(file.name, start);
        this._start = start;
        this._end = end;
        this.playbackRate = playbackRate;
        this.trackId = trackId;
        this._extension = recorderExtension;
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

            if (blob === undefined) {
                reject('Did not finish recording blob');
            } else {
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64 = result.substring(result.indexOf(',') + 1);
                    resolve(base64);
                };
            }
        });
    }

    async play() {
        if (!this._blob) {
            this._blob = await this._clipAudio();
            return;
        }

        if (this.playingAudio) {
            this._stopPlayingAudio();
            return;
        }

        const audio = await this._audioElement(URL.createObjectURL(this._blob), false);
        audio.currentTime = 0;
        await audio.play();
        this.playingAudio = audio;
        this.stopAudioTimeout = setTimeout(() => {
            this.stopAudio(audio, true);
            this.stopAudioTimeout = undefined;
            this.playingAudio = undefined;
        }, (this._end - this._start) / this.playbackRate + 100);
    }

    stop() {
        if (this.playingAudio) {
            this._stopPlayingAudio();
        }

        if (this.clippingAudio) {
            this._stopClippingAudio();
        }
    }

    async blob() {
        if (!this._blob) {
            this._blob = await this._clipAudio();
        }

        if (this._blob === undefined) {
            throw new Error('Did not finish recording blob');
        }

        return this._blob;
    }

    async _clipAudio(): Promise<Blob | undefined> {
        if (this.clippingAudio) {
            this._stopClippingAudio();
            return undefined;
        }

        return new Promise(async (resolve, reject) => {
            try {
                const audio = await this._audioElement(this.file.blobUrl, true);
                audio.oncanplay = async (e) => {
                    audio.play();
                    const stream = this._captureStream(audio);
                    const recorder = new MediaRecorder(stream, { mimeType: this.recorderMimeType });
                    const chunks: BlobPart[] = [];

                    recorder.ondataavailable = (e) => {
                        chunks.push(e.data);
                    };

                    let finished = false;

                    recorder.onstop = (e) => {
                        if (finished) {
                            resolve(new Blob(chunks, { type: this.recorderMimeType }));
                        }
                    };

                    recorder.start();

                    this.clippingAudioReject = reject;
                    this.clippingAudio = audio;
                    this.stopClippingTimeout = setTimeout(() => {
                        this.stopAudio(audio, false);
                        this.clippingAudio = undefined;
                        this.stopClippingTimeout = undefined;
                        this.clippingAudioReject = undefined;
                        finished = true;
                        recorder.stop();
                        for (const track of stream.getAudioTracks()) {
                            track.stop();
                        }
                    }, (this._end - this._start) / this.playbackRate + 100);
                    audio.oncanplay = null;
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    private _stopClippingAudio() {
        if (!this.clippingAudio) {
            return;
        }

        this.stopAudio(this.clippingAudio, false);
        clearTimeout(this.stopClippingTimeout!);
        this.clippingAudioReject?.('Did not finish recording blob');
        this.clippingAudio = undefined;
        this.stopClippingTimeout = undefined;
        this.clippingAudioReject = undefined;
    }

    private _stopPlayingAudio() {
        if (!this.playingAudio) {
            return;
        }

        this.stopAudio(this.playingAudio, true);
        clearTimeout(this.stopAudioTimeout!);
        this.playingAudio = undefined;
        this.stopAudioTimeout = undefined;
    }

    private _audioElement(blobUrl: string, selectTrack: boolean): Promise<ExperimentalAudioElement> {
        const audio = new Audio() as ExperimentalAudioElement;
        audio.preload = 'metadata';
        audio.src = blobUrl;

        return new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
                if (selectTrack && this.trackId && audio.audioTracks && audio.audioTracks.length > 0) {
                    // @ts-ignore
                    for (const t of audio.audioTracks) {
                        t.enabled = this.trackId === t.id;
                    }
                }

                audio.currentTime = this._start / 1000;
                audio.playbackRate = this.playbackRate;
                resolve(audio);
            };

            audio.onerror = () => {
                reject(audio.error?.message ?? 'Could not load audio');
            };
        });
    }

    private stopAudio(audio: HTMLAudioElement, revokeBlobUrl: boolean) {
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

    slice(start: number, end: number) {
        return new FileAudioData(this.file, start, end, this.playbackRate, this.trackId);
    }

    isSliceable() {
        return true;
    }

    get error() {
        if (this.file.blobUrl) {
            return isActiveBlobUrl(this.file.blobUrl) ? undefined : AudioErrorCode.fileLinkLost;
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

    static fromCard(card: CardModel, paddingStart: number, paddingEnd: number) {
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

    static fromFile(file: FileModel, start: number, end: number, playbackRate: number, trackId?: string) {
        return new AudioClip(new FileAudioData(file, start, end, playbackRate, trackId));
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
