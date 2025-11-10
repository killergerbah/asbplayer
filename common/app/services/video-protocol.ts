import { Message } from '@project/common';

export interface VideoProtocol {
    readonly fromExtension: boolean;
    postMessage: (message: Message) => void;
    close: () => void;
    onMessage?: (message: VideoProtocolMessage) => void;
}

export interface VideoProtocolMessage {
    data: Message;
}
