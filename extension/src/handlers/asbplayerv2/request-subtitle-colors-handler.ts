import {
    AsbPlayerToVideoCommandV2,
    Command,
    ExtensionToVideoCommand,
    Message,
    RequestSubtitleColorsMessage,
} from '@project/common';

export default class RequestSubtitleColorsHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'request-subtitle-colors';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<RequestSubtitleColorsMessage>;
        const requestSubtitleColorsFromTabCommand: ExtensionToVideoCommand<RequestSubtitleColorsMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: {
                command: 'request-subtitle-colors',
            },
        };
        browser.tabs.sendMessage(tabId, requestSubtitleColorsFromTabCommand).then((response) => {
            sendResponse(response);
        });
        return true;
    }
}
