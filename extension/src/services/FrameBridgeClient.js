export default class FrameBridgeClient {

    constructor(frame) {
        this.frame = frame;
    }

    async bind() {
        return new Promise((resolve, reject) => {
            let ready = false;

            this.listener = (event) => {
                if (event.source !== this.frame.contentWindow
                    || event.data.sender !== 'asbplayer-frame') {
                    return;
                }

                switch (event.data.message.command) {
                    case 'ready':
                        this.frameId = event.data.message.id;
                        ready = true;
                        resolve();
                        break;
                    case 'onFinished':
                        if (this.onFinishedListener) {
                            this.onFinishedListener(event.data.message.message);
                        }
                        break;
                    case 'fetch':
                        const message = event.data.message;
                        chrome.runtime.sendMessage(
                            {
                                sender: 'asbplayer-video',
                                message: {
                                    command: 'http-post',
                                    url: message.url,
                                    body: message.body
                                }
                            },
                            postResponse => {
                                const response = postResponse ? postResponse : {error: chrome.runtime.lastError.message};
                                this.frame.contentWindow.postMessage({
                                    sender: 'asbplayer-video',
                                    message: {
                                        command: 'resolveFetch',
                                        response: response,
                                        id: this.frameId,
                                        fetchId: message.fetchId
                                    }
                                }, '*');
                            }
                        );
                        break;
                }
            };

            setTimeout(() => {
                if (!ready) {
                    reject(new Error("Timed out waiting for frame to be ready"));
                    window.removeEventListener('message', this.listener);
                    this.listener = null;
                }
            }, 10000);
            window.addEventListener('message', this.listener);
        });
    }

    updateState(state) {
        if (!this.frameId) {
            throw new Error("Attempted to update state when frame is not ready");
        }

        this.frame.contentWindow.postMessage({
            sender: 'asbplayer-video',
            message: {
                command: 'updateState',
                state: state,
                id: this.frameId
            }
        }, '*');
    }

    onFinished(listener) {
        this.onFinishedListener = listener;
    }

    unbind() {
        if (this.listener) {
            window.removeEventListener('message', this.listener);
        }

        this.onFinishedListener = null;
    }
}