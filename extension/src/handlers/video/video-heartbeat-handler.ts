import { Command, Message, VideoHeartbeatMessage, VideoToExtensionCommand } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class VideoHeartbeatHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'heartbeat';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender): boolean {
        const videoToExtensionCommand = command as VideoToExtensionCommand<VideoHeartbeatMessage>;

        if (sender.tab) {
            this.tabRegistry.onVideoElementHeartbeat(
                sender.tab,
                videoToExtensionCommand.src,
                videoToExtensionCommand.message.subscribed,
                videoToExtensionCommand.message.synced,
                videoToExtensionCommand.message.syncedTimestamp
            );
        }

        return false;
    }
}
