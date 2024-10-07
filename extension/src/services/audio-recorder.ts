import { bufferToBase64 } from '@project/common/base64';

export class TimedRecordingInProgressError extends Error {}

export default class AudioRecorder {
    private recording: boolean;
    private recorder: MediaRecorder | null;
    private stream: MediaStream | null;
    private blobPromise: Promise<Blob> | null;
    private timeoutId?: NodeJS.Timeout;
    private timeoutResolve?: (base64: string) => void;

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.blobPromise = null;
    }

    startWithTimeout(
        stream: MediaStream,
        time: number,
        onStartedCallback: () => void,
        doNotManageStream: boolean = false
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.recording) {
                    console.error('Already recording, cannot start with timeout.');
                    reject('Already recording');
                    return;
                }

                await this.start(stream, doNotManageStream);
                onStartedCallback();
                this.timeoutResolve = resolve;
                this.timeoutId = setTimeout(async () => {
                    this.timeoutId = undefined;
                    resolve(await this.stop(doNotManageStream));
                }, time);
            } catch (e) {
                reject(e);
            }
        });
    }

    start(stream: MediaStream, doNotManageStream: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.recording) {
                reject('Already recording, cannot start');
                return;
            }

            try {
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

                if (!doNotManageStream) {
                    const output = new AudioContext();
                    const source = output.createMediaStreamSource(stream);
                    source.connect(output.destination);
                }

                this.recorder = recorder;
                this.recording = true;
                this.stream = stream;
                resolve(undefined);
            } catch (e) {
                reject(e);
            }
        });
    }

    async stopSafely(doNotManageStream: boolean = false) {
        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;

        if (!doNotManageStream) {
            this.stream?.getTracks()?.forEach((t) => t.stop());
            this.stream = null;
        }

        if (this.blobPromise !== null) {
            const blob = await this.blobPromise;
            this.blobPromise = null;
            const base64 = await bufferToBase64(await blob!.arrayBuffer());

            if (this.timeoutId !== undefined) {
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
                this.timeoutResolve?.(base64);
                this.timeoutResolve = undefined;
            }
        }
    }

    async stop(doNotManageStream: boolean = false): Promise<string> {
        if (!this.recording) {
            throw new Error('Not recording, unable to stop');
        }

        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;

        if (!doNotManageStream) {
            this.stream?.getTracks()?.forEach((t) => t.stop());
            this.stream = null;
        }

        const blob = await this.blobPromise;
        this.blobPromise = null;
        const base64 = await bufferToBase64(await blob!.arrayBuffer());

        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
            this.timeoutResolve?.(base64);
            this.timeoutResolve = undefined;
            throw new TimedRecordingInProgressError();
        }

        return base64;
    }
}
