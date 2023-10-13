import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SidePanelUi from '../components/SidePanelUi';

export function renderSidePanelUi(element: Element) {
    createRoot(element).render(
        <BrowserRouter>
            <SidePanelUi />
        </BrowserRouter>
    );
}
