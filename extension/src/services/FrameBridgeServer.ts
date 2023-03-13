import { v4 as uuidv4 } from 'uuid';
import Bridge from '../ui/Bridge';
import { FrameBridgeProtocol } from './FrameBridgeProtocol';

const fetchTimeout = 5000;

export default class FrameBridgeServer {
    private readonly bridge: Bridge;
    private readonly fetches: { [key: string]: (response: any) => void };
    private readonly protocol;
    private id?: string;

    constructor(bridge: Bridge, protocol: FrameBridgeProtocol) {
        this.bridge = bridge;
        this.fetches = {};
        this.protocol = protocol;
    }

    bind() {
        this.id = uuidv4();
        this.protocol.bind((message) => {
            if (message.id !== this.id) {
                return;
            }

            switch (message.command) {
                case 'updateState':
                    this.bridge.updateState(message.state);
                    break;
                case 'resolveFetch':
                    if (message.fetchId in this.fetches) {
                        this.fetches[message.fetchId](message.response);
                        delete this.fetches[message.fetchId];
                    }
                    break;
                case 'sendClientMessage':
                    this.bridge.sendClientMessage(message.message);
                    break;
            }
        });
        this.bridge.onServerMessage((message: any) => {
            this.protocol.sendMessage({
                command: 'onServerMessage',
                message: message,
            });
        });
        this.bridge.onFetch((url: string, body: any) => {
            return new Promise((resolve, reject) => {
                const fetchId = uuidv4();
                this.fetches[fetchId] = resolve;
                this.protocol.sendMessage({
                    command: 'fetch',
                    url: url,
                    body: body,
                    fetchId: fetchId,
                });
                setTimeout(() => {
                    if (fetchId in this.fetches) {
                        reject(new Error('Fetch timed out'));
                        delete this.fetches[fetchId];
                    }
                }, fetchTimeout);
            });
        });
        this.protocol.sendMessage({
            command: 'ready',
            id: this.id,
        });
    }

    unbind() {
        this.protocol.unbind();
    }
}
