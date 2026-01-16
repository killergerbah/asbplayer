import type { Command, Message, ClearSavedWordsMessage, ClearSavedWordsResponse } from '@project/common';
import { IndexedDBSavedWordsRepository } from '@project/common/saved-words';

export default class ClearSavedWordsHandler {
    private readonly _repository = new IndexedDBSavedWordsRepository();

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2', 'asbplayer-popup'];
    }

    get command() {
        return 'clear-saved-words';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: ClearSavedWordsResponse) => void) {
        this._repository
            .clear()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

        return true;
    }
}
