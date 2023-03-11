import { Command, Message } from '@project/common';

export default class CaptureVisibleTabHandler {
    get sender() {
        return 'asbplayer-foreground';
    }

    get command() {
        return 'capture-visible-tab';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
        chrome.tabs.captureVisibleTab({ format: 'jpeg' }, (dataUrl) => {
            sendResponse(dataUrl);
        });
        return true;
    }
}
