import {
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryDBCommand,
    ExtensionToAsbPlayerCommand,
} from '@project/common';
import { DictionaryDB, DictionaryLocalTokenInput, DictionaryStorage } from '@project/common/dictionary-db';
import { AsbplayerSettings } from '@project/common/settings';

export class LocalDictionaryStorage implements DictionaryStorage {
    private readonly dictionaryDB: DictionaryDB;
    private buildAnkiCacheStateChangeCallbacks: ((message: DictionaryBuildAnkiCacheState) => void)[];
    private buildAnkiCacheStateChange?: (event: MessageEvent) => void;
    private ankiCardModifiedCallbacks: (() => void)[];
    private ankiCardModified?: (event: MessageEvent) => void;

    constructor() {
        this.dictionaryDB = new DictionaryDB();
        this.buildAnkiCacheStateChangeCallbacks = [];
        this.ankiCardModifiedCallbacks = [];
    }

    async getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return this.dictionaryDB.getBulk(profile, track, tokens);
    }

    async getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return this.dictionaryDB.getByLemmaBulk(profile, track, lemmas);
    }

    async saveRecordLocalBulk(profile: string | undefined, localTokenInputs: DictionaryLocalTokenInput[]) {
        return this.dictionaryDB.saveRecordLocalBulk(profile, localTokenInputs);
    }

    async deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return this.dictionaryDB.deleteRecordLocalBulk(profile, tokens);
    }

    async deleteProfile(profile: string) {
        return this.dictionaryDB.deleteProfile(profile);
    }

    async buildAnkiCache(
        profile: string | undefined,
        settings: AsbplayerSettings
    ): Promise<DictionaryBuildAnkiCacheState> {
        return this.dictionaryDB.buildAnkiCache(profile, settings, (state: DictionaryBuildAnkiCacheState) => {
            const message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheState> = {
                sender: 'asbplayer-extension-to-player',
                message: state,
            };
            window.parent.postMessage(message);
        });
    }

    addBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this.buildAnkiCacheStateChangeCallbacks.push(callback);
        if (!this.buildAnkiCacheStateChange) {
            this.buildAnkiCacheStateChange = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheState> = event.data;
                if (data.sender !== 'asbplayer-extension-to-player') return;
                if (data.message.command !== 'dictionary-build-anki-cache-state') return;
                this.buildAnkiCacheStateChangeCallbacks.forEach((c) => c(data.message));
            };
            window.parent.addEventListener('message', this.buildAnkiCacheStateChange);
        }
    }

    removeBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        const idx = this.buildAnkiCacheStateChangeCallbacks.indexOf(callback);
        if (idx !== -1) this.buildAnkiCacheStateChangeCallbacks.splice(idx, 1);
        if (!this.buildAnkiCacheStateChangeCallbacks.length && this.buildAnkiCacheStateChange) {
            window.parent.removeEventListener('message', this.buildAnkiCacheStateChange);
            this.buildAnkiCacheStateChange = undefined;
        }
    }

    ankiCardWasModified() {
        window.parent.postMessage({
            sender: 'asbplayer-dictionary',
            message: { command: 'card-updated-dialog' },
        } as DictionaryDBCommand<CardUpdatedDialogMessage>);
    }

    addAnkiCardModifiedCallback(callback: () => void) {
        this.ankiCardModifiedCallbacks.push(callback);
        if (!this.ankiCardModified) {
            this.ankiCardModified = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage> = event.data;
                if (data.sender !== 'asbplayer-dictionary') return;
                if (data.message.command !== 'card-updated-dialog' && data.message.command !== 'card-exported-dialog') {
                    return;
                }
                this.ankiCardModifiedCallbacks.forEach((c) => c());
            };
            window.parent.addEventListener('message', this.ankiCardModified);
        }
    }

    removeAnkiCardModifiedCallback(callback: () => void) {
        const idx = this.ankiCardModifiedCallbacks.indexOf(callback);
        if (idx !== -1) this.ankiCardModifiedCallbacks.splice(idx, 1);
        if (!this.ankiCardModifiedCallbacks.length && this.ankiCardModified) {
            window.parent.removeEventListener('message', this.ankiCardModified);
            this.ankiCardModified = undefined;
        }
    }
}
