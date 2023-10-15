import { bufferToBase64 } from './base64';

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

    startWithTimeout(time: number, onStartedCallback: () => void): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.recording) {
                    console.error('Already recording, cannot start with timeout.');
                    reject('Already recording');
                    return;
                }

                await this.start();
                onStartedCallback();
                setTimeout(async () => {
                    resolve(await this.stop());
                }, time);
            } catch (e) {
                reject(e);
            }
        });
    }

    async start(): Promise<void> {
        if (this.recording) {
            console.error('Already recording, cannot start');
            return;
        }

        return new Promise((resolve, reject) => {
            chrome.tabCapture.capture({ audio: true }, (stream) => {
                if (!stream) {
                    reject(new Error(chrome.runtime.lastError?.message ?? 'Missing stream'));
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
                resolve(undefined);
            });
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
