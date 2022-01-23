import { Command, ExtensionToVideoCommand, Message, SettingsUpdatedMessage } from '@project/common';
import Settings from '../../services/Settings';
import TabRegistry from '../../services/TabRegistry';

export default class ToggleSubtitlesHandler {
    private readonly settings: Settings;
    private readonly tabRegistry: TabRegistry;

    constructor(settings: Settings, tabRegistry: TabRegistry) {
        this.settings = settings;
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'toggle-subtitles';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const displaySubtitles = (await this.settings.get(['displaySubtitles'])).displaySubtitles;
        await this.settings.set({ displaySubtitles: !displaySubtitles });

        for (const id in this.tabRegistry.videoElements) {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: this.tabRegistry.videoElements[id].src,
            };

            chrome.tabs.sendMessage(this.tabRegistry.videoElements[id].tab.id, settingsUpdatedCommand);
        }
    }
}
