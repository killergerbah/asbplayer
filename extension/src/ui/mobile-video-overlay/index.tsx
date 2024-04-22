import { createRoot } from 'react-dom/client';
import MobileVideoOverlay from '../components/MobileVideoOverlay';

export async function renderMobileVideoOverlay(element: Element) {
    createRoot(element).render(<MobileVideoOverlay />);
}
