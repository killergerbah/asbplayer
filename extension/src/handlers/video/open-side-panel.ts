import { Command, Message } from '@project/common';

export default class OpenSidePanelHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'open-side-panel';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        chrome.windows
            // @ts-ignore
            .getLastFocused((window) => chrome.sidePanel.open({ windowId: window.id }));
        return false;
    }
}
