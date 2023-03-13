import { WindowMessageProtocol } from './services/FrameBridgeProtocol';
import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoDataSyncUi } from './ui/video-data-sync';

window.addEventListener('load', () => {
    const bridge = renderVideoDataSyncUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(bridge, new WindowMessageProtocol('asbplayer-frame', 'asbplayer-video', window.parent));
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
