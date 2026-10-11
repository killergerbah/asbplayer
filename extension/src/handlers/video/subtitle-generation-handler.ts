import type { Command, Message, SubtitleGenerationMessage } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import { requestWhisperServer } from '@project/extension/src/services/whisper-server';

export default class SubtitleGenerationHandler {
    private readonly _settings: SettingsProvider;

    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'subtitle-generation';
    }

    handle(command: Command<Message>, _sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        void this._settings
            .get(['whisperServerUrl', 'whisperServerAuthToken'])
            .then((configuration) =>
                requestWhisperServer(command.message as SubtitleGenerationMessage, {
                    url: configuration.whisperServerUrl,
                    authToken: configuration.whisperServerAuthToken,
                })
            )
            .then(sendResponse);
        return true;
    }
}
