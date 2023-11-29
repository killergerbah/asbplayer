import { AsbplayerSettings, SettingsStorage } from '@project/common/settings';
import { ChromeExtension } from '@project/common/app';

export class AppExtensionSettingsStorage implements SettingsStorage {
    private readonly _extension: ChromeExtension;

    constructor(extension: ChromeExtension) {
        this._extension = extension;
    }

    get(keysAndDefaults: Partial<AsbplayerSettings>): Promise<Partial<AsbplayerSettings>> {
        return this._extension.getSettings(keysAndDefaults);
    }

    set(settings: Partial<AsbplayerSettings>): Promise<void> {
        return this._extension.setSettings(settings);
    }
}
