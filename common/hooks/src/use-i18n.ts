import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { useEffect, useState } from 'react';

const init = i18n
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
    });

export const useI18n = ({ language }: { language: string }) => {
    const [initialized, setInitialized] = useState<boolean>(false);

    useEffect(() => {
        if (initialized) {
            return;
        }

        init.then(() => setInitialized(true));
    }, [initialized]);

    useEffect(() => {
        if (language !== i18n.language) {
            init.then(() => i18n.changeLanguage(language));
        }
    }, [language]);

    return { initialized };
};
