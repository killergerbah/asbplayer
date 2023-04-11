import { Command, OpenAsbplayerSettingsMessage, ExtensionToAsbPlayerCommand, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class OpenAsbplayerSettingsHandler {
    private readonly tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'open-asbplayer-settings';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const tabId = await this.tabRegistry.findAsbplayerTab((asbplayer) => !asbplayer.videoPlayer);
        const openAsbplayerSettingsCommand: ExtensionToAsbPlayerCommand<OpenAsbplayerSettingsMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'open-asbplayer-settings',
            },
        };

        await chrome.tabs.sendMessage(Number(tabId), openAsbplayerSettingsCommand);
        const tab = await chrome.tabs.update(tabId, { active: true });

        if (tab !== undefined) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
    }
}
