import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SidePanel from '../components/SidePanel';
// import Bridge from '../bridge';

export function renderSidePanelUi(element: Element, sidePanel: boolean) {
    // const bridge = new Bridge();
    // i18nInit(lang, locStrings);
    createRoot(element).render(
        <BrowserRouter>
            <SidePanel />
        </BrowserRouter>
    );
}
