import { ChromeExtension } from '@project/common/app';
import { DictionaryLocalTokenInput, DictionaryStorage, DictionaryTokenRecord } from '@project/common/dictionary-db';
import { ApplyStrategy, AsbplayerSettings } from '@project/common/settings';
import {
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryDBCommand,
    ExtensionToAsbPlayerCommand,
} from '@project/common';

export class AppExtensionDictionaryStorage implements DictionaryStorage {
    private readonly _extension: ChromeExtension;
    private buildAnkiCacheStateChangeCallbacks: ((message: DictionaryBuildAnkiCacheState) => void)[];
    private buildAnkiCacheStateChange?: (event: MessageEvent) => void;
    private ankiCardModifiedCallbacks: (() => void)[];
    private ankiCardModified?: (event: MessageEvent) => void;

    constructor(extension: ChromeExtension) {
        this._extension = extension;
        this.buildAnkiCacheStateChangeCallbacks = [];
        this.ankiCardModifiedCallbacks = [];
    }

    getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return this._extension.dictionaryGetBulk(profile, track, tokens);
    }

    getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return this._extension.dictionaryGetByLemmaBulk(profile, track, lemmas);
    }

    saveRecordLocalBulk(
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ) {
        return this._extension.dictionarySaveRecordLocalBulk(profile, localTokenInputs, applyStates);
    }

    deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return this._extension.dictionaryDeleteRecordLocalBulk(profile, tokens);
    }

    deleteProfile(profile: string) {
        return this._extension.dictionaryDeleteProfile(profile);
    }

    exportRecordLocalBulk() {
        return this._extension.dictionaryExportRecordLocalBulk();
    }

    importRecordLocalBulk(records: Partial<DictionaryTokenRecord>[], profiles: string[]) {
        return this._extension.dictionaryImportRecordLocalBulk(records, profiles);
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings) {
        return this._extension.buildAnkiCache(profile, settings);
    }

    ankiCardWasModified() {
        window.parent.postMessage({
            sender: 'asbplayer-dictionary',
            message: { command: 'card-updated-dialog' },
        } as DictionaryDBCommand<CardUpdatedDialogMessage>);
    }

    onAnkiCardModified(callback: () => void) {
        this.ankiCardModifiedCallbacks.push(callback);
        if (!this.ankiCardModified) {
            this.ankiCardModified = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage> = event.data;
                if (data.sender !== 'asbplayer-dictionary') return;
                if (data.message.command !== 'card-updated-dialog' && data.message.command !== 'card-exported-dialog')
                    return;
                this.ankiCardModifiedCallbacks.forEach((c) => c());
            };
            window.parent.addEventListener('message', this.ankiCardModified);
        }
        return () => {
            this._removeCallback(callback, this.ankiCardModifiedCallbacks);
            if (!this.ankiCardModifiedCallbacks.length && this.ankiCardModified) {
                window.parent.removeEventListener('message', this.ankiCardModified);
                this.ankiCardModified = undefined;
            }
        };
    }

    onBuildAnkiCacheStateChange(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this.buildAnkiCacheStateChangeCallbacks.push(callback);
        if (!this.buildAnkiCacheStateChange) {
            this.buildAnkiCacheStateChange = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage> = event.data;
                if (data.sender !== 'asbplayer-extension-to-player') return;
                if (data.message.command !== 'dictionary-build-anki-cache-state') return;
                this.buildAnkiCacheStateChangeCallbacks.forEach((c) => c(data.message));
            };
            window.parent.addEventListener('message', this.buildAnkiCacheStateChange);
        }
        return () => {
            this._removeCallback(callback, this.buildAnkiCacheStateChangeCallbacks);
            if (!this.buildAnkiCacheStateChangeCallbacks.length && this.buildAnkiCacheStateChange) {
                window.parent.removeEventListener('message', this.buildAnkiCacheStateChange);
                this.buildAnkiCacheStateChange = undefined;
            }
        };
    }

    _removeCallback(callback: Function, callbacks: Function[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
