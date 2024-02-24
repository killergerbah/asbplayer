import { AudioBase64Message, Command, Message, OffscreenDocumentToExtensionCommand } from '@project/common';
import OffscreenAudioRecorder from '../../services/offscreen-audio-recorder';

export default class AudioBase64Handler {
    private readonly offscreenAudioRecorder: OffscreenAudioRecorder;

    constructor(offscreenAudioRecorder: OffscreenAudioRecorder) {
        this.offscreenAudioRecorder = offscreenAudioRecorder;
    }

    get sender() {
        return 'asbplayer-offscreen-document';
    }

    get command() {
        return 'audio-base64';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const audioBase64Command = command as OffscreenDocumentToExtensionCommand<AudioBase64Message>;
        this.offscreenAudioRecorder.onAudioBase64(audioBase64Command.message.base64);
        return false;
    }
}
