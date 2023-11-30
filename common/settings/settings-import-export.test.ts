import { validateSettings } from './settings-import-export';
import { defaultSettings } from './settings-provider';

it('validates the default settings', () => {
    validateSettings(defaultSettings);
});

it('fails validation when an unknown key is encountered', () => {
    expect(() => validateSettings({ ...defaultSettings, asdf: 'jkl;' })).toThrowError("Unknown key 'asdf'");
});

it('fails validation when an unknown key bind key is encountered', () => {
    expect(() =>
        validateSettings({ ...defaultSettings, keyBindSet: { ...defaultSettings.keyBindSet, asdf: { keys: 'a' } } })
    ).toThrowError("Unknown key 'keyBindSet.asdf'");
});

it('validates last languages synced', () => {
    validateSettings({ ...defaultSettings, streamingLastLanguagesSynced: { 'domain.com': ['en', 'ja'] } });
});
