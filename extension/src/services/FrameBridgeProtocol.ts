export interface FrameBridgeProtocol {
    bind: (serverListener: (message: any) => void) => void;
    sendMessage: (message: any) => void;
    unbind: () => void;
}

export class WindowMessageProtocol implements FrameBridgeProtocol {
    private readonly source: string;
    private readonly destination: string;
    private readonly destinationWindow: Window;
    private windowMessageListener?: (event: MessageEvent) => void;
    private serverListener?: (message: any) => void;

    constructor(source: string, destination: string, destinationWindow: Window) {
        this.source = source;
        this.destination = destination;
        this.destinationWindow = destinationWindow;
    }

    bind(serverListener: (message: any) => void) {
        this.serverListener = serverListener;
        this.windowMessageListener = (event) => {
            if (event.data.sender !== this.destination) {
                return;
            }

            if (event.source !== this.destinationWindow) {
                return;
            }

            this.serverListener?.(event.data.message);
        };
        window.addEventListener('message', this.windowMessageListener);
    }

    sendMessage(message: any) {
        this.destinationWindow.postMessage(
            {
                sender: this.source,
                message: message,
            },
            '*'
        );
    }

    unbind() {
        if (this.windowMessageListener) {
            window.removeEventListener('message', this.windowMessageListener);
            this.windowMessageListener = undefined;
        }

        this.serverListener = undefined;
    }
}

export class ExtensionMessageProtocol implements FrameBridgeProtocol {
    private readonly source: string;
    private readonly destination: string;
    private extensionMessageListener?: (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private serverListener?: (message: any) => void;

    constructor(source: string, destination: string) {
        this.source = source;
        this.destination = destination;
    }

    bind(serverListener: (message: any) => void) {
        this.serverListener = serverListener;
        this.extensionMessageListener = (
            message: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.sender !== this.destination) {
                return;
            }

            this.serverListener?.(message.message);
        };
        chrome.runtime.onMessage.addListener(this.extensionMessageListener);
    }

    sendMessage(message: any) {
        chrome.runtime.sendMessage({
            sender: this.source,
            message,
        });
    }

    unbind() {
        if (this.extensionMessageListener) {
            chrome.runtime.onMessage.removeListener(this.extensionMessageListener);
            this.extensionMessageListener = undefined;
        }

        this.serverListener = undefined;
    }
}
