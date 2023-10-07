import { KeyValueStorage } from '@project/common';

export default class AppSettingsStorage implements KeyValueStorage {
    private _cache: { [key: string]: string } = {};

    async prime(keys: string[]) {
        const values = await chrome.storage.local.get(keys);

        for (const key of keys) {
            this._cache[key] = values[key];
        }
    }

    get(key: string) {
        return this._cache[key] ?? null;
    }

    set(key: string, value: string) {
        this._cache[key] = value;
        chrome.storage.local.set({ [key]: value }).catch(console.error);
    }

    delete(key: string) {
        delete this._cache[key];
        chrome.storage.local.remove(key).catch(console.error);
    }
}
