import { WindowMessageProtocol } from './services/FrameBridgeProtocol';
import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoSelectModeUi } from './ui/video-select';

window.addEventListener('load', () => {
    const bridge = renderVideoSelectModeUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(bridge, new WindowMessageProtocol('asbplayer-frame', 'asbplayer-video', window.parent));
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
