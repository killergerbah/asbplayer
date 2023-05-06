import FrameBridgeServer from './services/frame-bridge-server';
import { renderVideoDataSyncUi } from './ui/video-data-sync';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const bridge = renderVideoDataSyncUi(root, root.dataset.lang!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
