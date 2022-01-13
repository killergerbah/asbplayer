import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoDataSyncUi } from './ui';

window.addEventListener('load', () => {
    const bridge = renderVideoDataSyncUi(document.getElementById('root'));
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
