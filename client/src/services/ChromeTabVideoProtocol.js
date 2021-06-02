export default class ChromeTabVideoProtocol {

    constructor(tabId, src, extension) {
        this.tabId = tabId;
        this.src = src;
        this.listener = (message) => {
            if (message.tabId === tabId && (!message.src || message.src === src)) {
                this.onMessage?.({
                    data: message.data
                });
            }
        }

        extension.subscribe(this.listener);
        this.extension = extension;
    }

    postMessage(message) {
        this.extension.sendMessage(message, this.tabId, this.src);
    }

    close() {
        this.extension.unsubscribe(this.listener);
    }
}