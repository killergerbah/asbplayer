import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '@project/common/locales/en.json';
import ja from '@project/common/locales/ja.json';

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {},
        fallbackLng: 'en',
        debug: true,
        ns: 'translation',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
    });

i18n.addResourceBundle('en', 'translation', en);
i18n.addResourceBundle('ja', 'translation', ja);

export default i18n;
