import { Command, CopyToClipboardMessage, Message, VideoToExtensionCommand } from '@project/common';

export default class CopyToClipboardHandler {
    constructor() {}

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'copy-to-clipboard';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const tabId = sender.tab?.id;

        if (tabId === undefined) {
            return;
        }

        const videoToExtensionCommand = command as VideoToExtensionCommand<CopyToClipboardMessage>;

        // Publish this command back to the tab so that the topmost window (i.e. non-iframe) can write the data to clipboard
        const extensionToVideoCommand = {
            sender: 'asbplayer-extension-to-video',
            message: videoToExtensionCommand.message,
            src: videoToExtensionCommand.src,
        };
        chrome.tabs.sendMessage(tabId, extensionToVideoCommand);
        return false;
    }
}
