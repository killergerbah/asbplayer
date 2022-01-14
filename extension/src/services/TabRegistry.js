export default class TabRegistry {
    constructor(settings) {
        this.asbplayers = {};
        this.videoElements = {};
        this.settings = settings;
        setInterval(() => this.publish(), 1000);
    }

    async publish() {
        return new Promise((resolve, reject) => {
            const expired = Date.now() - 5000;

            for (const tabId in this.asbplayers) {
                const asbplayer = this.asbplayers[tabId];

                if (asbplayer.timestamp < expired) {
                    delete this.asbplayers[tabId];
                }
            }

            const activeVideoElements = [];

            for (const id in this.videoElements) {
                const videoElement = this.videoElements[id];

                if (videoElement.timestamp < expired) {
                    delete this.videoElements[id];
                } else {
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

    async findAsbplayerTab(videoTab, videoSrc) {
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

    async _createNewTab(videoTab) {
        return new Promise(async (resolve) => {
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

    _anyAsbplayerTab(videoTab, videoSrc, resolve, reject, attempt, maxAttempts) {
        if (attempt >= maxAttempts) {
            reject(new Error('Could not find or create an asbplayer tab'));
            return;
        }

        for (const tabId in this.asbplayers) {
            if (this._asbplayerReceivedVideoTabData(this.asbplayers[tabId], videoTab, videoSrc)) {
                resolve(tabId);
                return;
            }
        }

        setTimeout(() => this._anyAsbplayerTab(videoTab, videoSrc, resolve, reject, attempt + 1, maxAttempts), 1000);
    }

    _asbplayerReceivedVideoTabData(asbplayer, videoTab, videoSrc) {
        for (const tab of asbplayer.receivedTabs) {
            if (tab.id == videoTab.id && tab.src === videoSrc) {
                return true;
            }
        }

        // Support older asbplayer clients that don't send the receivedTabs array
        return typeof asbplayer.receivedTabs === 'undefined';
    }
}
