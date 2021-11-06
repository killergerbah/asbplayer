import Mp3Encoder from './Mp3Encoder';
// eslint-disable-next-line
import Worker from 'worker-loader!./mp3-encoder.js';
const AUDIO_TYPES = { 'audio/ogg;codecs=opus': 'ogg', 'audio/webm;codecs=opus': 'webm' };
const [recorderMimeType, recorderExtension] = Object.keys(AUDIO_TYPES)
    .filter(MediaRecorder.isTypeSupported)
    .map((t) => [t, AUDIO_TYPES[t]])[0];
const defaultMp3WorkerFactory = () => new Worker();

class Base64AudioData {
    constructor(baseName, start, end, base64, extension) {
        this.name = baseName + '_' + Math.floor(start) + '_' + Math.floor(end);
        this.start = start;
        this.end = end;
        this._base64 = base64;
        this.extension = extension;
    }

    async base64() {
        return this._base64;
    }

    async blob() {
        return await this._blob();
    }

    async play() {
        const blob = await this._blob();
        const audio = new Audio();
        audio.src = URL.createObjectURL(blob);
        audio.preload = 'none';
        audio.load();

        await audio.play();

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                audio.pause();
                const src = audio.src;
                audio.src = null;
                URL.revokeObjectURL(src);
                resolve();
            }, this.end - this.start + 1000);
        });
    }

    async _blob() {
        if (!this.cachedBlob) {
            this.cachedBlob = await (await fetch('data:audio/' + this.extension + ';base64,' + this._base64)).blob();
        }

        return this.cachedBlob;
    }

    slice(start, end) {
        // Not supported
        return this;
    }

    isSliceable(start, end) {
        return false;
    }
}

class FileAudioData {
    constructor(file, start, end, trackId) {
        this.file = file;
        this.name = file.name + '_' + start + '_' + end;
        this.start = start;
        this.end = end;
        this.trackId = trackId;
        this.extension = recorderExtension;
    }

    async base64() {
        return new Promise(async (resolve, reject) => {
            var reader = new FileReader();
            reader.readAsDataURL(await this.blob());
            reader.onloadend = () => {
                const result = reader.result;
                const base64 = result.substr(result.indexOf(',') + 1);
                resolve(base64);
            };
        });
    }

    async play() {
        if (!this._blob) {
            this._blob = await this._clipAudio();
            return;
        }

        const audio = this._audioElement(this._blob);
        audio.currentTime = 0;
        await audio.play();
        await this._stopAudio(audio);
    }

    async blob() {
        if (!this._blob) {
            this._blob = await this._clipAudio();
        }

        return this._blob;
    }

    async _clipAudio() {
        return new Promise((resolve, reject) => {
            const audio = this._audioElement(this.file);

            audio.oncanplay = async (e) => {
                audio.play();
                const stream = this._captureStream(audio);

                for (const t of stream.getVideoTracks()) {
                    t.stop();
                }

                const recorder = new MediaRecorder(stream, { mimeType: recorderMimeType });
                const chunks = [];

                recorder.ondataavailable = (e) => {
                    chunks.push(e.data);
                };

                recorder.onstop = (e) => {
                    resolve(new Blob(chunks));
                };

                recorder.start();
                await this._stopAudio(audio);
                recorder.stop();
            };
        });
    }

    _audioElement(source) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(source);
        audio.preload = 'none';

        // FIXME: clipping the correct audio track selection doesn't actually work right now.
        if (this.trackId && audio.audioTracks && audio.audioTracks.length > 0) {
            for (const t of audio.audioTracks) {
                t.enabled = this.trackId === t.id;
            }
        }

        audio.currentTime = this.start / 1000;
        audio.load();

        return audio;
    }

    _captureStream(audio) {
        if (typeof audio.captureStream === 'function') {
            return audio.captureStream();
        }

        if (typeof audio.mozCaptureStream === 'function') {
            return audio.mozCaptureStream();
        }

        throw new Error('Unable to capture stream from audio');
    }

    async _stopAudio(audio) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                audio.pause();
                const src = audio.src;
                audio.src = null;
                URL.revokeObjectURL(src);
                resolve();
            }, this.end - this.start + 100);
        });
    }

    slice(start, end) {
        return new FileAudioData(this.file, start, end, this.trackId);
    }

    isSliceable(start, end) {
        return true;
    }
}

class Mp3AudioData {
    constructor(data, workerFactory) {
        this.data = data;
        this.workerFactory = workerFactory;
    }

    get name() {
        return this.data.name;
    }

    get extension() {
        return 'mp3';
    }

    async base64() {
        return new Promise(async (resolve, reject) => {
            try {
                var reader = new FileReader();
                reader.readAsDataURL(await this.blob());
                reader.onloadend = () => {
                    const result = reader.result;
                    const base64 = result.substr(result.indexOf(',') + 1);
                    resolve(base64);
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    async play() {
        await this.data.play();
    }

    async blob() {
        if (!this._blob) {
            this._blob = await Mp3Encoder.encode(await this.data.blob(), this.workerFactory);
        }

        return this._blob;
    }

    slice(start, end) {
        return new Mp3AudioData(this.data.slice(start, end), this.workerFactory);
    }

    isSliceable(start, end) {
        return this.data.isSliceable(start, end);
    }
}

export default class AudioClip {
    constructor(data) {
        this.data = data;
    }

    static fromBase64(subtitleFileName, start, end, base64, extension) {
        return new AudioClip(
            new Base64AudioData(
                subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')),
                start,
                end,
                base64,
                extension
            )
        );
    }

    static fromFile(file, start, end, trackId) {
        return new AudioClip(new FileAudioData(file, start, end, trackId));
    }

    get name() {
        return this.data.name + '.' + this.data.extension;
    }

    async play() {
        await this.data.play();
    }

    async base64() {
        return await this.data.base64();
    }

    async download() {
        const blob = await this.data.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = this.name;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }

    toMp3(mp3WorkerFactory = defaultMp3WorkerFactory) {
        return new AudioClip(new Mp3AudioData(this.data, mp3WorkerFactory));
    }

    slice(start, end) {
        return new AudioClip(this.data.slice(start, end));
    }

    isSliceable(start, end) {
        return this.data.isSliceable(start, end);
    }
}
