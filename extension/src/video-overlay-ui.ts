import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoOverlayUi } from './ui/video-overlay';

window.addEventListener('load', () => {
    const bridge = renderVideoOverlayUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
