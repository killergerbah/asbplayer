import { renderMobileVideoOverlay } from './ui/mobile-video-overlay';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderMobileVideoOverlay(root);
});
