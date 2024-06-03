import {
    AsbplayerSettings,
    SettingsStorage,
    unprefixedSettings,
    prefixedSettings,
    defaultSettings,
} from '@project/common/settings';

const activeProfileKey = 'activeSettingsProfile';
const profilesKey = 'settingsProfiles';

export class ExtensionSettingsStorage implements SettingsStorage {
    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        if (activeProfile === undefined) {
            return await chrome.storage.local.get(keysAndDefaults);
        }

        return unprefixedSettings(
            await chrome.storage.local.get(prefixedSettings(keysAndDefaults, activeProfile)),
            activeProfile
        );
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        if (activeProfile === undefined) {
            await chrome.storage.local.set(settings);
        } else {
            await chrome.storage.local.set(prefixedSettings(settings, activeProfile));
        }
    }

    async activeProfile(): Promise<string | undefined> {
        return (await chrome.storage.local.get(activeProfileKey))[activeProfileKey];
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        if (name === undefined) {
            await chrome.storage.local.remove(activeProfileKey);
        } else {
            await chrome.storage.local.set({ [activeProfileKey]: name });
        }
    }

    async profiles(): Promise<string[]> {
        return (await chrome.storage.local.get({ [profilesKey]: [] }))[profilesKey] ?? [];
    }

    async addProfile(name: string): Promise<void> {
        const profiles = await this.profiles();

        if (!profiles.includes(name)) {
            profiles.push(name);
        }

        await chrome.storage.local.set({ [profilesKey]: profiles });
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const activeProfile = await this.activeProfile();

        if (name === activeProfile) {
            throw new Error('Cannot remove active profile');
        }

        const newProfiles = profiles.filter((p) => p !== name);
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));
        await chrome.storage.local.remove(prefixedKeys);
        await chrome.storage.local.set({ [profilesKey]: newProfiles });
    }
}
