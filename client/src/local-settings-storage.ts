import { CachedLocalStorage } from '@project/common/app';
import { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';
import {
    AsbplayerSettings,
    defaultSettings,
    prefixKey,
    prefixedSettings,
    settingsDeserializers,
    unprefixKey,
} from '@project/common/settings';

const cachedLocalStorage = new CachedLocalStorage();
const activeProfileKey = 'activeSettingsProfile';
const profilesKey = 'settingsProfiles';

export class LocalSettingsStorage implements AppSettingsStorage {
    private readonly _settingsUpdatedCallbacks: (() => void)[] = [];
    private _storageListener?: (event: StorageEvent) => void;

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        const settings: any = {};
        const actualKeysAndDefaults =
            activeProfile === undefined ? keysAndDefaults : prefixedSettings(keysAndDefaults, activeProfile);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            const value = cachedLocalStorage.get(key);

            if (value === null) {
                settings[key] = defaultValue;
            } else {
                const originalKey = activeProfile === undefined ? key : unprefixKey(key, activeProfile);
                settings[key] = settingsDeserializers[originalKey as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async getKeys(keys: (keyof AsbplayerSettings)[]) {
        const settings: any = {};
        const activeProfile = this._activeProfile();

        for (const key of keys) {
            const actualKey = activeProfile === undefined ? key : prefixKey(key, activeProfile);
            const value = cachedLocalStorage.get(actualKey);

            if (value !== null) {
                settings[key] = settingsDeserializers[key as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        const actualSettings = activeProfile === undefined ? settings : prefixedSettings(settings, activeProfile);

        for (const [key, value] of Object.entries(actualSettings)) {
            if (typeof value === 'object') {
                cachedLocalStorage.set(key, JSON.stringify(value));
            } else {
                cachedLocalStorage.set(key, String(value));
            }
        }
    }

    async activeProfile(): Promise<string | undefined> {
        return this._activeProfile();
    }

    private _activeProfile(): string | undefined {
        return cachedLocalStorage.get(activeProfileKey) ?? undefined;
    }

    async setActiveProfile(name: string): Promise<void> {
        cachedLocalStorage.set(activeProfileKey, name);
    }

    async profiles(): Promise<string[]> {
        return this._profiles();
    }

    private _profiles(): string[] {
        const value = cachedLocalStorage.get(profilesKey);

        if (value === null) {
            return [];
        }

        return JSON.parse(value);
    }

    async addProfile(name: string): Promise<void> {
        const profiles = this._profiles();

        if (!profiles.includes(name)) {
            profiles.push(name);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(profiles));
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = this._profiles();
        const newProfiles = profiles.filter((p) => p !== name);
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));

        for (const key of prefixedKeys) {
            cachedLocalStorage.delete(key);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(newProfiles));
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
}
