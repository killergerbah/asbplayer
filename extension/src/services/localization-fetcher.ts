import { ExtensionConfig, LocalizationConfig, fetchExtensionConfig } from './extension-config';
import { supportedLanguages as defaultSupportedLanguages } from '@project/common';
import Settings from './settings';

const stringsKeyForLang = (lang: string) => `locStrings-${lang}`;
const versionKeyForLang = (lang: string) => `locVersion-${lang}`;
const settings = new Settings();

export interface Localization {
    lang: string;
    strings: any;
}

export const primeLocalization = async (lang: string) => {
    try {
        const config = await fetchExtensionConfig();

        if (config === undefined) {
            return;
        }

        await fetchLatestAndCache(lang, config);
    } catch (e) {
        console.error(e);
    }
};

export const fetchLocalization = async (lang: string): Promise<Localization> => {
    const config = await fetchExtensionConfig();

    if (config === undefined) {
        return await fallbackStringsForLang(lang);
    }

    const latest = await fetchLatestAndCache(lang, config);

    if (latest === undefined) {
        return await fallbackStringsForLang(lang);
    }

    return { lang, strings: latest };
};

const fallbackStringsForLang = async (lang: string): Promise<Localization> => {
    return (
        (await cachedStringsForLang(lang)) ??
        (await bundledStringsForLang(lang)) ??
        (await bundledStringsForLang('en'))!
    );
};

const fetchLatestAndCache = async (lang: string, config: ExtensionConfig) => {
    const langConfig = config.languages.find((c) => c.code === lang);

    if (langConfig === undefined) {
        return undefined;
    }

    const versionKey = versionKeyForLang(lang);
    const version = (await chrome.storage.local.get(versionKey))[versionKey] as number | undefined;

    if (version === undefined || version < langConfig.version) {
        return await fetchAndCache(langConfig);
    }

    return undefined;
};

const fetchAndCache = async ({ code, url, version }: LocalizationConfig) => {
    const effectiveUrl =
        url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${(await settings.getSingle('asbplayerUrl')).replace(/\/$/, '')}${url}`;
    try {
        const strings = await (await fetch(effectiveUrl)).json();

        if (typeof strings !== 'object') {
            return undefined;
        }

        const versionKey = versionKeyForLang(code);
        const stringsKey = stringsKeyForLang(code);
        await chrome.storage.local.set({ [stringsKey]: strings, [versionKey]: version });
        return strings;
    } catch (e) {
        console.error(e);
        return undefined;
    }
};

const bundledStringsForLang = async (lang: string): Promise<Localization | undefined> => {
    for (const defaultLang of defaultSupportedLanguages) {
        if (lang === defaultLang) {
            return { lang, strings: await import(`@project/common/locales/${lang}.json`) };
        }
    }

    return undefined;
};

const cachedStringsForLang = async (lang: string): Promise<Localization | undefined> => {
    const stringsKey = stringsKeyForLang(lang);
    const strings = (await chrome.storage.local.get(stringsKey))[stringsKey];

    if (strings === undefined) {
        return undefined;
    }

    return { lang, strings };
};
