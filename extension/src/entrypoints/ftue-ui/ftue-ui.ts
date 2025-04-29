import { renderFtueUi } from '@/ui/ftue';
import { renderUpdateUi } from '@/ui/update';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const params = new URLSearchParams(location.search);

    if (params.get('update') === 'true') {
        renderUpdateUi(root);
    } else {
        renderFtueUi(root);
    }
});
