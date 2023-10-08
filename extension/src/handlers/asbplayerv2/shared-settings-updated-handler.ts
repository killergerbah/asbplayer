import {
    Command,
    ExtensionToVideoCommand,
    Message,
    SettingsProvider,
    SettingsUpdatedMessage,
    SharedSettingsUpdatedMessage,
} from '@project/common';
import { primeLocalization } from '../../services/localization-fetcher';
import TabRegistry from '../../services/tab-registry';

// TODO: Probably get rid of this handler since all settings are accessible via settings provider
export default class SharedSettingsUpdatedHandler {
    private readonly _settings: SettingsProvider;
    private readonly _tabRegistry: TabRegistry;

    constructor(settings: SettingsProvider, tabRegistry: TabRegistry) {
        this._settings = settings;
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'shared-settings-updated';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as SharedSettingsUpdatedMessage;
        this._settings
            .set({ language: message.settings.language, themeType: message.settings.themeType })
            .then(() => primeLocalization(message.settings.language))
            .then(() => {
                this._tabRegistry.publishCommandToVideoElements((videoElement) => {
                    const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'settings-updated',
                        },
                        src: videoElement.src,
                    };
                    return settingsUpdatedCommand;
                });
            });

        return false;
    }
}
