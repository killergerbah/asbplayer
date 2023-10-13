import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { AppUi } from '../components/AppUi';

export function renderAppUi(element: Element) {
    createRoot(element).render(<AppUi />);
}
