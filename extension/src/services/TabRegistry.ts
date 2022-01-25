import { ActiveVideoElement } from '@project/common';

interface Asbplayer {
    id: string;
    tab: chrome.tabs.Tab;
    timestamp: number;
    receivedTabs?: ActiveVideoElement[];
}

interface VideoElement {
    tab: chrome.tabs.Tab;
    timestamp: number;
    src: string;
}

export default class TabRegistry {
    public readonly asbplayers: { [key: number]: Asbplayer };
    public readonly videoElements: { [key: string]: VideoElement };
    private readonly settings: any;

    constructor(settings: any) {
        this.asbplayers = {};
        this.videoElements = {};
        this.settings = settings;
        setInterval(() => this.publish(), 1000);
    }

    async publish() {
        return new Promise<void>((resolve, reject) => {
            const expired = Date.now() - 5000;

            for (const tabId in this.asbplayers) {
                const asbplayer = this.asbplayers[tabId];

                if (asbplayer.timestamp < expired) {
                    delete this.asbplayers[tabId];
                }
            }

            const activeVideoElements: ActiveVideoElement[] = [];

            for (const id in this.videoElements) {
                const videoElement = this.videoElements[id];

                if (videoElement.timestamp < expired) {
                    delete this.videoElements[id];
                } else if (videoElement.tab.id) {
                    activeVideoElements.push({
                        id: videoElement.tab.id,
                        title: videoElement.tab.title,
                        src: videoElement.src,
                    });
                }
            }

            chrome.tabs.query({}, (allTabs) => {
                if (!allTabs) {
                    // Chrome doesn't allow tabs to be queried when the user is dragging tabs
                    resolve();
                    return;
                }

                for (let t of allTabs) {
                    if (!t.id) {
                        continue;
                    }

                    chrome.tabs.sendMessage(t.id, {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'tabs',
                            tabs: activeVideoElements,
                        },
                    });
                }

                resolve();
            });
        });
    }

    async findAsbplayerTab(videoTab: chrome.tabs.Tab, videoSrc: string) {
        let chosenTabId = null;
        const now = Date.now();
        let min = null;

        for (const tabId in this.asbplayers) {
            const asbplayer = this.asbplayers[tabId];

            if (this._asbplayerReceivedVideoTabData(asbplayer, videoTab, videoSrc)) {
                const elapsed = now - asbplayer.timestamp;

                if (min === null || elapsed < min) {
                    min = elapsed;
                    chosenTabId = tabId;
                }
            }
        }

        if (chosenTabId) {
            return chosenTabId;
        }

        return new Promise(async (resolve, reject) => {
            if (!Object.keys(this.asbplayers).length) {
                await this._createNewTab(videoTab);
            }
            this._anyAsbplayerTab(videoTab, videoSrc, resolve, reject, 0, 5);
        });
    }

    async _createNewTab(videoTab: chrome.tabs.Tab) {
        return new Promise<chrome.tabs.Tab>(async (resolve, reject) => {
            chrome.tabs.create(
                {
                    active: false,
                    selected: false,
                    url: (await this.settings.get(['asbplayerUrl'])).asbplayerUrl,
                    index: videoTab.index + 1,
                },
                resolve
            );
        });
    }

    _anyAsbplayerTab(
        videoTab: chrome.tabs.Tab,
        videoSrc: string,
        resolve: (value: number | PromiseLike<number>) => void,
        reject: (reason?: any) => void,
        attempt: number,
        maxAttempts: number
    ) {
        if (attempt >= maxAttempts) {
            reject(new Error('Could not find or create an asbplayer tab'));
            return;
        }

        for (const tabId in this.asbplayers) {
            if (this._asbplayerReceivedVideoTabData(this.asbplayers[tabId], videoTab, videoSrc)) {
                resolve(Number(tabId));
                return;
            }
        }

        setTimeout(() => this._anyAsbplayerTab(videoTab, videoSrc, resolve, reject, attempt + 1, maxAttempts), 1000);
    }

    _asbplayerReceivedVideoTabData(asbplayer: Asbplayer, videoTab: chrome.tabs.Tab, videoSrc: string) {
        if (typeof asbplayer.receivedTabs === 'undefined') {
            // Support older asbplayer clients that don't send the receivedTabs array
            return true;
        }

        for (const tab of asbplayer.receivedTabs) {
            if (tab.id == videoTab.id && tab.src === videoSrc) {
                return true;
            }
        }

        return false;
    }
}
