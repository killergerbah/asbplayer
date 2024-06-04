import { AsbplayerSettings, defaultSettings } from '@project/common/settings';
import { LocalSettingsStorage } from './local-settings-storage';

it('serializes and deserializes the default settings', async () => {
    const settingsStorage = new LocalSettingsStorage();
    await settingsStorage.set(defaultSettings);

    for (const key of Object.keys(defaultSettings)) {
        expect(localStorage.getItem(key)).not.toBeNull();
    }

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
    expect(await settingsStorage.getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[])).toEqual(
        defaultSettings
    );
});
