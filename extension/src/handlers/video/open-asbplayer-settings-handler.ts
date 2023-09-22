import { Command, OpenAsbplayerSettingsMessage, ExtensionToAsbPlayerCommand, Message } from '@project/common';

export default class OpenAsbplayerSettingsHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'open-asbplayer-settings';
    }

    async handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        chrome.runtime.openOptionsPage();
    }
}
