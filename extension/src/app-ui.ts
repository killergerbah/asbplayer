import { renderAppUi } from './ui/app';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderAppUi(root);
});
