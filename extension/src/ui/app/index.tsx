import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// import Bridge from '../bridge';
import App from '@project/client/src/components/App';

export function renderAppUi(element: Element, sidePanel: boolean) {
    // const bridge = new Bridge();
    // i18nInit(lang, locStrings);
    createRoot(element).render(
        <BrowserRouter>
            <App sidePanel={sidePanel} />
        </BrowserRouter>
    );
}
