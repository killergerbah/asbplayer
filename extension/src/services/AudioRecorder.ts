import { bufferToBase64 } from './Base64';

export default class AudioRecorder {
    private recording: boolean;
    private recorder: MediaRecorder | null;
    private stream: MediaStream | null;
    private audio: HTMLAudioElement | null;
    private blobPromise: Promise<Blob> | null;

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.audio = null;
        this.blobPromise = null;
    }

    startWithTimeout(time: number): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.recording) {
                console.error('Already recording, cannot start with timeout.');
                reject('Already recording');
                return;
            }

            this.start();
            setTimeout(async () => {
                resolve(await this.stop());
            }, time);
        });
    }

    start() {
        if (this.recording) {
            console.error('Already recording, cannot start');
            return;
        }

        return chrome.tabCapture.capture({ audio: true }, (stream) => {
            if (!stream) {
                return;
            }

            const recorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];
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
            throw new Error('Not recording, unable to stop');
        }

        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;
        this.stream?.getAudioTracks()[0].stop();
        this.stream = null;

        if (this.audio) {
            this.audio.pause();
            this.audio.srcObject = null;
            this.audio = null;
        }

        const blob = await this.blobPromise;
        this.blobPromise = null;
        return await bufferToBase64(await blob!.arrayBuffer());
    }
}
