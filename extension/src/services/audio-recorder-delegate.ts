import {
    ExtensionToOffscreenDocumentCommand,
    ExtensionToVideoCommand,
    StartRecordingAudioMessage,
    StartRecordingAudioViaCaptureStreamMessage,
    StartRecordingAudioWithTimeoutMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StartRecordingResponse,
    StopRecordingAudioMessage,
    StopRecordingResponse,
} from '@project/common';

export interface Requester {
    tabId: number;
    src: string;
}

export interface AudioRecorderDelegate {
    startWithTimeout: (
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ) => Promise<StartRecordingResponse>;
    start: (requestId: string, requester: Requester) => Promise<StartRecordingResponse>;
    stop: (encodeAsMp3: boolean, requester: Requester) => Promise<StopRecordingResponse>;
}

export class OffscreenAudioRecorder implements AudioRecorderDelegate {
    private async _ensureOffscreenDocument() {
        const contexts = await browser.runtime.getContexts({
            contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });

        if (contexts.length === 0) {
            await browser.offscreen.createDocument({
                url: 'offscreen-audio-recorder.html',
                reasons: [browser.offscreen.Reason.USER_MEDIA],
                justification: 'Audio recording',
            });
        }
    }

    private _mediaStreamId(tabId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            browser.tabCapture.getMediaStreamId(
                {
                    targetTabId: tabId,
                },
                (streamId) => resolve(streamId)
            );
        });
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        await this._ensureOffscreenDocument();

        const streamId = await this._mediaStreamId(tabId);
        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                streamId,
                requestId,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StartRecordingResponse;
    }

    async start(requestId: string, { tabId, src }: Requester) {
        await this._ensureOffscreenDocument();
        const streamId = await this._mediaStreamId(tabId);

        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio',
                streamId,
                requestId,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StartRecordingResponse;
    }

    async stop(encodeAsMp3: boolean): Promise<StopRecordingResponse> {
        const command: ExtensionToOffscreenDocumentCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StopRecordingResponse;
    }
}

export class CaptureStreamAudioRecorder implements AudioRecorderDelegate {
    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        const command: ExtensionToVideoCommand<StartRecordingAudioWithTimeoutViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                requestId,
            },
            src,
        };

        return (await browser.tabs.sendMessage(tabId, command)) as StartRecordingResponse;
    }

    async start(requestId: string, { tabId, src }: Requester) {
        const command: ExtensionToVideoCommand<StartRecordingAudioViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio',
                requestId,
            },
            src,
        };
        return (await browser.tabs.sendMessage(tabId, command)) as StartRecordingResponse;
    }

    async stop(encodeAsMp3: boolean, { tabId, src }: Requester): Promise<StopRecordingResponse> {
        const command: ExtensionToVideoCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
            src,
        };
        return (await browser.tabs.sendMessage(tabId, command)) as StopRecordingResponse;
    }
}
