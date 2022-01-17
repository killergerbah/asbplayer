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
        try {
            const chosenTabId = await this.tabRegistry.findAsbplayerTab(sender.tab, request.src);

            chrome.tabs.sendMessage(Number(chosenTabId), {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'syncv2',
                    subtitles: request.message.subtitles,
                },
                src: request.src,
                tabId: sender.tab.id,
            });
        } catch (error) {
            console.error(error.message);
        }
    }
}
