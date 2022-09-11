import {
    ExtensionToOptionsPageCommand,
    StartRecordingAudio,
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
} from '@project/common';

export default class OptionsPageAudioRecorder {
    private optionsPageResolve?: (value: chrome.tabs.Tab) => void;
    private audioBase64Resolve?: (value: string) => void;

    onOptionsPageReady(tab: chrome.tabs.Tab) {
        this.optionsPageResolve?.(tab);
        this.optionsPageResolve = undefined;
    }

    onAudioBase64(base64: string) {
        this.audioBase64Resolve?.(base64);
    }

    async startWithTimeout(time: number, preferMp3: boolean): Promise<string> {
        const tabId = await this._optionsPageTabId();
        const command: ExtensionToOptionsPageCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-options-page',
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
        const tabId = await this._optionsPageTabId();
        const command: ExtensionToOptionsPageCommand<StartRecordingAudio> = {
            sender: 'asbplayer-extension-to-options-page',
            message: {
                command: 'start-recording-audio',
            },
        };
        chrome.tabs.sendMessage(tabId, command);
    }

    async stop(preferMp3: boolean): Promise<string> {
        const tabId = await this._optionsPageTabId();
        const command: ExtensionToOptionsPageCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-options-page',
            message: {
                command: 'stop-recording-audio',
                preferMp3,
            },
        };
        chrome.tabs.sendMessage(tabId, command);
        return await this._audioBase64();
    }

    private async _optionsPageTabId() {
        const tabId = (await chrome.storage.session.get('optionsPageTabId')).optionsPageTabId;

        if (await this._tabDoesNotExist(tabId)) {
            await chrome.tabs.create({
                pinned: true,
                active: false,
                url: `chrome-extension://${chrome.runtime.id}/options.html`,
            });
            const tab = await this._optionsPageReady();
            await chrome.storage.session.set({ optionsPageTabId: tab.id });
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

    private _optionsPageReady(): Promise<chrome.tabs.Tab> {
        return new Promise((resolve, reject) => {
            this.optionsPageResolve = resolve;
        });
    }
}
