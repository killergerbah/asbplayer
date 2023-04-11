import { ExtensionVersionMessage } from '@project/common';
import ChromeExtension from './chrome-extension';

const keyBindNameMap: any = {
    'copy-subtitle': 'copySubtitle',
    'copy-subtitle-with-dialog': 'ankiExport',
    'update-last-card': 'updateLastCard',
};

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
                    const message = event.data.message as ExtensionVersionMessage;

                    for (const callback of this.callbacks) {
                        this.extension.unbind();
                        const translatedCommands: { [key: string]: string | undefined } = {};
                        const extensionCommands = message.extensionCommands ?? {};
                        
                        for (const extensionCommandName of Object.keys(extensionCommands)) {
                            translatedCommands[keyBindNameMap[extensionCommandName]] =
                                extensionCommands[extensionCommandName];
                        }

                        this.extension = new ChromeExtension(message.version, translatedCommands);
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
