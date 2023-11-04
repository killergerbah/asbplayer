import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import { AppUi } from '../components/AppUi';
import Bridge from '../bridge';

export function renderAppUi(element: Element, logoUrl: string) {
    const bridge = new Bridge();
    createRoot(element).render(<AppUi bridge={bridge} logoUrl={logoUrl} />);
    return bridge;
}
