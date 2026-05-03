import { renderCardSelectUi } from '@/ui/card-select';
import FrameBridgeServer from '@/services/frame-bridge-server';

export default defineUnlistedScript(() => {
    window.addEventListener('load', (e) => {
        const root = document.getElementById('root')!;
        const loc = JSON.parse(document.getElementById('loc')!.innerHTML!);
        const bridge = renderCardSelectUi(root, loc.lang, loc.strings);
        const listener = new FrameBridgeServer(bridge);
        listener.bind();

        window.addEventListener('unload', (e) => {
            listener.unbind();
        });
    });
});
