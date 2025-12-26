import {
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    DictionaryBuildAnkiCacheMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryDBCommand,
    DictionaryDeleteProfileMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionarySaveRecordLocalBulkMessage,
    ExtensionToAsbPlayerCommand,
} from '@project/common';
import { DictionaryLocalTokenInput, DictionaryStorage } from '@project/common/dictionary-db';
import { AsbplayerSettings } from '@project/common/settings';
import { v4 as uuidv4 } from 'uuid';

export class ExtensionDictionaryStorage implements DictionaryStorage {
    private buildAnkiCacheStateChangeCallbacks: ((message: DictionaryBuildAnkiCacheState) => void)[];
    private buildAnkiCacheStateChange?: (message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheState>) => void;
    private ankiCardModifiedCallbacks: (() => void)[];
    private ankiCardModified?: (
        message: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage>
    ) => void;

    constructor() {
        this.buildAnkiCacheStateChangeCallbacks = [];
        this.ankiCardModifiedCallbacks = [];
    }

    async getBulk(profile: string | undefined, track: number, tokens: string[]) {
        const message: DictionaryDBCommand<DictionaryGetBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-bulk',
                profile,
                track,
                tokens,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    async getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        const message: DictionaryDBCommand<DictionaryGetByLemmaBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-by-lemma-bulk',
                profile,
                track,
                lemmas,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    async saveRecordLocalBulk(profile: string | undefined, localTokenInputs: DictionaryLocalTokenInput[]) {
        const message: DictionaryDBCommand<DictionarySaveRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-save-record-local-bulk',
                profile,
                localTokenInputs,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    async deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        const message: DictionaryDBCommand<DictionaryDeleteRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-delete-record-local-bulk',
                profile,
                tokens,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    async deleteProfile(profile: string) {
        const message: DictionaryDBCommand<DictionaryDeleteProfileMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-delete-profile',
                profile,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    async buildAnkiCache(
        profile: string | undefined,
        settings: AsbplayerSettings,
        options?: { useOriginTab?: boolean }
    ): Promise<DictionaryBuildAnkiCacheState> {
        const message: DictionaryDBCommand<DictionaryBuildAnkiCacheMessage> = {
            sender: 'asbplayer-dictionary',
            useOriginTab: options?.useOriginTab,
            message: { command: 'dictionary-build-anki-cache', messageId: uuidv4(), profile, settings },
        };
        return browser.runtime.sendMessage(message);
    }

    addBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this.buildAnkiCacheStateChangeCallbacks.push(callback);
        if (!this.buildAnkiCacheStateChange) {
            this.buildAnkiCacheStateChange = (message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheState>) => {
                if (message.sender !== 'asbplayer-extension-to-player') return;
                if (message.message.command !== 'dictionary-build-anki-cache-state') return;
                this.buildAnkiCacheStateChangeCallbacks.forEach((c) => c(message.message));
            };
            browser.runtime.onMessage.addListener(this.buildAnkiCacheStateChange);
        }
    }

    removeBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        const idx = this.buildAnkiCacheStateChangeCallbacks.indexOf(callback);
        if (idx !== -1) this.buildAnkiCacheStateChangeCallbacks.splice(idx, 1);
        if (!this.buildAnkiCacheStateChangeCallbacks.length && this.buildAnkiCacheStateChange) {
            browser.runtime.onMessage.removeListener(this.buildAnkiCacheStateChange);
            this.buildAnkiCacheStateChange = undefined;
        }
    }

    ankiCardWasModified() {
        browser.runtime.sendMessage({
            sender: 'asbplayer-dictionary',
            message: { command: 'card-updated-dialog' },
        } as DictionaryDBCommand<CardUpdatedDialogMessage>);
    }

    addAnkiCardModifiedCallback(callback: () => void) {
        this.ankiCardModifiedCallbacks.push(callback);
        if (!this.ankiCardModified) {
            this.ankiCardModified = (
                message: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage>
            ) => {
                if (message.sender !== 'asbplayer-dictionary') return;
                if (
                    message.message.command !== 'card-updated-dialog' &&
                    message.message.command !== 'card-exported-dialog'
                )
                    return;
                this.ankiCardModifiedCallbacks.forEach((c) => c());
            };
            browser.runtime.onMessage.addListener(this.ankiCardModified);
        }
    }

    removeAnkiCardModifiedCallback(callback: () => void) {
        const idx = this.ankiCardModifiedCallbacks.indexOf(callback);
        if (idx !== -1) this.ankiCardModifiedCallbacks.splice(idx, 1);
        if (!this.ankiCardModifiedCallbacks.length && this.ankiCardModified) {
            browser.runtime.onMessage.removeListener(this.ankiCardModified);
            this.ankiCardModified = undefined;
        }
    }
}
