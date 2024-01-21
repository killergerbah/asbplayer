import { AsbplayerSettings, SettingsProvider, SettingsStorage, defaultSettings } from '@project/common/settings';

export class MockSettingsStorage implements SettingsStorage {
    private _cache: any = {};

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const settings: any = {};

        for (const [key, defaultValue] of Object.entries(keysAndDefaults)) {
            // Simulate retrieval from actual storage - object references should change
            settings[key] = JSON.parse(JSON.stringify(this._cache[key] ?? defaultValue));
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async set(settings: Partial<AsbplayerSettings>) {
        for (const [key, value] of Object.entries(settings)) {
            this._cache[key] = value;
        }
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
