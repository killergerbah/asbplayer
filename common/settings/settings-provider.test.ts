import {
    AsbplayerSettings,
    AsbplayerSettingsProfile,
    Profile,
    SettingsProvider,
    SettingsStorage,
    defaultSettings,
    prefixedSettings,
    unprefixedSettings,
} from '@project/common/settings';

export class MockSettingsStorage implements SettingsStorage {
    private _activeProfile?: string;
    private _profiles: Profile[] = [];
    private _data: any = {};

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const settings: any = {};

        const actualKeysAndDefaults =
            this._activeProfile === undefined
                ? keysAndDefaults
                : prefixedSettings(keysAndDefaults, this._activeProfile);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            // Simulate retrieval from actual storage - object references should change
            settings[key] = JSON.parse(JSON.stringify(this._data[key] ?? defaultValue));
        }

        return this._activeProfile === undefined
            ? (settings as Partial<AsbplayerSettings>)
            : unprefixedSettings(settings as Partial<AsbplayerSettingsProfile<string>>, this._activeProfile);
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const actualSettings =
            this._activeProfile === undefined ? settings : prefixedSettings(settings, this._activeProfile);

        for (const [key, value] of Object.entries(actualSettings)) {
            this._data[key] = value;
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        return this._activeProfile === undefined
            ? undefined
            : this._profiles.find((p) => p.name === this._activeProfile);
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        this._activeProfile = name;
    }

    async profiles(): Promise<Profile[]> {
        return this._profiles;
    }

    async addProfile(name: string): Promise<void> {
        const existing = this._profiles.find((p) => p.name === name);

        if (existing === undefined) {
            this._profiles.push({ name });
        }
    }

    async removeProfile(name: string): Promise<void> {
        if (this._activeProfile === name) {
            throw new Error('Cannot remove active profile');
        }

        this._profiles = this._profiles.filter((p) => p.name !== name);
    }

    setData(data: any) {
        this._data = data;
    }
}

it('starts at default settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    const initialSettings = await provider.getAll();
    expect(initialSettings).toEqual(defaultSettings);
});

it('can change the value of object-typed settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    await provider.set({ tags: ['foo'] });
    expect(await provider.getSingle('tags')).toEqual(['foo']);
    const newKeyBindSet = {
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'moon-wolf' },
    };
    await provider.set({ keyBindSet: newKeyBindSet });
    expect(await provider.getSingle('keyBindSet')).toEqual(newKeyBindSet);
});

it('can change the value of value-typed settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    await provider.set({ audioField: 'test-value' });
    expect(await provider.getSingle('audioField')).toBe('test-value');
});

it('returns the same object references if the values inside do not change', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    const newKeyBindSet = {
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'moon-wolf' },
    };
    await provider.set({ keyBindSet: newKeyBindSet });
    expect(await provider.getSingle('keyBindSet')).toBe(await provider.getSingle('keyBindSet'));
});

it('changes different keys for different profiles', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    const defaultProfileValue = 'https://foo.bar';
    await provider.set({ streamingAppUrl: defaultProfileValue });
    await storage.addProfile('profile');
    await storage.setActiveProfile('profile');
    const profileValue = await provider.getSingle('streamingAppUrl');
    expect(profileValue).toEqual('https://killergerbah.github.io/asbplayer');
});

it('provides default values for unpopulated, nested settings', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    storage.setData({ keyBindSet: { togglePlay: { keys: 'p' } } });
    expect(await provider.getSingle('keyBindSet')).toEqual({
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'p' },
    });

    storage.setData({ ankiFieldSettings: { url: { order: 12 } } });
    expect(await provider.getSingle('ankiFieldSettings')).toEqual({
        ...defaultSettings.ankiFieldSettings,
        url: { order: 12 },
    });
});

it('removes corresponding field settings when custom anki fields are removed', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    await provider.set({
        customAnkiFields: { foo: 'bar', baz: 'moo' },
        customAnkiFieldSettings: { foo: { order: 1 }, baz: { order: 2 } },
    });
    await provider.set({ customAnkiFields: { foo: 'bar' } });
    expect(await provider.get(['customAnkiFields', 'customAnkiFieldSettings'])).toEqual({
        customAnkiFields: { foo: 'bar' },
        customAnkiFieldSettings: { foo: { order: 1 } },
    });
});
