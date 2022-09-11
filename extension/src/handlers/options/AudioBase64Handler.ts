import { AudioBase64Message, Command, Message, OptionsPageToExtensionCommand } from '@project/common';
import OptionsPageAudioRecorder from '../../services/OptionsPageAudioRecorder';

export default class AudioBase64Handler {
    private readonly optionsPageAudioRecorder: OptionsPageAudioRecorder;

    constructor(optionsPageAudioRecorder: OptionsPageAudioRecorder) {
        this.optionsPageAudioRecorder = optionsPageAudioRecorder;
    }

    get sender() {
        return 'asbplayer-options-page';
    }

    get command() {
        return 'audio-base64';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const audioBase64Command = command as OptionsPageToExtensionCommand<AudioBase64Message>;
        this.optionsPageAudioRecorder.onAudioBase64(audioBase64Command.message.base64);
        return false;
    }
}
