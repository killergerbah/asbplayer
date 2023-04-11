import FrameBridgeServer from './services/frame-bridge-server';
import { renderVideoSelectModeUi } from './ui/video-select';

window.addEventListener('load', () => {
    const bridge = renderVideoSelectModeUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
