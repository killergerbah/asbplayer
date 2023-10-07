import { renderSidePanelUi } from './ui/side-panel';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderSidePanelUi(root, true);
    // const loc = JSON.parse(document.getElementById('loc')!.innerHTML!);
    // const bridge = renderVideoSelectModeUi(root, loc.lang, loc.strings);
    // const listener = new FrameBridgeServer(bridge);
    // listener.bind();

    // window.addEventListener('unload', () => {
    //     listener.unbind();
    // });
});
