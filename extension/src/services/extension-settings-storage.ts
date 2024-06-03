import {
    AsbplayerSettings,
    SettingsStorage,
    unprefixedSettings,
    prefixedSettings,
    defaultSettings,
    Profile,
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
            await chrome.storage.local.get(prefixedSettings(keysAndDefaults, activeProfile.name)),
            activeProfile.name
        );
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        if (activeProfile === undefined) {
            await chrome.storage.local.set(settings);
        } else {
            await chrome.storage.local.set(prefixedSettings(settings, activeProfile.name));
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        const name = (await chrome.storage.local.get(activeProfileKey))[activeProfileKey];

        if (name === undefined) {
            return undefined;
        }

        const profiles = await this.profiles();
        return profiles.find((p) => p.name === name);
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        if (name === undefined) {
            await chrome.storage.local.remove(activeProfileKey);
        } else {
            await chrome.storage.local.set({ [activeProfileKey]: name });
        }
    }

    async profiles(): Promise<Profile[]> {
        return (await chrome.storage.local.get({ [profilesKey]: [] }))[profilesKey] ?? [];
    }

    async addProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const existing = profiles.find((p) => p.name === name);

        if (existing === undefined) {
            profiles.push({ name });
        }

        await chrome.storage.local.set({ [profilesKey]: profiles });
        const initialValues = await chrome.storage.local.get(defaultSettings);
        await chrome.storage.local.set(prefixedSettings(initialValues, name));
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const activeProfile = await this.activeProfile();

        if (name === activeProfile?.name) {
            throw new Error('Cannot remove active profile');
        }

        const newProfiles = profiles.filter((p) => p.name !== name);
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));
        await chrome.storage.local.remove(prefixedKeys);
        await chrome.storage.local.set({ [profilesKey]: newProfiles });
    }
}
