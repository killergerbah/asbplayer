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
    ) => Promise<DictionaryBuildAnkiCacheState>;
    addBuildAnkiCacheStateChangeCallback: (callback: (message: DictionaryBuildAnkiCacheState) => void) => void;
    removeBuildAnkiCacheStateChangeCallback: (callback: (message: DictionaryBuildAnkiCacheState) => void) => void;
    ankiCardWasModified: () => void;
    addAnkiCardModifiedCallback: (callback: () => void) => void;
    removeAnkiCardModifiedCallback: (callback: () => void) => void;
}

export class DictionaryProvider {
    private _storage: DictionaryStorage;

    constructor(storage: DictionaryStorage) {
        this._storage = storage;
    }

    async deleteProfile(profile: string) {
        return await this._storage.deleteProfile(profile);
    }

    async getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return await this._storage.getBulk(profile, track, tokens);
    }

    async getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return await this._storage.getByLemmaBulk(profile, track, lemmas);
    }

    async saveRecordLocalBulk(profile: string | undefined, localTokenInputs: DictionaryLocalTokenInput[]) {
        return await this._storage.saveRecordLocalBulk(profile, localTokenInputs);
    }

    async deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return await this._storage.deleteRecordLocalBulk(profile, tokens);
    }

    async buildAnkiCache(
        profile: string | undefined,
        settings: AsbplayerSettings,
        options?: { useOriginTab?: boolean }
    ) {
        return this._storage.buildAnkiCache(profile, settings, options);
    }

    addBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this._storage.addBuildAnkiCacheStateChangeCallback(callback);
    }

    removeBuildAnkiCacheStateChangeCallback(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this._storage.removeBuildAnkiCacheStateChangeCallback(callback);
    }

    ankiCardWasModified() {
        this._storage.ankiCardWasModified();
    }

    addAnkiCardModifiedCallback(callback: () => void) {
        this._storage.addAnkiCardModifiedCallback(callback);
    }

    removeAnkiCardModifiedCallback(callback: () => void) {
        this._storage.removeAnkiCardModifiedCallback(callback);
    }
}
