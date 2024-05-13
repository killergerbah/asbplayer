import {
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    RecordingFinishedMessage,
    RecordingStartedMessage,
} from '@project/common';
import TabRegistry from './tab-registry';
import { AudioRecorderDelegate } from './audio-recorder-delegate';

interface Requester {
    tabId: number;
    src: string;
}

export default class AudioRecorderService {
    private readonly _tabRegistry: TabRegistry;
    private readonly _delegate: AudioRecorderDelegate;

    constructor(tabRegistry: TabRegistry, delegate: AudioRecorderDelegate) {
        this._tabRegistry = tabRegistry;
        this._delegate = delegate;
    }

    onAudioBase64(base64: string) {
        this._delegate.onAudioBase64(base64);
    }

    async startWithTimeout(time: number, preferMp3: boolean, requester: Requester): Promise<string> {
        const promise = this._delegate.startWithTimeout(time, preferMp3, requester);
        this._notifyRecordingStarted(requester);

        try {
            return await promise;
        } finally {
            this._notifyRecordingFinished(requester);
        }
    }

    async start(requester: Requester) {
        try {
            await this._delegate.start(requester);
            this._notifyRecordingStarted(requester);
        } catch (e) {
            this._notifyRecordingFinished(requester);
            throw e;
        }
    }

    async stop(preferMp3: boolean, requester: Requester): Promise<string> {
        const promise = this._delegate.stop(preferMp3, requester);
        this._notifyRecordingFinished(requester);
        return await promise;
    }

    private _notifyRecordingStarted({ tabId, src }: Requester) {
        const command: ExtensionToAsbPlayerCommand<RecordingStartedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-started',
            },
        };
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? command : undefined),
        });
        const videoCommand: ExtensionToVideoCommand<RecordingStartedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'recording-started',
            },
            src,
        };
        chrome.tabs.sendMessage(tabId, videoCommand);
    }

    private _notifyRecordingFinished({ tabId, src }: Requester) {
        const playerCommand: ExtensionToAsbPlayerCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-finished',
            },
        };
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? playerCommand : undefined),
        });
        const videoCommand: ExtensionToVideoCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'recording-finished',
            },
            src,
        };
        chrome.tabs.sendMessage(tabId, videoCommand);
    }
}
