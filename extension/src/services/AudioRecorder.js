import { bufferToBase64 } from './Base64';

export default class AudioRecorder {

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.audio = null;
    }

    async record(time) {
        if (this.recording) {
            console.error("Already recording, cannot start");
            return new Promise((resolve, reject) => reject(new Error("Already recording, cannot start")));
        }

        return new Promise((resolve, reject) => {
            chrome.tabCapture.capture({audio: true}, async (stream) => {
                const audioBase64 = await this._start(stream, time);
                resolve(audioBase64);
            });
        });
    }

    async _start(stream, time) {
        return new Promise((resolve, reject) => {
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
            };
            recorder.onstop = (e) => {
                const blob = new Blob(chunks);
                blob.arrayBuffer().then(buffer => resolve(bufferToBase64(buffer)));
            };
            recorder.start();
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play();

            this.recorder = recorder;
            this.recording = true;
            this.stream = stream;
            this.audio = audio;
            setTimeout(() => this._stop(), time);
        });
    }

    _stop() {
        if (!this.recording) {
            console.error("Not recording, unable to stop");
            return;
        }

        this.recording = false;
        this.recorder.stop();
        this.recorder = null;
        this.stream.getAudioTracks()[0].stop();
        this.stream = null;
        this.audio.pause();
        this.audio.srcObject = null;
        this.audio = null;
    }
}