import { ForwardCommandMessage } from '@project/common';
import FrameBridgeServer from './services/frame-bridge-server';
import { renderAppUi } from './ui/app';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const bridge = renderAppUi(root, root.dataset.logoUrl!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    const playerMessageListener = (event: MessageEvent) => {
        if (event.source !== window) {
            return;
        }

        if (event.data.sender === 'asbplayer' || event.data.sender === 'asbplayerv2') {
            const forwardCommandMessage: ForwardCommandMessage = {
                command: 'forward-command',
                commandToForward: {
                    sender: event.data.sender,
                    message: event.data.message,
                    tabId: event.data.tabId,
                    src: event.data.src,
                },
            };
            bridge.sendMessageFromServer(forwardCommandMessage);
        }
    };

    window.addEventListener('message', playerMessageListener);

    const unbindClientMessageListener = bridge.addClientMessageListener((message) => {
        window.postMessage(message, '*');
    });

    const manifest = JSON.parse(document.getElementById('manifest')!.innerHTML!);
    const extensionCommands = JSON.parse(document.getElementById('extensionCommands')!.innerHTML!);

    window.postMessage(
        {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'version',
                version: manifest.version,
                extensionCommands,
            },
        },
        '*'
    );

    window.addEventListener('unload', (e) => {
        listener.unbind();
        window.removeEventListener('message', playerMessageListener);
        unbindClientMessageListener();
    });
});
