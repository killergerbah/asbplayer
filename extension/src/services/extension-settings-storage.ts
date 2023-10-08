import { AsbplayerSettings, SettingsStorage } from '@project/common';

export class ExtensionSettingsStorage implements SettingsStorage {
    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        return await chrome.storage.local.get(keysAndDefaults);
    }

    async set(settings: Partial<AsbplayerSettings>) {
        await chrome.storage.local.set(settings);
    }
}
