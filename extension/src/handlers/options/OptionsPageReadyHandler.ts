import { Command, Message } from '@project/common';
import OptionsPageAudioRecorder from '../../services/OptionsPageAudioRecorder';

export default class OptionsPageReadyHandler {
    private readonly optionsPageAudioRecorder: OptionsPageAudioRecorder;

    constructor(optionsPageAudioRecorder: OptionsPageAudioRecorder) {
        this.optionsPageAudioRecorder = optionsPageAudioRecorder;
    }

    get sender() {
        return 'asbplayer-options-page';
    }

    get command() {
        return 'options-page-ready';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        if (!sender.tab) {
            return;
        }

        this.optionsPageAudioRecorder.onOptionsPageReady(sender.tab);
        return false;
    }
}
