export default class RefreshSettingsHandler {

    constructor(tabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return null;
    }

    handle(request, sender) {
        for (const id in this.tabRegistry.videoElements) {
            chrome.tabs.sendMessage(this.tabRegistry.videoElements[id].tab.id, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated'
                },
                src: this.tabRegistry.videoElements[id].src
            });
        }
    }
}