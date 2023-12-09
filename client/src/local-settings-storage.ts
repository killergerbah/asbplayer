import { AsbplayerSettings, SettingsStorage, settingsDeserializers } from '@project/common/settings';
import CachedLocalStorage from '@project/common/app/src/services/cached-local-storage';

const cachedLocalStorage = new CachedLocalStorage();

export class LocalSettingsStorage implements SettingsStorage {
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
}
