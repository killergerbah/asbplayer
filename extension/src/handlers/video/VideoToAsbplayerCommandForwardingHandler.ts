import { Command, ExtensionToAsbPlayerCommand, Message, VideoToExtensionCommand } from '@project/common';
import { CommandHandler } from '../CommandHandler';

export default class VideoToAsbplayerCommandForwardingHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const videoToExtensionCommand = command as VideoToExtensionCommand<Message>;
        chrome.tabs.query({}, (allTabs) => {
            const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<Message> = {
                sender: 'asbplayer-extension-to-player',
                message: command.message,
                tabId: sender.tab.id,
                src: videoToExtensionCommand.src,
            };

            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id, extensionToPlayerCommand);
            }
        });
        return false;
    }
}
