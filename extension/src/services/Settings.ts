type SettingKey =
    | 'displaySubtitles'
    | 'recordMedia'
    | 'screenshot'
    | 'cleanScreenshot'
    | 'cropScreenshot'
    | 'bindKeys'
    | 'subsDragAndDrop'
    | 'autoSync'
    | 'lastLanguageSynced'
    | 'subtitlePositionOffsetBottom'
    | 'asbplayerUrl'
    | 'lastThemeType';

type SettingsValues = { [key in SettingKey]: any };

const defaults: SettingsValues = {
    displaySubtitles: true,
    recordMedia: true,
    screenshot: true,
    cleanScreenshot: true,
    cropScreenshot: true,
    bindKeys: true,
    subsDragAndDrop: true,
    autoSync: false,
    lastLanguageSynced: null,
    subtitlePositionOffsetBottom: 100,
    asbplayerUrl: 'https://killergerbah.github.io/asbplayer/',
    lastThemeType: 'dark',
};

export default class Settings {
    async get(keys?: SettingKey[]): Promise<any> {
        let parameters: any;

        if (keys === undefined) {
            parameters = defaults;
        } else {
            parameters = {};

            for (const key of keys) {
                if (!(key in defaults)) {
                    throw new Error('Invalid key ' + key);
                }

                parameters[key] = defaults[key];
            }
        }

        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(parameters, (data) => {
                const result: any = {};

                for (const key in parameters) {
                    result[key] = data[key];
                }

                resolve(result);
            });
        });
    }

    async set(settings: any) {
        for (const key in settings) {
            if (!(key in defaults)) {
                throw new Error('Invalid key ' + key);
            }
        }

        return new Promise((resolve, reject) => {
            chrome.storage.sync.set(settings, () => resolve(undefined));
        });
    }
}
