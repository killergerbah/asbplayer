import { Command, Message } from '@project/common';

export default class FrameToVideoForwardingHandler {
    get sender() {
        return 'asbplayer-frame-to-video';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        chrome.tabs.sendMessage(sender.tab!.id!, command);
        return false;
    }
}
