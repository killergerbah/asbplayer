import {
    BlurSubtitlesMessage,
    Command,
    ExtensionToVideoCommand,
    Message,
    SettingsUpdatedMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import TabRegistry from '../../services/tab-registry';

export default class BlurSubtitlesHandler {
    private readonly settings: SettingsProvider;
    private readonly tabRegistry: TabRegistry;

    constructor(settings: SettingsProvider, tabRegistry: TabRegistry) {
        this.settings = settings;
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'blur-subtitles';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as BlurSubtitlesMessage;
        const trackSettings = await this.settings.getSingle('subtitleTracks');
        trackSettings[message.track].blur = !trackSettings[message.track].blur;
        await this.settings.set({ subtitleTracks: trackSettings });

        this.tabRegistry.publishCommandToVideoElements((videoElement) => {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: videoElement.src,
            };
            return settingsUpdatedCommand;
        });
    }
}
