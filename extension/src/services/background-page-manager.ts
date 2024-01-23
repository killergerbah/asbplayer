import {
    ExtensionToAsbPlayerCommand,
    ExtensionToBackgroundPageCommand,
    ExtensionToVideoCommand,
    RecordingFinishedMessage,
    RecordingStartedMessage,
    RequestActiveTabPermissionMessage,
    StartRecordingAudio,
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
} from '@project/common';
import TabRegistry from './tab-registry';
import { SettingsProvider } from '@project/common/settings';

const backgroundPageUrl = `chrome-extension://${chrome.runtime.id}/background-page.html`;

interface Requester {
    tabId?: number;
    src: string;
}

export default class BackgroundPageManager {
    private readonly _tabRegistry: TabRegistry;
    private backgroundPageResolve?: (value: chrome.tabs.Tab) => void;
    private audioBase64Resolve?: (value: string) => void;

    constructor(tabRegistry: TabRegistry, settings: SettingsProvider) {
        this._tabRegistry = tabRegistry;
        tabRegistry.onNoSyncedElements(async () => {
            this._removeBackgroundPage();
        });
        tabRegistry.onSyncedElement(async () => {
            const audioRecordingEnabled = await settings.getSingle('streamingRecordMedia');

            if (audioRecordingEnabled) {
                this._backgroundPageTabId();
            }
        });
        this._removeOrphanedBackgroundPage();
    }

    async tabId(): Promise<number | undefined> {
        return await this._fetchBackgroundPageTabId();
    }

    private async _removeBackgroundPage() {
        const tabId = await this._fetchBackgroundPageTabId();

        if (await this._tabDoesNotExist(tabId)) {
            return;
        }

        await chrome.tabs.remove(tabId);
    }

    private async _removeOrphanedBackgroundPage() {
        const tabId = await this._fetchBackgroundPageTabId();
        const tabs = await chrome.tabs.query({});

        for (const tab of tabs) {
            if (tab.url === backgroundPageUrl && tab.id && tab.id !== tabId) {
                await chrome.tabs.remove(tab.id);
            }
        }
    }

    onBackgroundPageReady(tab: chrome.tabs.Tab) {
        if (this.backgroundPageResolve === undefined) {
            return false;
        }

        this.backgroundPageResolve(tab);
        this.backgroundPageResolve = undefined;
        return true;
    }

    onAudioBase64(base64: string) {
        this.audioBase64Resolve?.(base64);
        this.audioBase64Resolve = undefined;
    }

    async startWithTimeout(time: number, preferMp3: boolean, { tabId, src }: Requester): Promise<string> {
        const backgroundPageTabId = await this._backgroundPageTabId();

        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const command: ExtensionToBackgroundPageCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-background-page',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                preferMp3,
            },
        };
        const started = (await chrome.tabs.sendMessage(backgroundPageTabId, command)) as boolean;

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
        const backgroundPageTabId = await this._backgroundPageTabId();

        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const command: ExtensionToBackgroundPageCommand<StartRecordingAudio> = {
            sender: 'asbplayer-extension-to-background-page',
            message: {
                command: 'start-recording-audio',
            },
        };
        const started = (await chrome.tabs.sendMessage(backgroundPageTabId, command)) as boolean;

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
        const tabId = await this._backgroundPageTabId();

        const command: ExtensionToBackgroundPageCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-background-page',
            message: {
                command: 'stop-recording-audio',
                preferMp3,
            },
        };
        chrome.tabs.sendMessage(tabId, command);
        this._notifyRecordingFinished();
        return await this._audioBase64();
    }

    private async _backgroundPageTabId() {
        const tabId = await this._fetchBackgroundPageTabId();

        if (await this._tabDoesNotExist(tabId)) {
            this.audioBase64Resolve = undefined;
            await chrome.tabs.create({
                pinned: true,
                active: false,
                url: backgroundPageUrl,
            });
            const tab = await this._backgroundPageReady();
            await this._setBackgroundPageTabId(tab.id!);
            return tab.id!;
        }

        return tabId;
    }

    private async _tabDoesNotExist(tabId?: number) {
        if (tabId === undefined) {
            return true;
        }

        try {
            await chrome.tabs.get(tabId);
            return false;
        } catch (e) {
            return true;
        }
    }

    private _audioBase64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.audioBase64Resolve = resolve;
        });
    }

    private _backgroundPageReady(): Promise<chrome.tabs.Tab> {
        return new Promise((resolve, reject) => {
            this.backgroundPageResolve = resolve;
        });
    }

    private async _fetchBackgroundPageTabId() {
        return (await chrome.storage.session.get('backgroundPageTabId')).backgroundPageTabId;
    }

    private async _setBackgroundPageTabId(tabId: number) {
        await chrome.storage.session.set({ backgroundPageTabId: tabId });
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
