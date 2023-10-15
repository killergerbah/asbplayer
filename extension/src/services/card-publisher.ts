import { CopyMessage, ExtensionToAsbPlayerCommand, ExtensionToBackgroundPageCommand } from '@project/common';
import TabRegistry from './tab-registry';

export class CardPublisher {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    publish(message: CopyMessage, fromTabId: number, fromSrc: string) {
        const asbplayerCopyCommand: ExtensionToAsbPlayerCommand<CopyMessage> = {
            sender: 'asbplayer-extension-to-player',
            message,
            tabId: fromTabId,
            src: fromSrc,
        };
        let published = 0;

        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                ++published;
                return !asbplayer.sidePanel && !asbplayer.videoPlayer ? asbplayerCopyCommand : undefined;
            },
        });

        if (published === 0) {
            const backgroundPageCopyCommand: ExtensionToBackgroundPageCommand<CopyMessage> = {
                sender: 'asbplayer-extension-to-background-page',
                message,
            };
            chrome.runtime.sendMessage(backgroundPageCopyCommand);
        }
    }
}
