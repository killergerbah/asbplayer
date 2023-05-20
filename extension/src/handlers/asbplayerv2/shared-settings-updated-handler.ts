import { Command, Message, SharedSettingsUpdatedMessage } from '@project/common';
import Settings from '../../services/settings';
import { primeLocalization } from '../../services/localization-fetcher';

export default class SharedSettingsUpdatedHandler {
    private readonly settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'shared-settings-updated';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as SharedSettingsUpdatedMessage;
        this.settings.set({ lastLanguage: message.settings.language, lastThemeType: message.settings.themeType });
        primeLocalization(message.settings.language);
        return false;
    }
}
