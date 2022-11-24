import { Command, EditKeyboardShortcutsMessage, ExtensionToAsbPlayerCommand, Message } from '@project/common';
import TabRegistry from '../../services/TabRegistry';

export default class EditKeyboardShortcutsHandler {
    private readonly tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return 'edit-keyboard-shortcuts';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const tabId = await this.tabRegistry.findAsbplayerTab();
        const editKeyboardShortcutsCommand: ExtensionToAsbPlayerCommand<EditKeyboardShortcutsMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'edit-keyboard-shortcuts',
            },
        };

        await chrome.tabs.sendMessage(Number(tabId), editKeyboardShortcutsCommand);
        const tab = await chrome.tabs.update(tabId, { active: true });

        if (tab !== undefined) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
    }
}
