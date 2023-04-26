import { renderAnkiUi } from './ui/anki';
import FrameBridgeServer from './services/frame-bridge-server';

window.addEventListener('load', (e) => {
    const mp3WorkerUrl = URL.createObjectURL(
        new Blob([document.querySelector('#mp3-encoder-worker')!.textContent!], { type: 'text/javascript' })
    );

    const root = document.getElementById('root')!;
    const bridge = renderAnkiUi(root, mp3WorkerUrl, root.dataset.lang!);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', (e) => {
        listener.unbind();
    });
});
