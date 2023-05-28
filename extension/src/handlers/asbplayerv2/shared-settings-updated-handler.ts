import {
    Command,
    ExtensionToVideoCommand,
    Message,
    SettingsUpdatedMessage,
    SharedSettingsUpdatedMessage,
} from '@project/common';
import Settings from '../../services/settings';
import { primeLocalization } from '../../services/localization-fetcher';
import TabRegistry from '../../services/tab-registry';

export default class SharedSettingsUpdatedHandler {
    private readonly _settings: Settings;
    private readonly _tabRegistry: TabRegistry;

    constructor(settings: Settings, tabRegistry: TabRegistry) {
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
            .set({ lastLanguage: message.settings.language, lastThemeType: message.settings.themeType })
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
