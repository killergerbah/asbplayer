import { renderAppUi } from './ui/app';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderAppUi(root, true);
    // const loc = JSON.parse(document.getElementById('loc')!.innerHTML!);
    // const bridge = renderVideoSelectModeUi(root, loc.lang, loc.strings);
    // const listener = new FrameBridgeServer(bridge);
    // listener.bind();

    // window.addEventListener('unload', () => {
    //     listener.unbind();
    // });
});
