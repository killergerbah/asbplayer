import { fileUrlToBase64 } from '../../services/Base64';

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
                    command: 'sync',
                    subtitles: {
                        name: request.message.subtitles.name,
                        base64: request.message.subtitles.base64
                    }
                },
                src: request.src,
                tabId: sender.tab.id
            });
        }
    }
}