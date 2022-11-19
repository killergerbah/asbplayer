import ChromeExtension from './ChromeExtension';

export class ChromeExtensionProvider {
    extension: ChromeExtension = new ChromeExtension();
    private readonly callbacks: ((extension: ChromeExtension) => void)[] = [];

    constructor() {
        const listener = (event: MessageEvent) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender === 'asbplayer-extension-to-player') {
                if (event.data.message.command === 'version') {
                    for (const callback of this.callbacks) {
                        this.extension.unbind();
                        this.extension = new ChromeExtension(event.data.message.version);
                        callback(this.extension);
                    }

                    window.removeEventListener('message', listener);
                }
            }
        };

        window.addEventListener('message', listener);
    }

    onChromeExtension(callback: (extension: ChromeExtension) => void) {
        this.callbacks.push(callback);
        callback(this.extension);
    }
}
