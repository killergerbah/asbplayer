import { renderSidePanelUi } from '@/ui/side-panel';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderSidePanelUi(root);
});
