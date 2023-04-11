import {
    ExtensionToBackgroundPageCommand,
    StartRecordingAudio,
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
} from '@project/common';
import TabRegistry from './tab-registry';

const backgroundPageUrl = `chrome-extension://${chrome.runtime.id}/background-page.html`;

export default class BackgroundPageAudioRecorder {
    private backgroundPageResolve?: (value: chrome.tabs.Tab) => void;
    private audioBase64Resolve?: (value: string) => void;

    constructor(tabRegistry: TabRegistry) {
        tabRegistry.onNoSyncedElements(async () => {
            this._removeBackgroundPage();
        });
        tabRegistry.onSyncedElement(async () => {
            this._backgroundPageTabId();
        });
        this._removeOrphanedBackgroundPage();
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
}
