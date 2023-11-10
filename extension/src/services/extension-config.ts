import { SettingsProvider } from '@project/common';
import { ExtensionSettingsStorage } from './extension-settings-storage';

export interface ExtensionConfig {
    latest: {
        version: string;
        url: string;
    };
    languages: LocalizationConfig[];
}

export interface LocalizationConfig {
    code: string;
    url: string;
    version: number;
}

const settings = new SettingsProvider(new ExtensionSettingsStorage());

export const fetchExtensionConfig = async (): Promise<ExtensionConfig | undefined> => {
    const cachedConfig = (await chrome.storage.session.get(['config'])).config;

    if (cachedConfig === '-') {
        return undefined;
    }

    if (cachedConfig !== undefined) {
        return cachedConfig as ExtensionConfig;
    }

    try {
        const asbplayerUrl = await settings.getSingle('streamingAppUrl');
        const extensionJsonUrl = `${asbplayerUrl}/extension.json`;
        const extensionJson = await (await fetch(extensionJsonUrl)).json();

        if (validJson(extensionJson)) {
            await chrome.storage.session.set({ config: extensionJson });
            return extensionJson as ExtensionConfig;
        }
    } catch (e) {
        console.error(e);
    }

    await chrome.storage.session.set({ config: '-' });
    return undefined;
};

const validJson = (json: any | undefined) => {
    return json !== undefined && validLatest(json.latest) && validLanguages(json.languages);
};

const validLatest = (json: any | undefined) => {
    return typeof json.version === 'string' && typeof json.url === 'string';
};

const validLanguages = (json: any | undefined) => {
    if (json === undefined || typeof json !== 'object' || !Array.isArray(json)) {
        return false;
    }

    for (const item of json) {
        if (typeof item.code !== 'string' || typeof item.url !== 'string' || typeof item.version !== 'number') {
            return false;
        }
    }

    return true;
};
