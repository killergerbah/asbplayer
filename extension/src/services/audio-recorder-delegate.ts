import {
    ExtensionToOffscreenDocumentCommand,
    ExtensionToVideoCommand,
    RequestActiveTabPermissionMessage,
    StartRecordingAudioMessage,
    StartRecordingAudioViaCaptureStreamMessage,
    StartRecordingAudioWithTimeoutMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StopRecordingAudioMessage,
} from '@project/common';

export interface Requester {
    tabId: number;
    src: string;
}

export interface AudioRecorderDelegate {
    onAudioBase64: (base64: string) => void;
    startWithTimeout: (time: number, preferMp3: boolean, { tabId, src }: Requester) => Promise<string>;
    start: (requester: Requester) => Promise<void>;
    stop: (preferMp3: boolean, requester: Requester) => Promise<string>;
}

export class DrmProtectedStreamError extends Error {}

export class OffscreenAudioRecorder implements AudioRecorderDelegate {
    private audioBase64Resolve?: (value: string) => void;

    onAudioBase64(base64: string) {
        this.audioBase64Resolve?.(base64);
        this.audioBase64Resolve = undefined;
    }

    private async _ensureOffscreenDocument() {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });

        if (contexts.length === 0) {
            await chrome.offscreen.createDocument({
                url: 'offscreen-audio-recorder.html',
                reasons: [chrome.offscreen.Reason.USER_MEDIA],
                justification: 'Audio recording',
            });
        }
    }

    private _mediaStreamId(tabId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId(
                {
                    targetTabId: tabId,
                },
                (streamId) => resolve(streamId)
            );
        });
    }

    async startWithTimeout(time: number, preferMp3: boolean, { tabId, src }: Requester): Promise<string> {
        await this._ensureOffscreenDocument();
        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const streamId = await this._mediaStreamId(tabId);

        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                preferMp3,
                streamId,
            },
        };
        const started = (await chrome.runtime.sendMessage(command)) as boolean;

        if (!started) {
            if (tabId !== undefined) {
                this._requestActiveTab(tabId, src);
            }

            throw new Error('Failed to start recording');
        }

        return await this._audioBase64();
    }

    async start({ tabId, src }: Requester) {
        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        await this._ensureOffscreenDocument();
        const streamId = await this._mediaStreamId(tabId);

        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio',
                streamId,
            },
        };
        const started = (await chrome.runtime.sendMessage(command)) as boolean;

        if (!started) {
            if (tabId !== undefined) {
                this._requestActiveTab(tabId, src);
            }

            throw new Error('Failed to start recording');
        }
    }

    private _requestActiveTab(tabId: number, src: string) {
        const command: ExtensionToVideoCommand<RequestActiveTabPermissionMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'request-active-tab-permission',
            },
            src,
        };
        chrome.tabs.sendMessage(tabId, command);
    }

    async stop(preferMp3: boolean): Promise<string> {
        const command: ExtensionToOffscreenDocumentCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'stop-recording-audio',
                preferMp3,
            },
        };
        chrome.runtime.sendMessage(command);
        return await this._audioBase64();
    }

    private _audioBase64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.audioBase64Resolve = resolve;
        });
    }
}

export class CaptureStreamAudioRecorder implements AudioRecorderDelegate {
    private audioBase64Resolve?: (value: string) => void;

    onAudioBase64(base64: string) {
        this.audioBase64Resolve?.(base64);
        this.audioBase64Resolve = undefined;
    }

    async startWithTimeout(time: number, preferMp3: boolean, { tabId, src }: Requester): Promise<string> {
        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const command: ExtensionToVideoCommand<StartRecordingAudioWithTimeoutViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                preferMp3,
            },
            src,
        };

        const started = (await chrome.tabs.sendMessage(tabId, command)) as boolean;

        if (!started) {
            throw new DrmProtectedStreamError();
        }

        return await this._audioBase64();
    }

    async start({ tabId, src }: Requester) {
        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const command: ExtensionToVideoCommand<StartRecordingAudioViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio',
            },
            src,
        };
        const started = (await chrome.tabs.sendMessage(tabId, command)) as boolean;

        if (!started) {
            throw new DrmProtectedStreamError();
        }
    }

    async stop(preferMp3: boolean, { tabId, src }: Requester): Promise<string> {
        const command: ExtensionToVideoCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'stop-recording-audio',
                preferMp3,
            },
            src,
        };
        chrome.tabs.sendMessage(tabId, command);
        return await this._audioBase64();
    }

    private _audioBase64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.audioBase64Resolve = resolve;
        });
    }
}
