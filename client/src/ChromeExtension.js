export default class ChromeExtension {

    constructor() {
        this.onMessageCallbacks = [];
        this.tabs = [];
        window.addEventListener('message', (event) => {
            if (event.source !== window) {
               return;
            }

            if (event.data.sender === 'asbplayer-extension-to-player') {
                if (event.data.message) {
                    if (event.data.message.command === 'tabs') {
                        this.tabs = event.data.message.tabs;
                    } else {
                        for (let c of this.onMessageCallbacks) {
                            c({
                                data: event.data.message,
                                tabId: event.data.tabId
                            });
                        }
                    }
                }
            }
        });
    }

    sendMessage(message, tabId) {
        window.postMessage({sender: 'asbplayer', message: message, tabId: tabId}, '*');
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