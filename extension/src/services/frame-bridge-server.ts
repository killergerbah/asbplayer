import { v4 as uuidv4 } from 'uuid';
import Bridge from '../ui/bridge';
import { Message } from '@project/common';

export default class FrameBridgeServer {
    private readonly bridge: Bridge;
    private readonly fetches: { [key: string]: (response: any) => void };
    private frameId?: string;
    private windowMessageListener?: (event: MessageEvent) => void;

    constructor(bridge: Bridge) {
        this.bridge = bridge;
        this.fetches = {};
    }

    bind() {
        this.frameId = uuidv4();
        this.windowMessageListener = (event) => {
            if (event.data.sender !== 'asbplayer-video' || event.data.message.frameId !== this.frameId) {
                return;
            }

            if (event.source !== window.parent) {
                return;
            }

            switch (event.data.message.command) {
                case 'sendClientMessage':
                    this.bridge.sendMessageFromClient(event.data.message.message);
                    break;
            }
        };
        this.bridge.addServerMessageListener((message: Message) => {
            this._postMessage({
                command: 'onServerMessage',
                message: message,
            });
        });
        window.addEventListener('message', this.windowMessageListener);
        this._postMessage({
            command: 'ready',
            frameId: this.frameId,
        });
    }

    _postMessage(message: any) {
        window.parent.postMessage(
            {
                sender: 'asbplayer-frame',
                message: message,
            },
            '*'
        );
    }

    unbind() {
        if (this.windowMessageListener) {
            window.removeEventListener('message', this.windowMessageListener);
        }

        this.bridge.unbind();
    }
}
