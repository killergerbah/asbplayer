import type { Command, Message, WhisperServiceHealthMessage } from '@project/common';
import { requestWhisperServer } from '@project/extension/src/services/whisper-server';

/** Checks candidate settings in the background, which is the only Whisper-service caller. */
export default class WhisperServiceHealthHandler {
    get sender() {
        return 'asbplayer-settings';
    }

    get command() {
        return 'whisper-service-health';
    }

    handle(command: Command<Message>, _sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as WhisperServiceHealthMessage;
        void requestWhisperServer(
            { command: 'subtitle-generation', operation: 'capabilities' },
            { url: message.url, authToken: message.authToken }
        ).then(sendResponse);
        return true;
    }
}
