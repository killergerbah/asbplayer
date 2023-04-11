import { AudioBase64Message, Command, Message, BackgroundPageToExtensionCommand } from '@project/common';
import BackgroundPageAudioRecorder from '../../services/background-page-audio-recorder';

export default class AudioBase64Handler {
    private readonly backgroundPageAudioRecorder: BackgroundPageAudioRecorder;

    constructor(backgroundPageAudioRecorder: BackgroundPageAudioRecorder) {
        this.backgroundPageAudioRecorder = backgroundPageAudioRecorder;
    }

    get sender() {
        return 'asbplayer-background-page';
    }

    get command() {
        return 'audio-base64';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const audioBase64Command = command as BackgroundPageToExtensionCommand<AudioBase64Message>;
        this.backgroundPageAudioRecorder.onAudioBase64(audioBase64Command.message.base64);
        return false;
    }
}
