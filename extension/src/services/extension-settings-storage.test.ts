import { ExtensionSettingsStorage, StorageArea } from './extension-settings-storage';
import { defaultSettings } from '@project/common/settings';

class MockStorageArea implements StorageArea {
    private _values: { [key: string]: any } = {};

    async set(items: { [key: string]: any }): Promise<void> {
        for (const [key, value] of Object.entries(items)) {
            this._values[key] = value;
        }
    }

    async remove(keys: string | string[]): Promise<void> {
        if (typeof keys === 'string') {
            delete this._values[keys];
        } else {
            for (const key of keys) {
                delete this._values[key];
            }
        }
    }

    async get(keys?: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }> {
        if (keys === undefined || keys === null) {
            return this._values;
        }

        if (typeof keys === 'string') {
            return { [keys]: this._values[keys] };
        }

        const values: { [key: string]: any } = {};

        if (Array.isArray(keys)) {
            for (const key of keys) {
                if (this._values[key] !== undefined) {
                    values[key] = this._values[key];
                }
            }
        } else {
            for (const [key, value] of Object.entries(keys)) {
                values[key] = this._values[key] ?? value;
            }
        }

        return values;
    }

    async clear() {
        this._values = {};
    }
}

const settingsStorage = new ExtensionSettingsStorage(new MockStorageArea());

beforeEach(async () => {
    await settingsStorage.clear();
});

it('serializes and deserializes the default settings', async () => {
    await settingsStorage.set(defaultSettings);

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
});

it('copies default profile when creating a new profile', async () => {
    await settingsStorage.set({ language: 'es' });
    await settingsStorage.addProfile('new profile');
    await settingsStorage.setActiveProfile('new profile');
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
});

it('changes separate keys for different profiles', async () => {
    await settingsStorage.addProfile('new profile');
    await settingsStorage.setActiveProfile('new profile');

    // Set profile value to 'es'
    await settingsStorage.set({ language: 'es' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
    await settingsStorage.setActiveProfile(undefined);

    // Default profile still has default value 'en'
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'en' });
});
