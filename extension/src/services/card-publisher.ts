import { Card, CopyMessage, ExtensionToBackgroundPageCommand } from '@project/common';
import BackgroundPageManager from './background-page-manager';

export class CardPublisher {
    private readonly _backgroundPageManager: BackgroundPageManager;
    constructor(backgroundPageManager: BackgroundPageManager) {
        this._backgroundPageManager = backgroundPageManager;
    }

    async publish(card: Card) {
        const backgroundPageCopyCommand: ExtensionToBackgroundPageCommand<CopyMessage> = {
            sender: 'asbplayer-extension-to-background-page',
            message: { ...card, command: 'copy' },
        };
        const tabId = await this._backgroundPageManager.tabId();

        if (tabId !== undefined) {
            chrome.tabs.sendMessage(tabId, backgroundPageCopyCommand);
        }
    }
}
