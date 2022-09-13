import { AckTabsMessage, Command, Message } from '@project/common';
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
        return 'ackTabs';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as AckTabsMessage;

        if (typeof sender.tab?.id !== 'undefined') {
            this.tabRegistry.onAsbplayerAckTabs(sender.tab, message.id, message.receivedTabs);
        }

        return false;
    }
}
