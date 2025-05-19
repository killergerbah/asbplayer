import { renderTutorialUi } from '@/ui/tutorial';
import '../video.content/video.css';
import { currentPageDelegate } from '@/services/pages';

window.addEventListener('load', () => {
    currentPageDelegate()?.loadScripts();
    const root = document.getElementById('root')!;
    renderTutorialUi(root);
});
