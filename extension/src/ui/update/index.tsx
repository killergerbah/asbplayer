import '@fontsource/roboto';
import { createRoot } from 'react-dom/client';
import UpdateUi from '../components/UpdateUi';

export function renderUpdateUi(element: Element) {
    createRoot(element).render(<UpdateUi />);
}
