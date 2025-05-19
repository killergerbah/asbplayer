import { createRoot } from 'react-dom/client';
import TutorialUi from '../components/TutorialUi';

export function renderTutorialUi(element: Element) {
    createRoot(element).render(<TutorialUi />);
}
