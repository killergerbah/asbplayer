import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoSelectModeUi } from './ui/video-select-mode';

window.addEventListener('load', () => {
    const bridge = renderVideoSelectModeUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
