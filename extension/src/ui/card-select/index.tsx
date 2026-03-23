import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import CardSelectUi from '../components/CardSelectUi';
import { i18nInit } from '../i18n';

export function renderCardSelectUi(element: Element, lang: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(lang, locStrings);
    createRoot(element).render(<CardSelectUi bridge={bridge} />);
    return bridge;
}
