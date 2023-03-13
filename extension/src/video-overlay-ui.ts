import { ExtensionMessageProtocol } from './services/FrameBridgeProtocol';
import FrameBridgeServer from './services/FrameBridgeServer';
import { renderVideoOverlayUi } from './ui/video-overlay';

window.addEventListener('load', () => {
    const bridge = renderVideoOverlayUi(document.getElementById('root')!);
    const listener = new FrameBridgeServer(
        bridge,
        new ExtensionMessageProtocol('asbplayer-frame-to-video', 'asbplayer-video-to-frame')
    );
    listener.bind();

    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
