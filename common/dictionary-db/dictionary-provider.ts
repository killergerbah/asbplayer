import {
    DictionaryLocalTokenInput,
    DictionaryTokenKey,
    LemmaResults,
    TokenResults,
} from '@project/common/dictionary-db';
import { DictionaryBuildAnkiCacheState } from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';

export interface DictionaryStorage {
    getBulk: (profile: string | undefined, track: number, tokens: string[]) => Promise<TokenResults>;
    getByLemmaBulk: (profile: string | undefined, track: number, lemmas: string[]) => Promise<LemmaResults>;
    saveRecordLocalBulk: (
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[]
    ) => Promise<DictionaryTokenKey[]>;
    deleteRecordLocalBulk: (profile: string | undefined, tokens: string[]) => Promise<number>;
    deleteProfile: (profile: string) => Promise<[number, number, number]>;
    buildAnkiCache: (
        profile: string | undefined,
        settings: AsbplayerSettings,
        options?: { useOriginTab?: boolean }
    ) => Promise<void>;
    ankiCardWasModified: () => void;
    onAnkiCardModified: (callback: () => void) => () => void;
    onBuildAnkiCacheStateChange: (callback: (message: DictionaryBuildAnkiCacheState) => void) => () => void;
    _removeCallback(callback: Function, callbacks: Function[]): void;
}

export class DictionaryProvider {
    private _storage: DictionaryStorage;

    constructor(storage: DictionaryStorage) {
        this._storage = storage;
    }

    getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return this._storage.getBulk(profile, track, tokens);
    }

    getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return this._storage.getByLemmaBulk(profile, track, lemmas);
    }

    saveRecordLocalBulk(profile: string | undefined, localTokenInputs: DictionaryLocalTokenInput[]) {
        return this._storage.saveRecordLocalBulk(profile, localTokenInputs);
    }

    deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return this._storage.deleteRecordLocalBulk(profile, tokens);
    }

    deleteProfile(profile: string) {
        return this._storage.deleteProfile(profile);
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings, options?: { useOriginTab?: boolean }) {
        return this._storage.buildAnkiCache(profile, settings, options);
    }

    ankiCardWasModified() {
        return this._storage.ankiCardWasModified();
    }

    onAnkiCardModified(callback: () => void) {
        return this._storage.onAnkiCardModified(callback);
    }

    onBuildAnkiCacheStateChange(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        return this._storage.onBuildAnkiCacheStateChange(callback);
    }
}
