import { ExtensionVersionMessage } from '@project/common';
import ChromeExtension from '../services/chrome-extension';
import { useEffect, useState } from 'react';

const keyBindNameMap: any = {
    'copy-subtitle': 'copySubtitle',
    'copy-subtitle-with-dialog': 'ankiExport',
    'update-last-card': 'updateLastCard',
    'take-screenshot': 'takeScreenshot',
};

export const useChromeExtension = () => {
    const [extension, setExtension] = useState<ChromeExtension>(new ChromeExtension());

    useEffect(() => {
        const listener = (event: MessageEvent) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender === 'asbplayer-extension-to-player') {
                if (event.data.message.command === 'version') {
                    const message = event.data.message as ExtensionVersionMessage;
                    const translatedCommands: { [key: string]: string | undefined } = {};
                    const extensionCommands = message.extensionCommands ?? {};

                    for (const extensionCommandName of Object.keys(extensionCommands)) {
                        translatedCommands[keyBindNameMap[extensionCommandName]] =
                            extensionCommands[extensionCommandName];
                    }

                    setExtension(new ChromeExtension(message.version, translatedCommands));
                }
            }
        };

        window.addEventListener('message', listener);

        return () => {
            extension.unbind();
            window.removeEventListener('message', listener);
        };
    }, [extension]);

    return extension;
};
