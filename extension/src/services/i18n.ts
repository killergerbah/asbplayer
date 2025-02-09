import i18n from 'i18next';
import { fetchLocalization } from './localization-fetcher';

let initializedPromise: Promise<void> | undefined;

const langsInitialized: { [key: string]: string } = {};

export const i18nInit = async (lang: string) => {
    if (initializedPromise) {
        await initializedPromise;
        const notAddedYet = !(lang in langsInitialized);

        if (notAddedYet) {
            const loc = await fetchLocalization(lang);
            i18n.addResourceBundle(loc.lang, 'translation', loc.strings);
            langsInitialized[lang] = loc.lang;
        }

        // If a localization doesn't exist for lang then actualLanguage will be a fallback language
        const actualLanguage = langsInitialized[lang];

        if (i18n.language !== actualLanguage) {
            i18n.changeLanguage(actualLanguage);
        }

        return;
    }

    initializedPromise = new Promise<void>(async (resolve, reject) => {
        try {
            const loc = await fetchLocalization(lang);
            i18n.init({
                resources: { [loc.lang]: { translation: loc.strings } },
                lng: loc.lang,
                fallbackLng: loc.lang,
                debug: import.meta.env.MODE === 'development',
                ns: 'translation',
                defaultNS: 'translation',
                interpolation: {
                    escapeValue: false,
                },
            });
            langsInitialized[lang] = loc.lang;
            resolve();
        } catch (e) {
            reject(e);
        }
    });

    await initializedPromise;
};
