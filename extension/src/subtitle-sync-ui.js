import FrameBridgeServer from './services/FrameBridgeServer';
import { renderSubtitleSyncUi } from './ui';

window.addEventListener('load', () => {
    const bridge = renderSubtitleSyncUi(document.getElementById('root'));
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
