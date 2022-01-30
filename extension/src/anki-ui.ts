import { renderAnkiUi } from './ui/anki';
import FrameBridgeServer from './services/FrameBridgeServer';

window.addEventListener('load', (e) => {
    const mp3WorkerUrl = URL.createObjectURL(
        new Blob([document.querySelector('#mp3-encoder-worker')!.textContent!], { type: 'text/javascript' })
    );

    const bridge = renderAnkiUi(document.getElementById('root')!, mp3WorkerUrl);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();

    window.addEventListener('unload', (e) => {
        listener.unbind();
    });
});
