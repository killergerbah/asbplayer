import { renderFtueUi } from '@/ui/ftue';
import '../video.content/video.css';
import { currentPageDelegate } from '@/services/pages';

window.addEventListener('load', () => {
    currentPageDelegate().then((pageDelegate) => {
        pageDelegate?.loadScripts();
    });
    const root = document.getElementById('root')!;
    renderFtueUi(root);
});
