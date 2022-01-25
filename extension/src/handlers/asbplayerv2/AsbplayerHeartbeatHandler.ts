import { AsbplayerHeartbeatMessage, Command, Message } from '@project/common';
import TabRegistry from '../../services/TabRegistry';

export default class AsbplayerHeartbeatHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'heartbeat';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as AsbplayerHeartbeatMessage;

        if (typeof sender.tab?.id !== 'undefined') {
            this.tabRegistry.asbplayers[sender.tab.id] = {
                tab: sender.tab,
                id: message.id,
                timestamp: Date.now(),
                receivedTabs: message.receivedTabs,
            };
        }

        return false;
    }
}
