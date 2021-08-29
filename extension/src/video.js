import Binding from './services/Binding';

window.addEventListener('load', (event) => {
    const bindings = [];
    let videoSelectMode = false;

    const interval = setInterval(() => {
        const videoElements = document.getElementsByTagName('video');

        for (const v of videoElements) {
            const bindingExists = bindings.filter(b => b.video.isSameNode(v)).length > 0;

            if (!bindingExists) {
                const b = new Binding(v);
                b.bind();
                bindings.push(b);
            }
        }

        let i = 0;

        for (let i = bindings.length - 1; i >= 0; --i) {
            const b = bindings[i];
            let videoElementExists = false;

            for (const v of videoElements) {
                if (v.isSameNode(b.video)) {
                    videoElementExists = true;
                    break;
                }
            }

            if (!videoElementExists) {
                bindings.splice(i, 1);
                b.unbind();
            }
        }
    }, 1000);

    const messageListener = (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-extension-to-video') {
            switch (request.message.command) {
                case 'toggle-video-select':
                    if (videoSelectMode) {
                        // Toggle off
                        for (const b of bindings) {
                            b.unbindVideoSelect();
                        }
                        videoSelectMode = false;
                    }

                    // Toggle on
                    videoSelectMode = true;

                    for (const b of bindings) {
                        b.bindVideoSelect(() => {
                            for (const b of bindings) {
                                b.unbindVideoSelect();
                            }
                        });
                    }

                    break;
                case 'subtitles':
                    for (const b of bindings) {
                        b.unbindVideoSelect();
                    }

                    videoSelectMode = false;
                    break;
                default:
                    // ignore
            }
        }
    }

    chrome.runtime.onMessage.addListener(messageListener);

    window.addEventListener('beforeunload', (event) => {
        for (let b of bindings) {
            b.unbind();
        }

        bindings.length = 0;

        clearInterval(interval);
        chrome.runtime.onMessage.removeListener(messageListener);
    });
});
