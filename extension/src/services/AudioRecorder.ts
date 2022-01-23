import { bufferToBase64 } from './Base64';

export default class AudioRecorder {

    private recording: boolean;
    private recorder: MediaRecorder;
    private stream: MediaStream;
    private audio: HTMLAudioElement;
    private blobPromise: Promise<Blob>;

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.audio = null;
        this.blobPromise = null;
    }

    startWithTimeout(time: number): Promise<string> {
        if (this.recording) {
            console.error("Already recording, cannot start with timeout.");
            return;
        }

        return new Promise((resolve, reject) => {
            this.start();
            setTimeout(async () => {
                resolve(await this.stop());
            }, time);
        });
    }

    start() {
        if (this.recording) {
            console.error("Already recording, cannot start");
            return;
        }

        return chrome.tabCapture.capture({audio: true}, (stream) => {
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
            };
            this.blobPromise = new Promise((resolve, reject) => {
                recorder.onstop = (e) => {
                    resolve(new Blob(chunks));
                };
            });
            recorder.start();
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play();

            this.recorder = recorder;
            this.recording = true;
            this.stream = stream;
            this.audio = audio;
        });
    }

    async stop(): Promise<string> {
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
        const blob = await this.blobPromise;
        this.blobPromise = null;
        return await bufferToBase64(await blob.arrayBuffer());
    }
}