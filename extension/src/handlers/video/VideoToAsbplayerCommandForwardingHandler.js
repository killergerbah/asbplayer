export default class CommandForwardingHandler {
    constructor() {}

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return null;
    }

    handle(request, sender) {
        chrome.tabs.query({}, (allTabs) => {
            for (let t of allTabs) {
                chrome.tabs.sendMessage(t.id, {
                    sender: 'asbplayer-extension-to-player',
                    message: request.message,
                    tabId: sender.tab.id,
                    src: request.src,
                });
            }
        });
    }
}
