import {
    ExtensionToBackgroundPageCommand,
    StartRecordingAudio,
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
} from '@project/common';
import TabRegistry from './TabRegistry';

export default class BackgroundPageAudioRecorder {
    private readonly tabRegistry: TabRegistry;

    private backgroundPageResolve?: (value: chrome.tabs.Tab) => void;
    private audioBase64Resolve?: (value: string) => void;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
        tabRegistry.onNoSyncedElements(async () => {
            const tabId = (await chrome.storage.session.get('backgroundPageTabId')).backgroundPageTabId;

            if (await this._tabDoesNotExist(tabId)) {
                return;
            }

            await chrome.tabs.remove(tabId);
        });
    }

    onBackgroundPageReady(tab: chrome.tabs.Tab) {
        this.backgroundPageResolve?.(tab);
        this.backgroundPageResolve = undefined;
    }

    onAudioBase64(base64: string) {
        this.audioBase64Resolve?.(base64);
        this.audioBase64Resolve = undefined;
    }

    async startWithTimeout(time: number, preferMp3: boolean): Promise<string> {
        const tabId = await this._backgroundPageTabId();

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
        chrome.tabs.sendMessage(tabId, command);
        return await this._audioBase64();
    }

    async start() {
        const tabId = await this._backgroundPageTabId();

        if (this.audioBase64Resolve !== undefined) {
            throw new Error('Already recording');
        }

        const command: ExtensionToBackgroundPageCommand<StartRecordingAudio> = {
            sender: 'asbplayer-extension-to-background-page',
            message: {
                command: 'start-recording-audio',
            },
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
        return await this._audioBase64();
    }

    private async _backgroundPageTabId() {
        const tabId = (await chrome.storage.session.get('backgroundPageTabId')).backgroundPageTabId;

        if (await this._tabDoesNotExist(tabId)) {
            this.audioBase64Resolve = undefined;
            await chrome.tabs.create({
                pinned: true,
                active: false,
                url: `chrome-extension://${chrome.runtime.id}/background-page.html`,
            });
            const tab = await this._backgroundPageReady();
            await chrome.storage.session.set({ backgroundPageTabId: tab.id });
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
}
