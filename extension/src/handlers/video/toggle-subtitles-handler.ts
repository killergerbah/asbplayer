import { Command, ExtensionToVideoCommand, Message, SettingsUpdatedMessage } from '@project/common';
import ExtensionSettingsProvider from '../../services/extension-settings';
import TabRegistry from '../../services/tab-registry';

export default class ToggleSubtitlesHandler {
    private readonly settings: ExtensionSettingsProvider;
    private readonly tabRegistry: TabRegistry;

    constructor(settings: ExtensionSettingsProvider, tabRegistry: TabRegistry) {
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
        const displaySubtitles = await this.settings.getSingle('displaySubtitles');
        await this.settings.set({ displaySubtitles: !displaySubtitles });

        this.tabRegistry.publishCommandToVideoElements((videoElement) => {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: videoElement.src
            };
            return settingsUpdatedCommand;
        });
    }
}
