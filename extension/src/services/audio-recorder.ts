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

    startWithTimeout(streamId: string, time: number, onStartedCallback: () => void): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.recording) {
                    console.error('Already recording, cannot start with timeout.');
                    reject('Already recording');
                    return;
                }

                await this.start(streamId);
                onStartedCallback();
                setTimeout(async () => {
                    resolve(await this.stop());
                }, time);
            } catch (e) {
                reject(e);
            }
        });
    }

    async start(streamId: string): Promise<void> {
        if (this.recording) {
            console.error('Already recording, cannot start');
            return;
        }

        return new Promise(async (resolve, reject) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        // @ts-ignore
                        mandatory: {
                            chromeMediaSource: 'tab',
                            chromeMediaSourceId: streamId,
                        },
                    },
                });
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
            } catch (e) {
                reject(e);
            }
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
