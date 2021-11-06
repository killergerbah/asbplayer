export default class ToggleSubtitlesHandler {
    constructor(settings, tabRegistry) {
        this.settings = settings;
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'toggle-subtitles';
    }

    async handle(request, sender) {
        const displaySubtitles = (await this.settings.get(['displaySubtitles'])).displaySubtitles;
        await this.settings.set({ displaySubtitles: !displaySubtitles });

        for (const id in this.tabRegistry.videoElements) {
            chrome.tabs.sendMessage(this.tabRegistry.videoElements[id].tab.id, {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: this.tabRegistry.videoElements[id].src,
            });
        }
    }
}
