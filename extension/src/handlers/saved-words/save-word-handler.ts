import type { Command, Message, SaveWordMessage, SaveWordResponse } from '@project/common';
import { IndexedDBSavedWordsRepository } from '@project/common/saved-words';

export default class SaveWordHandler {
    private readonly _repository = new IndexedDBSavedWordsRepository();

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2'];
    }

    get command() {
        return 'save-word';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: SaveWordResponse) => void) {
        const message = command.message as SaveWordMessage;

        this._repository
            .save({
                word: message.word,
                sentence: message.sentence,
                translation: message.translation,
                videoTitle: message.videoTitle,
                videoUrl: message.videoUrl,
            })
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
