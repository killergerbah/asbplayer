import { LocalizationConfig, fetchExtensionConfig } from './extension-config';
import { supportedLanguages as defaultSupportedLanguages } from '@project/common';
import Settings from './settings';

const stringsKeyForLang = (lang: string) => `locStrings-${lang}`;
const versionKeyForLang = (lang: string) => `locVersion-${lang}`;
const settings = new Settings();

export interface Localization {
    lang: string;
    strings: any;
}

export const fetchLocalization = async (lang: string): Promise<Localization> => {
    return (
        (await cachedStringsForLang(lang)) ??
        (await bundledStringsForLang(lang)) ??
        (await bundledStringsForLang('en'))!
    );
};

export const primeLocalization = async (lang: string): Promise<void> => {
    try {
        const config = await fetchExtensionConfig();

        if (config === undefined) {
            return;
        }

        const langConfig = config.languages.find((c) => c.code === lang);

        if (langConfig === undefined) {
            return;
        }

        const versionKey = versionKeyForLang(lang);
        const version = (await chrome.storage.local.get(versionKey))[versionKey] as number | undefined;

        if (version === undefined || version < langConfig.version) {
            await fetchAndCache(langConfig);
        }
    } catch (e) {
        console.error(e);
    }
};

const fetchAndCache = async ({ code, url, version }: LocalizationConfig): Promise<void> => {
    const effectiveUrl =
        url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${(await settings.getSingle('asbplayerUrl')).replace(/\/$/, '')}${url}`;
    try {
        const strings = await (await fetch(effectiveUrl)).json();

        if (typeof strings === 'object') {
            const versionKey = versionKeyForLang(code);
            const stringsKey = stringsKeyForLang(code);
            await chrome.storage.local.set({ [stringsKey]: strings, [versionKey]: version });
        }
    } catch (e) {
        console.error(e);
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
