import { HttpPostMessage, VideoToExtensionCommand } from '@project/common';
import { FrameBridgeProtocol } from './FrameBridgeProtocol';

export interface FetchOptions {
    videoSrc: string;
    allowedFetchUrl?: string;
}

export default class FrameBridgeClient {
    private readonly fetchOptions?: FetchOptions;
    private readonly protocol: FrameBridgeProtocol;

    private frameId?: string;
    private windowMessageListener?: (event: MessageEvent) => void;
    private bindPromise?: Promise<void>;
    private serverMessageListener?: (message: any) => void;

    constructor(protocol: FrameBridgeProtocol, fetchOptions?: FetchOptions) {
        this.fetchOptions = fetchOptions;
        this.bindPromise = undefined;
        this.protocol = protocol;
    }

    async bind() {
        this.bindPromise = this.bindPromise || this._bindClient();
        return this.bindPromise;
    }

    updateState(state: any) {
        if (!this.frameId) {
            throw new Error('Attempted to update state when frame is not ready');
        }

        this.protocol.sendMessage({
            command: 'updateState',
            state: state,
            id: this.frameId,
        });
    }

    sendClientMessage(message: any) {
        if (!this.frameId) {
            throw new Error('Attempted to update state when frame is not ready');
        }

        // this.frame.contentWindow?.postMessage(
        //     {
        //         sender: 'asbplayer-video',
        //         message: {
        //             command: 'sendClientMessage',
        //             message: message,
        //             id: this.frameId,
        //         },
        //     },
        //     '*'
        // );
        this.protocol.sendMessage({
            command: 'sendClientMessage',
            message: message,
            id: this.frameId,
        });
    }

    onServerMessage(listener: (message: any) => void) {
        this.serverMessageListener = listener;
    }

    unbind() {
        this.protocol.unbind();
        this.serverMessageListener = undefined;
    }

    _bindClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            let ready = false;

            this.protocol.bind((message: any) => {
                switch (message.command) {
                    case 'ready':
                        this.frameId = message.id;
                        ready = true;
                        resolve();
                        break;
                    case 'onServerMessage':
                        if (this.serverMessageListener) {
                            this.serverMessageListener(message.message);
                        }
                        break;
                    case 'fetch':
                        if (this.fetchOptions === undefined) {
                            return;
                        }

                        if (
                            this.fetchOptions.allowedFetchUrl === undefined ||
                            message.url !== this.fetchOptions.allowedFetchUrl
                        ) {
                            return;
                        }

                        const httpPostCommand: VideoToExtensionCommand<HttpPostMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'http-post',
                                url: message.url as string,
                                body: message.body as any,
                            },
                            src: this.fetchOptions.videoSrc,
                        };
                        chrome.runtime.sendMessage(httpPostCommand, (postResponse) => {
                            const response = postResponse ? postResponse : { error: chrome.runtime.lastError?.message };
                            this.protocol.sendMessage({
                                command: 'resolveFetch',
                                response: response,
                                id: this.frameId,
                                fetchId: message.fetchId,
                            });
                        });
                        break;
                }
            });

            setTimeout(() => {
                if (!ready) {
                    reject(new Error('Timed out waiting for frame to be ready'));

                    if (this.windowMessageListener) {
                        window.removeEventListener('message', this.windowMessageListener);
                        this.windowMessageListener = undefined;
                    }
                }
            }, 10000);
        });
    }
}
