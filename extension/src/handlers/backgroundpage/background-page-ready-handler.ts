import { Command, Message } from '@project/common';
import BackgroundPageAudioRecorder from '../../services/background-page-audio-recorder';

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

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (!sender.tab) {
            sendResponse(false);
            return;
        }

        sendResponse(this.backgroundPageAudioRecorder.onBackgroundPageReady(sender.tab));
        return false;
    }
}
