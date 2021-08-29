export default class SyncHandler {

    constructor(tabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'sync';
    }

    async handle(request, sender) {
        let chosenTabId = await this.tabRegistry.findAsbplayerTab(sender.tab);
        await this.tabRegistry.publish();

        if (chosenTabId) {
            chrome.tabs.sendMessage(Number(chosenTabId), {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'syncv2',
                    subtitles: request.message.subtitles
                },
                src: request.src,
                tabId: sender.tab.id
            });
        }
    }
}