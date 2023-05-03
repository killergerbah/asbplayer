import gt from 'semver/functions/gt';
import Settings from './settings';

export interface LatestExtensionInfo {
    version: string;
    url: string;
}

export default class VersionChecker {
    private readonly settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    async newVersionAvailable(): Promise<[boolean, LatestExtensionInfo | undefined]> {
        let latestExtension = (await chrome.storage.session.get('latestExtension')).latestExtension as
            | LatestExtensionInfo
            | undefined;

        if (latestExtension === undefined) {
            latestExtension = await this._fetchLatestExtension();
        }

        if (latestExtension === undefined) {
            return [false, undefined];
        }

        return [gt(latestExtension.version, chrome.runtime.getManifest().version), latestExtension];
    }

    private async _fetchLatestExtension(): Promise<LatestExtensionInfo | undefined> {
        try {
            const asbplayerUrl = (await this.settings.getSingle('asbplayerUrl')).replace(/\/$/, '');
            const extensionJsonUrl = `${asbplayerUrl}/extension.json`;
            const extensionJson = await (await fetch(extensionJsonUrl)).json();

            if (typeof extensionJson?.latest?.version === 'string' && typeof extensionJson?.latest?.url === 'string') {
                await chrome.storage.session.set({ latestExtension: extensionJson?.latest });
                return { version: extensionJson.latest.version, url: extensionJson.latest.url };
            }
        } catch (e) {
            console.error(e);
        }

        return undefined;
    }
}
