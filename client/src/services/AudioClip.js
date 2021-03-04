const AUDIO_TYPES = {"audio/ogg;codecs=opus": "ogg", "audio/webm;codecs=opus": "webm"}
const [recorderMimeType, recorderExtension] = Object.keys(AUDIO_TYPES).filter(MediaRecorder.isTypeSupported).map(t => [t, AUDIO_TYPES[t]])[0];

class Base64AudioData {

    constructor(name, start, end, base64, extension) {
        this.name = name;
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
        audio.preload = "none";
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
            this.cachedBlob = await (await fetch("data:audio/" + this.extension + ";base64," + this._base64)).blob();
        }

        return this.cachedBlob;
    }
}

class FileAudioData {

    constructor(file, start, end, trackId) {
        this.file = file;
        this.name = file.name + "_" + start + "_" + end + "." + recorderExtension;
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
            }
        });
    }

    async play() {
        if (!this._blob) {
            this._blob = await this._clipAudio();
            return;
        }

        const audio = this._audioElement(this._blob);
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
        audio.preload = "none";

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
        if (typeof audio.captureStream === "function") {
            return audio.captureStream();
        }

        if (typeof audio.mozCaptureStream === "function") {
            return audio.mozCaptureStream();
        }

        throw new Error("Unable to capture stream from audio");
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
}

export default class AudioClip {

    constructor(data) {
        this.data = data;
    }

    static fromBase64(subtitleFile, start, end, base64, extension) {
        const audioName = subtitleFile.name.substring(0, subtitleFile.name.lastIndexOf(".")) + "_" + start + "_" + end + "." + extension;
        return new AudioClip(new Base64AudioData(audioName, start, end, base64, extension));
    }

    static fromFile(file, start, end, trackId) {
        return new AudioClip(new FileAudioData(file, start, end, trackId));
    }

    get name() {
        return this.data.name;
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
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = this.data.name;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
}