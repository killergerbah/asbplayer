import { renderMobileVideoOverlay } from './ui/mobile-video-overlay';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const params = new URLSearchParams(location.search);
    const anchor = params.get('anchor');

    if (anchor === 'bottom') {
        root.style.bottom = '0px';
    } else {
        root.style.top = '0px';
    }

    renderMobileVideoOverlay(root);
});
