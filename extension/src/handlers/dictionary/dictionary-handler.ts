import {
    Command,
    DictionaryBuildAnkiCacheMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryDBCommand,
    DictionaryImportRecordLocalBulkMessage,
    ExtensionToAsbPlayerCommand,
    Message,
} from '@project/common';
import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import {
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionarySaveRecordLocalBulkMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryDeleteProfileMessage,
} from '@project/common';

export default class DictionaryHandler {
    private readonly dictionaryDB: DictionaryDB;

    constructor(dictionaryDB: DictionaryDB) {
        this.dictionaryDB = dictionaryDB;
    }

    get sender() {
        return 'asbplayer-dictionary';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        switch (command.message.command) {
            case 'dictionary-get-bulk': {
                const message = command.message as DictionaryGetBulkMessage;
                this.dictionaryDB
                    .getBulk(message.profile, message.track, message.tokens)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-get-by-lemma-bulk': {
                const message = command.message as DictionaryGetByLemmaBulkMessage;
                this.dictionaryDB
                    .getByLemmaBulk(message.profile, message.track, message.lemmas)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-save-record-local-bulk': {
                const message = command.message as DictionarySaveRecordLocalBulkMessage;
                this.dictionaryDB
                    .saveRecordLocalBulk(message.profile, message.localTokenInputs, message.applyStates)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-delete-record-local-bulk': {
                const message = command.message as DictionaryDeleteRecordLocalBulkMessage;
                this.dictionaryDB
                    .deleteRecordLocalBulk(message.profile, message.tokens)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-delete-profile': {
                const message = command.message as DictionaryDeleteProfileMessage;
                this.dictionaryDB.deleteProfile(message.profile).then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-export-record-local-bulk': {
                this.dictionaryDB.exportRecordLocalBulk().then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-import-record-local-bulk': {
                const message = command.message as DictionaryImportRecordLocalBulkMessage;
                this.dictionaryDB
                    .importRecordLocalBulk(message.records, message.profiles)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-build-anki-cache': {
                const message = command.message as DictionaryBuildAnkiCacheMessage;
                let originTabId =
                    (command as DictionaryDBCommand<Message>).useOriginTab && typeof sender.tab?.id === 'number'
                        ? sender.tab.id
                        : undefined;
                this.dictionaryDB
                    .buildAnkiCache(message.profile, message.settings, async (state: DictionaryBuildAnkiCacheState) => {
                        const message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: { command: 'dictionary-build-anki-cache-state', ...state },
                        };

                        try {
                            await browser.runtime.sendMessage(message);
                        } catch {
                            // No one is currently listening
                        }

                        if (typeof originTabId !== 'number') return;
                        try {
                            await browser.tabs.sendMessage(originTabId, message);
                        } catch (e) {
                            console.error(
                                'Failed to send build Anki cache status update to origin tab, stopping updates to tab',
                                e
                            );
                            originTabId = undefined;
                        }
                    })
                    .then((result) => sendResponse(result));
                return true;
            }
        }
    }
}
