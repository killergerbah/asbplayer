import { CachedLocalStorage } from '@project/common/app';
import { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';
import { AsbplayerSettings, defaultSettings, settingsDeserializers } from '@project/common/settings';

const cachedLocalStorage = new CachedLocalStorage();

export class LocalSettingsStorage implements AppSettingsStorage {
    private readonly _settingsUpdatedCallbacks: (() => void)[] = [];
    private _storageListener?: (event: StorageEvent) => void;
    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const settings: any = {};

        for (const [key, defaultValue] of Object.entries(keysAndDefaults)) {
            const value = cachedLocalStorage.get(key);

            if (value === null) {
                settings[key] = defaultValue;
            } else {
                settings[key] = settingsDeserializers[key as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async getKeys(keys: (keyof AsbplayerSettings)[]) {
        const settings: any = {};

        for (const key of keys) {
            const value = cachedLocalStorage.get(key);

            if (value !== null) {
                settings[key] = settingsDeserializers[key as keyof AsbplayerSettings]!(value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async set(settings: Partial<AsbplayerSettings>) {
        for (const [key, value] of Object.entries(settings)) {
            if (typeof value === 'object') {
                cachedLocalStorage.set(key, JSON.stringify(value));
            } else {
                cachedLocalStorage.set(key, String(value));
            }
        }
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
