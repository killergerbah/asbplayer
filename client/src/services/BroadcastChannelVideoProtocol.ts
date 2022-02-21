import { Message } from "@project/common";
import { VideoProtocol, VideoProtocolMessage } from "./VideoProtocol";

export default class BroadcastChannelVideoProtocol implements VideoProtocol {
    private channel?: BroadcastChannel;

    onMessage?: (message: VideoProtocolMessage) => void;
    
    constructor(channelId: string) {
        this.channel = new BroadcastChannel(channelId);
        const that = this;
        this.channel.onmessage = (event) => {
            that.onMessage?.(event as VideoProtocolMessage);
        };
    }

    postMessage(message: Message) {
        this.channel?.postMessage(message);
    }

    close() {
        this.channel?.close();
        this.channel = undefined;
    }
}
