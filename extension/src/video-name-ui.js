import { renderVideoNameUi } from './ui';
import FrameBridgeServer from './services/FrameBridgeServer';

window.addEventListener('load', (e) => {
    const bridge = renderVideoNameUi(document.getElementById("root"));
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', (e) => {
        listener.unbind();
    });
});