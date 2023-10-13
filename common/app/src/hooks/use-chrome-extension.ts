import { ExtensionVersionMessage, chromeCommandBindsToKeyBinds } from '@project/common';
import ChromeExtension from '../services/chrome-extension';
import { useEffect, useState } from 'react';

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
                const extensionCommands = message.extensionCommands ?? {};

                callback(new ChromeExtension(message.version, chromeCommandBindsToKeyBinds(extensionCommands)));
            }
        }
    };

    window.addEventListener('message', versionListener);

    return () => {
        window.removeEventListener('message', versionListener);
    };
};

const unbindInitialListener = listenForVersion((extension) => (realExtension = extension));

export interface ChromeExtensionOptions {
    sidePanel: boolean;
}

export const useChromeExtension = ({ sidePanel }: ChromeExtensionOptions) => {
    const [extension, setExtension] = useState<ChromeExtension>(initialExtension);
    extension.sidePanel = sidePanel;

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
