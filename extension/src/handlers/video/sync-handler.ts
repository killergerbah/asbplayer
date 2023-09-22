import {
    Command,
    ExtensionSyncMessage,
    ExtensionToAsbPlayerCommand,
    Message,
    PlayerSyncMessage,
    VideoToExtensionCommand,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class SyncHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'sync';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        try {
            const extensionSyncCommand = command as VideoToExtensionCommand<ExtensionSyncMessage>;
            await this.tabRegistry.publishTabsToAsbplayers();
            const asbplayerId = await this.tabRegistry.findAsbplayer((asbplayer) => {
                if (asbplayer.receivedTabs === undefined || sender.tab === undefined) {
                    return false;
                }

                return (
                    asbplayer.receivedTabs.find(
                        (tab) => tab.id === sender.tab!.id && tab.src === extensionSyncCommand.src
                    ) !== undefined
                );
            });

            const playerSyncCommand: ExtensionToAsbPlayerCommand<PlayerSyncMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'syncv2',
                    subtitles: extensionSyncCommand.message.subtitles,
                    flatten: extensionSyncCommand.message.flatten,
                },
                src: extensionSyncCommand.src,
                tabId: sender.tab!.id!,
            };

            this.tabRegistry.publishCommandToAsbplayers({ asbplayerId, commandFactory: () => playerSyncCommand });
        } catch (error) {
            console.error(error);
        }
    }
}
