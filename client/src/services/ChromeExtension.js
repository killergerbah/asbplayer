export default class ChromeExtension {

    constructor() {
        this.onMessageCallbacks = [];
        this.tabs = [];
        this.versionPromise = new Promise((resolve, reject) => {
            this.versionResolve = resolve;
        });

        window.addEventListener('message', (event) => {
            if (event.source !== window) {
               return;
            }

            if (event.data.sender === 'asbplayer-extension-to-player') {
                if (event.data.message) {
                    if (event.data.message.command === 'tabs') {
                        this.tabs = event.data.message.tabs;
                        return;
                    }

                    if (event.data.message.command === 'version') {
                        this.versionResolve(event.data.message.version);
                        return;
                    }

                    for (let c of this.onMessageCallbacks) {
                        c({
                            data: event.data.message,
                            tabId: event.data.tabId
                        });
                    }
                }
            }
        });
    }

    async installedVersion() {
        return await this.versionPromise;
    }

    sendMessage(message, tabId) {
        window.postMessage({sender: 'asbplayer', message: message, tabId: tabId}, '*');
    }

    publishMessage(message) {
        for (const tab of this.tabs) {
            window.postMessage({sender: 'asbplayer', message: message, tabId: tab.id}, '*');
        }
    }

    subscribe(callback) {
        this.onMessageCallbacks.push(callback);
    }

    unsubscribe(callback) {
        for (let i = this.onMessageCallbacks.length - 1; i >= 0; --i) {
            if (callback === this.onMessageCallbacks[i]) {
                this.onMessageCallbacks.splice(i, 1);
                break;
            }
        }
    }
}