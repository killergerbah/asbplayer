import { Command, Message } from '@project/common';
import Settings from '../../services/Settings';

export default class EditKeyboardShortcutsHandler {
    private readonly settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    get sender() {
        return 'asbplayer-popup';
    }

    get command() {
        return 'edit-keyboard-shortcuts';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const baseUrl = (await this.settings.get(['asbplayerUrl'])).asbplayerUrl;

        chrome.tabs.create({
            active: true,
            url: `${baseUrl}?view=settings#keyboard-shortcuts`
        });
    }
}
