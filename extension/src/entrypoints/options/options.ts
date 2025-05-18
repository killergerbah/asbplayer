import { renderSettingsUi } from '@/ui/settings';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderSettingsUi(root);
});
