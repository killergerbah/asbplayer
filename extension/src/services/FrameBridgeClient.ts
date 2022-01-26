import { HttpPostMessage, VideoToExtensionCommand } from "@project/common";

export default class FrameBridgeClient {
    private readonly frame: HTMLIFrameElement;
    private readonly videoSrc: string;
    private frameId?: string;
    private windowMessageListener?: (event: MessageEvent) => void;
    private bindPromise?: Promise<void>;
    private finishedListener?: (message: any) => void;

    constructor(frame: HTMLIFrameElement, videoSrc: string) {
        this.frame = frame;
        this.videoSrc = videoSrc;
        this.bindPromise = undefined;
    }

    async bind() {
        this.bindPromise = this.bindPromise || this._bindClient();

        return this.bindPromise;
    }

    updateState(state: any) {
        if (!this.frameId) {
            throw new Error('Attempted to update state when frame is not ready');
        }

        this.frame.contentWindow?.postMessage(
            {
                sender: 'asbplayer-video',
                message: {
                    command: 'updateState',
                    state: state,
                    id: this.frameId,
                },
            },
            '*'
        );
    }

    onFinished(listener: (message: any) => void) {
        this.finishedListener = listener;
    }

    unbind() {
        if (this.windowMessageListener) {
            window.removeEventListener('message', this.windowMessageListener);
            this.windowMessageListener = undefined;
        }

        this.finishedListener = undefined;
    }

    _bindClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            let ready = false;

            this.windowMessageListener = (event) => {
                if (event.source !== this.frame.contentWindow || event.data.sender !== 'asbplayer-frame') {
                    return;
                }

                switch (event.data.message.command) {
                    case 'ready':
                        this.frameId = event.data.message.id;
                        ready = true;
                        resolve();
                        break;
                    case 'onFinished':
                        if (this.finishedListener) {
                            this.finishedListener(event.data.message.message);
                        }
                        break;
                    case 'fetch':
                        const message = event.data.message;
                        const httpPostCommand: VideoToExtensionCommand<HttpPostMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'http-post',
                                url: message.url as string,
                                body: message.body as any,
                            },
                            src: this.videoSrc
                        };
                        chrome.runtime.sendMessage(
                            httpPostCommand,
                            (postResponse) => {
                                const response = postResponse
                                    ? postResponse
                                    : { error: chrome.runtime.lastError?.message };
                                this.frame.contentWindow?.postMessage(
                                    {
                                        sender: 'asbplayer-video',
                                        message: {
                                            command: 'resolveFetch',
                                            response: response,
                                            id: this.frameId,
                                            fetchId: message.fetchId,
                                        },
                                    },
                                    '*'
                                );
                            }
                        );
                        break;
                }
            };

            setTimeout(() => {
                if (!ready) {
                    reject(new Error('Timed out waiting for frame to be ready'));

                    if (this.windowMessageListener) {
                        window.removeEventListener('message', this.windowMessageListener);
                        this.windowMessageListener = undefined;
                    }
                }
            }, 10000);
            window.addEventListener('message', this.windowMessageListener);
        });
    }
}
