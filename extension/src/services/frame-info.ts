import { v4 as uuidv4 } from 'uuid';

export class FrameInfoListener {
    readonly frameId = uuidv4();
    private _windowMessageListener?: (event: MessageEvent) => void;

    bind() {
        this._windowMessageListener = (event) => {
            if (event.data.sender !== 'asbplayer-video') {
                return;
            }

            if (event.source !== window.parent) {
                return;
            }

            switch (event.data.message.command) {
                case 'frameId': {
                    window.parent.postMessage(
                        {
                            sender: 'asbplayer-video',
                            message: {
                                requestId: event.data.message.requestId,
                                frameId: this.frameId,
                            },
                        },
                        '*'
                    );
                }
            }
        };
        window.addEventListener('message', this._windowMessageListener);
    }

    unbind() {
        if (this._windowMessageListener) {
            window.removeEventListener('message', this._windowMessageListener);
        }
    }
}

export const fetchFrameId = (frame: HTMLIFrameElement): Promise<string | undefined> => {
    return new Promise((resolve, reject) => {
        if (!frame.contentWindow) {
            return resolve(undefined);
        }

        const requestId = uuidv4();
        let timeoutId: NodeJS.Timeout | undefined;
        const listener = (event: MessageEvent) => {
            if (event.source !== frame.contentWindow) {
                return;
            }

            if (event.data.message?.requestId !== requestId) {
                return;
            }

            if (typeof event.data.message?.frameId === 'string') {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                window.removeEventListener('message', listener);
                resolve(event.data.message.frameId);
            }
        };

        window.addEventListener('message', listener);
        frame.contentWindow.postMessage(
            {
                sender: 'asbplayer-video',
                message: {
                    command: 'frameId',
                    requestId: requestId,
                },
            },
            '*'
        );

        timeoutId = setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve(undefined);
        }, 1000);
    });
};
