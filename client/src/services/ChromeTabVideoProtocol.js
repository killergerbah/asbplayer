export default class ChromeTabVideoProtocol {

    constructor(tabId, src, extension) {
        this.tabId = tabId;
        this.src = src;
        this.listener = (message) => {
            if (message.tabId === tabId) {
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