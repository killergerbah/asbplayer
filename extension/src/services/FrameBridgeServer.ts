import { v4 as uuidv4 } from 'uuid';
import Bridge from '../ui/Bridge';

const fetchTimeout = 5000;

export default class FrameBridgeServer {
    private readonly bridge: Bridge;
    private readonly fetches: {[key: string]: (response: any) => void};
    private id?: string;
    private windowMessageListener?: (event: MessageEvent) => void;

    constructor(bridge: Bridge) {
        this.bridge = bridge;
        this.fetches = {};
    }

    bind() {
        this.id = uuidv4();
        this.windowMessageListener = (event) => {
            if (event.data.sender !== 'asbplayer-video' || event.data.message.id !== this.id) {
                return;
            }

            switch (event.data.message.command) {
                case 'updateState':
                    this.bridge.updateState(event.data.message.state);
                    break;
                case 'resolveFetch':
                    if (event.data.message.fetchId in this.fetches) {
                        this.fetches[event.data.message.fetchId](event.data.message.response);
                        delete this.fetches[event.data.message.fetchId];
                    }
                    break;
            }
        };
        this.bridge.onFinished((message: any) => {
            this._postMessage({
                command: 'onFinished',
                message: message,
            });
        });
        this.bridge.onFetch(async (url: string, body: any) => {
            return new Promise((resolve, reject) => {
                const fetchId = uuidv4();
                this.fetches[fetchId] = resolve;
                this._postMessage({
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
        window.addEventListener('message', this.windowMessageListener);
        this._postMessage({
            command: 'ready',
            id: this.id,
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
