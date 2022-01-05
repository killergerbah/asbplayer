import { v4 as uuidv4 } from 'uuid';

export default class ChromeExtension {
    constructor(heartbeat) {
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
        this.tabs = [];
        this.versionPromise = new Promise((resolve, reject) => {
            this.versionResolve = resolve;
        });
        this.id = uuidv4();

        window.addEventListener('message', (event) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender === 'asbplayer-extension-to-player') {
                if (event.data.message) {
                    if (event.data.message.command === 'tabs') {
                        this.tabs = event.data.message.tabs;

                        for (let c of this.onTabsCallbacks) {
                            c(this.tabs);
                        }

                        return;
                    }

                    if (event.data.message.command === 'version') {
                        this.versionResolve(event.data.message.version);
                        return;
                    }

                    for (let c of this.onMessageCallbacks) {
                        c({
                            data: event.data.message,
                            tabId: event.data.tabId,
                            src: event.data.src,
                        });
                    }
                }
            }
        });

        if (heartbeat) {
            this._sendHeartbeat();
            setInterval(() => this._sendHeartbeat(), 1000);
        }
    }

    _sendHeartbeat() {
        window.postMessage(
            {
                sender: 'asbplayerv2',
                message: {
                    command: 'heartbeat',
                    id: this.id,
                    receivedTabs: this.tabs,
                },
            },
            '*'
        );
    }

    async installedVersion() {
        return await this.versionPromise;
    }

    sendMessage(message, tabId, src) {
        window.postMessage({ sender: 'asbplayerv2', message: message, tabId: tabId, src: src }, '*');
    }

    publishMessage(message) {
        for (const tab of this.tabs) {
            window.postMessage({ sender: 'asbplayerv2', message: message, tabId: tab.id, src: tab.src }, '*');
        }
    }

    subscribeTabs(callback) {
        this.onTabsCallbacks.push(callback);
    }

    unsubscribeTabs(callback) {
        this._remove(callback, this.onTabsCallbacks);
    }

    subscribe(callback) {
        this.onMessageCallbacks.push(callback);
    }

    unsubscribe(callback) {
        this._remove(callback, this.onMessageCallbacks);
    }

    _remove(callback, callbacks) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
