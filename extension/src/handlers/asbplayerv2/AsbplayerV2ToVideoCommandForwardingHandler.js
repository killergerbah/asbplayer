export default class AsbplayerToVideoCommandForwardingHandler {
    constructor() {}

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return null;
    }

    handle(request, sender) {
        if (request.tabId) {
            chrome.tabs.sendMessage(request.tabId, {
                sender: 'asbplayer-extension-to-video',
                message: request.message,
                src: request.src,
            });
        }
    }
}
