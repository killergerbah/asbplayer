import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const i18nInit = async (language: string) => {
    i18n.use(initReactI18next).init({
        resources: {},
        lng: language,
        fallbackLng: language,
        debug: process.env.NODE_ENV === 'development',
        ns: 'translation',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
    });

    switch (language) {
        case 'en':
            i18n.addResourceBundle('en', 'translation', await import('@project/common/locales/en.json'));
            break;
        case 'ja':
            i18n.addResourceBundle('ja', 'translation', await import('@project/common/locales/ja.json'));
            break;
    }
};
