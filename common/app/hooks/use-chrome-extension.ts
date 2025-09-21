import { ExtensionStateMessage } from '@project/common';
import { chromeCommandBindsToKeyBinds } from '@project/common/settings';
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
            if (event.data.message.command === 'extension-state') {
                const message = event.data.message as ExtensionStateMessage;
                const extensionCommands = message.state.commands;
                const pageConfig = message.state.pages;
                callback(
                    new ChromeExtension(message.version, chromeCommandBindsToKeyBinds(extensionCommands), pageConfig)
                );
            }
        }
    };

    window.addEventListener('message', versionListener);

    return () => {
        window.removeEventListener('message', versionListener);
    };
};

const unbindInitialListener = listenForVersion((extension) => (realExtension = extension));
export type AsbplayerComponent = 'sidePanel' | 'videoPlayer' | 'application';

export interface ChromeExtensionOptions {
    component: AsbplayerComponent;
}

export const useChromeExtension = ({ component }: ChromeExtensionOptions) => {
    const [extension, setExtension] = useState<ChromeExtension>(initialExtension);
    extension.sidePanel = component === 'sidePanel';
    extension.videoPlayer = component === 'videoPlayer';

    useEffect(() => {
        unbindInitialListener();

        if (realExtension) {
            initialExtension.unbind();
            setExtension(realExtension);
        } else {
            const unbindNextListener = listenForVersion((extension) => {
                initialExtension.unbind();
                setExtension(extension);
                unbindNextListener();
            });
        }
    }, []);

    return extension;
};
