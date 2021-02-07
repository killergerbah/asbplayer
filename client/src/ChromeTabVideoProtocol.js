export default class ChromeTabVideoProtocol {

    constructor(tabId, extension) {
        this.tabId = tabId;
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
        this.extension.sendMessage(message, this.tabId);
    }

    close() {
        this.extension.unsubscribe(this.listener);
    }
}