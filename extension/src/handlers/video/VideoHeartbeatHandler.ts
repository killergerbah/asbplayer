import { Command, Message, VideoHeartbeatMessage, VideoToExtensionCommand } from '@project/common';
import TabRegistry from '../../services/TabRegistry';

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
        this.tabRegistry.videoElements[sender.tab.id + ':' + videoToExtensionCommand.src] = {
            tab: sender.tab,
            src: videoToExtensionCommand.src,
            timestamp: Date.now(),
        };

        return false;
    }
}
