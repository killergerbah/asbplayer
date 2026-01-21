import type { Command, Message, GetSavedWordsCountMessage, GetSavedWordsCountResponse } from '@project/common';
import { IndexedDBSavedWordsRepository } from '@project/common/saved-words';

export default class GetSavedWordsCountHandler {
    private readonly _repository = new IndexedDBSavedWordsRepository();

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2', 'asbplayer-popup'];
    }

    get command() {
        return 'get-saved-words-count';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: GetSavedWordsCountResponse) => void) {
        this._repository
            .getCount()
            .then((count) => {
                sendResponse({ count });
            })
            .catch(() => {
                sendResponse({ count: 0 });
            });

        return true;
    }
}
