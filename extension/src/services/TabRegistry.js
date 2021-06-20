export default class TabRegistry {

    constructor() {
        this.asbplayers = {};
        this.videoElements = {};
        setInterval(() => this.publish(), 1000);
    }

    async publish() {
        return new Promise((resolve, reject) => {
            const expired = Date.now() - 5000;

            for (const tabId in this.asbplayers) {
                const info = this.asbplayers[tabId];

                if (info.timestamp < expired) {
                    delete this.asbplayers[tabId];
                }
            }

            const activeTabs = [];

            for (const id in this.videoElements) {
                const info = this.videoElements[id];

                if (info.timestamp < expired) {
                    delete this.videoElements[id];
                } else {
                    activeTabs.push({
                        id: info.tab.id,
                        title: info.tab.title,
                        src: info.src
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
                            tabs: activeTabs
                        }
                    });
                }

                resolve();
            });
        });
    }

    async findAsbplayerTab(currentTab) {
        let chosenTabId = null;
        const now = Date.now();
        let min = null;

        for (const tabId in this.asbplayers) {
            const info = this.asbplayers[tabId];
            const elapsed = now - info.timestamp;

            if (min === null || elapsed < min) {
                min = elapsed;
                chosenTabId = tabId;
            }
        }

        if (chosenTabId) {
            return chosenTabId;
        }

        return new Promise((resolve, reject) => {
            chrome.tabs.create(
                {
                    active: false,
                    selected: false,
                    url: 'https://killergerbah.github.io/asbplayer/',
                    index: currentTab.index + 1
                },
                (tab) => this._anyAsbplayerTab(resolve, reject, 0, 5)
            );
        });
    }

    _anyAsbplayerTab(resolve, reject, attempt, maxAttempts) {
        if (attempt >= maxAttempts) {
            reject(new Error("Could not find or create an asbplayer tab"));
            return;
        }

        for (const tabId in this.asbplayers) {
            resolve(tabId);
            return;
        }

        setTimeout(() => this._anyAsbplayerTab(resolve, attempt + 1, maxAttempts), 1000);
    }

    sendToActiveVideoElement(message) {
        chrome.tabs.query({active: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
                return;
            }

            for (const tab of tabs) {
                for (const id in this.videoElements) {
                    if (this.videoElements[id].tab.id === tab.id) {
                        chrome.tabs.sendMessage(this.videoElements[id].tab.id, {
                            sender: 'asbplayer-extension-to-video',
                            message: message,
                            src: this.videoElements[id].src
                        });
                    }
                }
            }
        });
    }

    sendToActiveAsbplayer(message) {
        chrome.tabs.query({active: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
                return;
            }

            for (const tab of tabs) {
                for (const id in this.asbplayers) {
                    if (this.asbplayers[id].tab.id === tab.id) {
                        chrome.tabs.sendMessage(this.asbplayers[id].tab.id, {
                            sender: 'asbplayer-extension-to-player',
                            message: message
                        });
                    }
                }
            }
        });
    }
}