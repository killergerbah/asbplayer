export default class BroadcastChannelVideoProtocol {
    constructor(channelId) {
        this.channel = new BroadcastChannel(channelId);
        const that = this;
        this.channel.onmessage = (event) => {
            that.onMessage?.(event);
        };
    }

    postMessage(message) {
        this.channel?.postMessage(message);
    }

    close() {
        this.channel?.close();
        this.channel = null;
    }
}
