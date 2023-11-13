import FrameBridgeServer from './services/frame-bridge-server';
import { renderActiveTabPermissionRequestUi } from './ui/active-tab-permission-request';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const loc = JSON.parse(document.getElementById('loc')!.innerHTML!);
    const bridge = renderActiveTabPermissionRequestUi(root, loc.lang, loc.strings);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
