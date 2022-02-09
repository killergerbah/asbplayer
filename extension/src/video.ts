import Binding from './services/Binding';

window.addEventListener('load', (event) => {
    const bindings: Binding[] = [];
    const pages = [];
    const urlObj = new URL(window.location.href);

    let videoSelectMode = false;
    let subSyncAvailable = false;

    switch (urlObj.host) {
        case 'www.netflix.com':
            subSyncAvailable = true;
            pages.push(chrome.runtime.getURL('pages/netflix-page.js'));
            break;
        case 'www.youtube.com':
            subSyncAvailable = true;
            pages.push(chrome.runtime.getURL('pages/youtube-page.js'));
            break;
        default:
            break;
    }

    for (let index = 0, length = pages.length; index < length; index++) {
        const s = document.createElement('script');

        s.src = pages[index];
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
    }

    const interval = setInterval(() => {
        const videoElements = document.getElementsByTagName('video');

        for (let i = 0; i < videoElements.length; ++i) {
            const videoElement = videoElements[i];
            const bindingExists = bindings.filter((b) => b.video.isSameNode(videoElement)).length > 0;

            if (!bindingExists && _hasValidSource(videoElement)) {
                const b = new Binding(videoElement, subSyncAvailable);
                b.bind();
                bindings.push(b);
            }
        }

        let i = 0;

        for (let i = bindings.length - 1; i >= 0; --i) {
            const b = bindings[i];
            let videoElementExists = false;

            for (let i = 0; i < videoElements.length; ++i) {
                const videoElement = videoElements[i];

                if (videoElement.isSameNode(b.video) && _hasValidSource(videoElement)) {
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

    const messageListener = (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        if (request.sender === 'asbplayer-extension-to-video') {
            switch (request.message.command) {
                case 'toggle-video-select':
                    if (videoSelectMode) {
                        // Toggle off
                        for (const b of bindings) {
                            b.unbindVideoSelect();
                        }

                        videoSelectMode = false;
                        break;
                    }

                    if (bindings.length === 1) {
                        // Special case - show dialog for the one video element
                        bindings[0].showVideoSelect();
                    } else {
                        // Toggle on
                        videoSelectMode = true;

                        for (const b of bindings) {
                            b.bindVideoSelect(() => {
                                for (const b of bindings) {
                                    b.unbindVideoSelect();
                                }

                                videoSelectMode = false;
                            });
                        }
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
    };

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

function _hasValidSource(videoElement: HTMLVideoElement) {
    if (videoElement.src) {
        return true;
    } 

    for (let index = 0, length = videoElement.children.length; index < length; index++) {
        const elm = videoElement.children[index];

        if ('SOURCE' === elm.tagName && (elm as HTMLSourceElement).src) {
            return true;
        }
    }

    return false;
}
