export default class AsbplayerHeartbeatHandler {
    constructor(tabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'heartbeat';
    }

    handle(request, sender) {
        this.tabRegistry.asbplayers[sender.tab.id] = {
            tab: sender.tab,
            id: request.message.id,
            timestamp: Date.now(),
        };
    }
}
