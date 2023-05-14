import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { useEffect, useState } from 'react';

const i18nInit = i18n
    .use(LanguageDetector)
    .use(resourcesToBackend((language: string) => import(`@project/common/locales/${language}.json`)))
    .use(initReactI18next)
    .init({
        partialBundledLanguages: true,
        resources: {},
        fallbackLng: 'en',
        debug: process.env.NODE_ENV === 'development',
        ns: 'translation',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage'],
        },
    });

const useI18nInitialized = () => {
    const [i18nInitialized, setI18nInitialized] = useState<boolean>(false);

    useEffect(() => {
        i18nInit.then(() => setI18nInitialized(true));
    }, []);

    return i18nInitialized;
};

export { useI18nInitialized, i18n };
