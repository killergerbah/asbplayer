import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { AppUi } from '../components/AppUi';
// import Bridge from '../bridge';

export function renderAppUi(element: Element) {
    // const bridge = new Bridge();
    // i18nInit(lang, locStrings);
    createRoot(element).render(<AppUi />);
}
