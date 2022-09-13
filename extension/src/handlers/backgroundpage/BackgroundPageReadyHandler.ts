import { Command, Message } from '@project/common';
import BackgroundPageAudioRecorder from '../../services/BackgroundPageAudioRecorder';

export default class BackgroundPageReadyHandler {
    private readonly backgroundPageAudioRecorder: BackgroundPageAudioRecorder;

    constructor(backgroundPageAudioRecorder: BackgroundPageAudioRecorder) {
        this.backgroundPageAudioRecorder = backgroundPageAudioRecorder;
    }

    get sender() {
        return 'asbplayer-background-page';
    }

    get command() {
        return 'background-page-ready';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        if (!sender.tab) {
            return;
        }

        this.backgroundPageAudioRecorder.onBackgroundPageReady(sender.tab);
        return false;
    }
}
