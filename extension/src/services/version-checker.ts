import gt from 'semver/functions/gt';
import { fetchExtensionConfig } from './extension-config';

export interface LatestExtensionInfo {
    version: string;
    url: string;
}

export const newVersionAvailable = async (): Promise<[boolean, LatestExtensionInfo | undefined]> => {
    const config = await fetchExtensionConfig();

    if (config === undefined) {
        return [false, undefined];
    }

    return [gt(config.latest.version, chrome.runtime.getManifest().version), config.latest];
};
