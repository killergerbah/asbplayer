import { Command, Message } from '@project/common';

export default class PlayModeHandler {
    get sender() {
        return 'asbplayer-mobile-overlay-to-video';
    }

    get command() {
        return 'playMode';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (sender.tab?.id === undefined) {
            return;
        }

        chrome.tabs.sendMessage(sender.tab.id, command);
        return false;
    }
}
