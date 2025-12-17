import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';
import { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';
import {
    AsbplayerSettings,
    Profile,
    defaultSettings,
    prefixKey,
    prefixedSettings,
    settingsDeserializers,
    unprefixKey,
} from '@project/common/settings';
import { DictionaryDB, DictionaryLocalTokenInput } from '@project/common/dictionary-db';
import { DictionaryBuildAnkiCacheState, ExtensionToAsbPlayerCommand } from '@project/common';

const cachedLocalStorage = new CachedLocalStorage();
const activeProfileKey = 'activeSettingsProfile';
const profilesKey = 'settingsProfiles';

export class LocalSettingsStorage implements AppSettingsStorage {
    private readonly _settingsUpdatedCallbacks: (() => void)[] = [];
    private _storageListener?: (event: StorageEvent) => void;
    private dictionaryDB?: DictionaryDB;

    private async _ensureDictionaryDB() {
        if (!this.dictionaryDB) this.dictionaryDB = new DictionaryDB();
        return this.dictionaryDB;
    }

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        return this._get(keysAndDefaults, activeProfile);
    }

    private _get(keysAndDefaults: Partial<AsbplayerSettings>, activeProfile?: Profile) {
        const settings: any = {};
        const actualKeysAndDefaults =
            activeProfile === undefined ? keysAndDefaults : prefixedSettings(keysAndDefaults, activeProfile.name);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            const value = cachedLocalStorage.get(key);
            const originalKey = activeProfile === undefined ? key : unprefixKey(key, activeProfile.name);

            if (value === null) {
                settings[originalKey] = defaultValue;
            } else {
                settings[originalKey] = settingsDeserializers[originalKey as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async getStored(keys: (keyof AsbplayerSettings)[]) {
        const activeProfile = this._activeProfile();
        return this._getStored(keys, activeProfile);
    }

    private _getStored(keys: (keyof AsbplayerSettings)[], activeProfile?: Profile) {
        const settings: any = {};

        for (const key of keys) {
            const actualKey = activeProfile === undefined ? key : prefixKey(key, activeProfile.name);
            const value = cachedLocalStorage.get(actualKey);

            if (value !== null) {
                settings[key] = settingsDeserializers[key as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        this._set(settings, activeProfile);
    }

    private _set(settings: Partial<AsbplayerSettings>, activeProfile?: Profile) {
        const actualSettings = activeProfile === undefined ? settings : prefixedSettings(settings, activeProfile.name);

        for (const [key, value] of Object.entries(actualSettings)) {
            if (typeof value === 'object') {
                cachedLocalStorage.set(key, JSON.stringify(value));
            } else {
                cachedLocalStorage.set(key, String(value));
            }
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        return this._activeProfile();
    }

    private _activeProfile(): Profile | undefined {
        const name = cachedLocalStorage.get(activeProfileKey) ?? undefined;
        if (name === undefined) {
            return undefined;
        }

        const profiles = this._profiles();
        return profiles.find((p) => p.name === name);
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        if (name === undefined) {
            cachedLocalStorage.delete(activeProfileKey);
        } else {
            const profiles = this._profiles();
            const profileExists = profiles.find((p) => p.name === name) !== undefined;

            if (!profileExists) {
                throw new Error(`Cannot set active profile to non-existant profile ${name}`);
            }

            cachedLocalStorage.set(activeProfileKey, name);
        }
    }

    async profiles(): Promise<Profile[]> {
        return this._profiles();
    }

    private _profiles(): Profile[] {
        const value = cachedLocalStorage.get(profilesKey);

        if (value === null) {
            return [];
        }

        return JSON.parse(value);
    }

    async addProfile(name: string): Promise<void> {
        const profiles = this._profiles();
        const existing = profiles.find((p) => p.name === name);
        const newProfile = { name };

        if (existing === undefined) {
            profiles.push(newProfile);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(profiles));
        const initialValues = this._getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[]);
        this._set(initialValues, newProfile);
    }

    async removeProfile(name: string): Promise<void> {
        await (await this._ensureDictionaryDB()).deleteProfile(name);
        const profiles = this._profiles();
        const activeProfile = this._activeProfile();

        if (name === activeProfile?.name) {
            throw new Error('Cannot remove active profile');
        }

        const newProfiles = profiles.filter((p) => p.name !== name);
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));

        for (const key of prefixedKeys) {
            cachedLocalStorage.delete(key);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(newProfiles));
    }

    async dictionaryGetBulk(profile: string | undefined, track: number, tokens: string[]) {
        return (await this._ensureDictionaryDB()).getBulk(profile, track, tokens);
    }

    async dictionaryGetByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return (await this._ensureDictionaryDB()).getByLemmaBulk(profile, track, lemmas);
    }

    async dictionarySaveRecordLocalBulk(profile: string | undefined, localTokenInputs: DictionaryLocalTokenInput[]) {
        return (await this._ensureDictionaryDB()).saveRecordLocalBulk(profile, localTokenInputs);
    }

    async dictionaryDeleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return (await this._ensureDictionaryDB()).deleteRecordLocalBulk(profile, tokens);
    }

    async buildAnkiCache(
        profile: string | undefined,
        settings: AsbplayerSettings
    ): Promise<DictionaryBuildAnkiCacheState> {
        return (await this._ensureDictionaryDB()).buildAnkiCache(
            profile,
            settings,
            (state: DictionaryBuildAnkiCacheState) => {
                const message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheState> = {
                    sender: 'asbplayer-extension-to-player',
                    message: state,
                };
                window.postMessage(message);
            }
        );
    }

    onSettingsUpdated(callback: () => void) {
        if (this._settingsUpdatedCallbacks.length === 0) {
            this._storageListener = (event: StorageEvent) => {
                if (event.key !== null && event.key in defaultSettings) {
                    cachedLocalStorage.bustCache();

                    for (const c of this._settingsUpdatedCallbacks) {
                        c();
                    }
                }
            };
            window.addEventListener('storage', this._storageListener);
        }
        this._settingsUpdatedCallbacks.push(callback);
        return () => this._unsubscribe(callback);
    }

    private _unsubscribe(callback: () => void) {
        for (let i = this._settingsUpdatedCallbacks.length - 1; i >= 0; --i) {
            if (callback === this._settingsUpdatedCallbacks[i]) {
                this._settingsUpdatedCallbacks.splice(i, 1);
                break;
            }
        }

        if (this._settingsUpdatedCallbacks.length === 0 && this._storageListener !== undefined) {
            window.removeEventListener('storage', this._storageListener);
        }
    }

    clear() {
        cachedLocalStorage.bustCache();
        localStorage.clear();
    }
}
