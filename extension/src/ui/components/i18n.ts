import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@project/common/locales/en.json';

i18n.use(initReactI18next).init({
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

export default i18n;
