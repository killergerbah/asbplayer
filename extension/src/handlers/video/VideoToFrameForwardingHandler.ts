import { Command, Message } from '@project/common';

export default class VideoToFrameForwardingHandler {
    get sender() {
        return 'asbplayer-video-to-frame';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        chrome.tabs.sendMessage(sender.tab!.id!, command);
        return false;
    }
}
