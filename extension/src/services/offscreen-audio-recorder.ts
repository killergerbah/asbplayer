import {
    ExtensionToAsbPlayerCommand,
    ExtensionToOffscreenDocumentCommand,
    ExtensionToVideoCommand,
    RecordingFinishedMessage,
    RecordingStartedMessage,
    RequestActiveTabPermissionMessage,
    StartRecordingAudioMessage,
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
} from '@project/common';
import TabRegistry from './tab-registry';
import { SettingsProvider } from '@project/common/settings';

interface Requester {
    tabId: number;
    src: string;
}

export default class OffscreenAudioRecorder {
    private readonly _tabRegistry: TabRegistry;
    private audioBase64Resolve?: (value: string) => void;

    constructor(tabRegistry: TabRegistry, settings: SettingsProvider) {
        this._tabRegistry = tabRegistry;
    }

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

        this._notifyRecordingStarted();

        try {
            return await this._audioBase64();
        } finally {
            this._notifyRecordingFinished();
        }
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

        this._notifyRecordingStarted();
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
        this._notifyRecordingFinished();
        return await this._audioBase64();
    }

    private _audioBase64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.audioBase64Resolve = resolve;
        });
    }

    private _notifyRecordingStarted() {
        const command: ExtensionToAsbPlayerCommand<RecordingStartedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-started',
            },
        };
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? command : undefined),
        });
    }

    private _notifyRecordingFinished() {
        const command: ExtensionToAsbPlayerCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-finished',
            },
        };
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? command : undefined),
        });
    }
}
