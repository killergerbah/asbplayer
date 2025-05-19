import { Command, Message, OpenAsbplayerSettingsMessage } from '@project/common';

export default class OpenAsbplayerSettingsHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'open-asbplayer-settings';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const tutorial = (command.message as OpenAsbplayerSettingsMessage).tutorial;

        if (tutorial) {
            browser.tabs.create({ active: true, url: browser.runtime.getURL('/options.html?tutorial=true') });
        } else {
            browser.runtime.openOptionsPage();
        }
    }
}
