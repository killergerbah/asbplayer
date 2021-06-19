export default class VideoHeartbeatHandler {

    constructor(tabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'heartbeat';
    }

    handle(request, sender) {
        this.tabRegistry.videoElements[sender.tab.id + ':' + request.src] = {
            tab: sender.tab,
            src: request.src,
            timestamp: Date.now()
        };
    }
}