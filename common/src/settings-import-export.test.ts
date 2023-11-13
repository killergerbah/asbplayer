import { validateSettings } from './settings-import-export';
import { defaultSettings } from './settings-provider';

it('validates the default settings', async () => {
    validateSettings(defaultSettings);
});
