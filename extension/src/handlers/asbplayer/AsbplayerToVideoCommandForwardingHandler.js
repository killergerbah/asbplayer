export default class AsbplayerToVideoCommandForwardingHandler {

    constructor() {
    }

    get sender() {
        return 'asbplayer';
    }

    get command() {
        return null;
    }

    handle(request, sender) {
        chrome.tabs.sendMessage(request.tabId, {
            sender: 'asbplayer-extension-to-video',
            message: request.message,
            src: request.src
        });
    }
}