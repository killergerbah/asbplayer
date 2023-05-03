import FrameBridgeServer from './services/frame-bridge-server';
import { renderVideoSelectModeUi } from './ui/video-select';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const bridge = renderVideoSelectModeUi(root, root.dataset.lang!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
