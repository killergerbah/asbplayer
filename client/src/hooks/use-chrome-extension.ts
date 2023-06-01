import { ExtensionVersionMessage } from '@project/common';
import ChromeExtension from '../services/chrome-extension';
import { useEffect, useState } from 'react';

const keyBindNameMap: any = {
    'copy-subtitle': 'copySubtitle',
    'copy-subtitle-with-dialog': 'ankiExport',
    'update-last-card': 'updateLastCard',
    'take-screenshot': 'takeScreenshot',
};

const initialExtension = new ChromeExtension();
let realExtension: ChromeExtension | undefined;

const listenForVersion = (callback: (extension: ChromeExtension) => void) => {
    const versionListener = (event: MessageEvent) => {
        if (event.source !== window) {
            return;
        }

        if (event.data.sender === 'asbplayer-extension-to-player') {
            if (event.data.message.command === 'version') {
                const message = event.data.message as ExtensionVersionMessage;
                const translatedCommands: { [key: string]: string | undefined } = {};
                const extensionCommands = message.extensionCommands ?? {};

                for (const extensionCommandName of Object.keys(extensionCommands)) {
                    translatedCommands[keyBindNameMap[extensionCommandName]] = extensionCommands[extensionCommandName];
                }

                callback(new ChromeExtension(message.version, translatedCommands));
            }
        }
    };

    window.addEventListener('message', versionListener);

    return () => {
        window.removeEventListener('message', versionListener);
    };
};

const unbindInitialListener = listenForVersion((extension) => (realExtension = extension));

export const useChromeExtension = () => {
    const [extension, setExtension] = useState<ChromeExtension>(initialExtension);

    useEffect(() => {
        if (realExtension) {
            setExtension(realExtension);
        } else {
            unbindInitialListener();
            return listenForVersion(setExtension);
        }
    }, []);

    return extension;
};
