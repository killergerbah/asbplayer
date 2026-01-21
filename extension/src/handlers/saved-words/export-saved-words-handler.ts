import type { Command, Message, ExportSavedWordsMessage, ExportSavedWordsResponse } from '@project/common';
import { IndexedDBSavedWordsRepository } from '@project/common/saved-words';

export default class ExportSavedWordsHandler {
    private readonly _repository = new IndexedDBSavedWordsRepository();

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2', 'asbplayer-popup'];
    }

    get command() {
        return 'export-saved-words';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: ExportSavedWordsResponse) => void) {
        this._repository
            .exportToCsv()
            .then((csv) => {
                sendResponse({ csv });
            })
            .catch((error) => {
                sendResponse({
                    csv: '',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

        return true;
    }
}
