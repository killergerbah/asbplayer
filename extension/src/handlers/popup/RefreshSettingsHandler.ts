import { Command, ExtensionToVideoCommand, Message, SettingsUpdatedMessage } from '@project/common';
import TabRegistry from '../../services/TabRegistry';

export default class RefreshSettingsHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        for (const id in this.tabRegistry.videoElements) {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: this.tabRegistry.videoElements[id].src,
            };

            const tabId = this.tabRegistry.videoElements[id].tab.id;

            if (typeof tabId !== 'undefined') {
                chrome.tabs.sendMessage(tabId, settingsUpdatedCommand);
            }
        }

        return false;
    }
}
