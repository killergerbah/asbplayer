import {
    Command,
    DictionaryBuildAnkiCacheMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryCountKnownTokensMessage,
    DictionaryImportRecordLocalBulkMessage,
    ExtensionToAsbPlayerCommand,
    Message,
    ExtensionToVideoCommand,
    DictionaryStatisticsMessage,
    DictionaryRequestStatisticsGenerationMessage,
    DictionaryRequestStatisticsSnapshotMessage,
    DictionaryRequestStatisticsSeekMessage,
    DictionaryRequestStatisticsMineSentencesMessage,
} from '@project/common';
import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import TabRegistry from '@/services/tab-registry';
import {
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionarySaveRecordLocalBulkMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryDeleteProfileMessage,
} from '@project/common';

export default class DictionaryHandler {
    private readonly dictionaryDB: DictionaryDB;
    private readonly tabRegistry: TabRegistry;

    constructor(dictionaryDB: DictionaryDB, tabRegistry: TabRegistry) {
        this.dictionaryDB = dictionaryDB;
        this.tabRegistry = tabRegistry;
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
            case 'dictionary-count-known-tokens': {
                const message = command.message as DictionaryCountKnownTokensMessage;
                this.dictionaryDB
                    .countKnownTokens(message.profile, message.track, message.settings)
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-build-anki-cache': {
                const message = command.message as DictionaryBuildAnkiCacheMessage;
                this.dictionaryDB
                    .buildAnkiCache(message.profile, message.settings, async (state: DictionaryBuildAnkiCacheState) => {
                        const message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: { command: 'dictionary-build-anki-cache-state', ...state },
                        };
                        void this._relayToExtensionContexts(message);
                        await this.tabRegistry.publishCommandToAsbplayers({
                            commandFactory: (asbplayer) => {
                                if (asbplayer.sidePanel) return;
                                return message;
                            },
                        });
                    })
                    .then((result) => sendResponse(result));
                return true;
            }
            case 'dictionary-statistics':
            case 'dictionary-request-statistics-generation':
            case 'dictionary-request-statistics-snapshot':
            case 'dictionary-request-statistics-seek':
            case 'dictionary-request-statistics-mine-sentences': {
                type DSM =
                    | DictionaryStatisticsMessage
                    | DictionaryRequestStatisticsGenerationMessage
                    | DictionaryRequestStatisticsSnapshotMessage
                    | DictionaryRequestStatisticsSeekMessage
                    | DictionaryRequestStatisticsMineSentencesMessage;
                const playerMessage: ExtensionToAsbPlayerCommand<DSM> = {
                    sender: 'asbplayer-extension-to-player',
                    message: command.message as DSM,
                };
                void this._relayToExtensionContexts(playerMessage);
                void this.tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (asbplayer.sidePanel) return;
                        if (!playerMessage.message.mediaId) return playerMessage; // Messages without mediaId should be sent to all non-sidePanel App instances
                        if (asbplayer.syncedVideoElement) {
                            if (asbplayer.syncedVideoElement.src !== playerMessage.message.mediaId) return;
                            return playerMessage; // Extension controlled media must match the synced video src
                        }
                        if (asbplayer.id === playerMessage.message.mediaId) return playerMessage; // App controlled media must match subtitle App instance id
                        if (!asbplayer.loadedSubtitles && !asbplayer.videoPlayer) return playerMessage; // Idle App instances should receive statistics
                    },
                });
                const videoMessage: ExtensionToVideoCommand<DSM> = {
                    sender: 'asbplayer-extension-to-video',
                    message: command.message as DSM,
                };
                void this.tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (!videoMessage.message.mediaId) return videoMessage; // Messages without mediaId should be sent to all video elements
                    if (videoElement.src === videoMessage.message.mediaId) return videoMessage;
                });
                return false;
            }
        }
    }

    private async _relayToExtensionContexts(message: ExtensionToAsbPlayerCommand<Message>) {
        try {
            await browser.runtime.sendMessage(message);
        } catch {
            // No extension UI is currently listening.
        }
    }
}
