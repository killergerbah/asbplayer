import Binding from './services/Binding';
import { currentPageDelegate } from './services/pages';

const bind = () => {
    const bindings: Binding[] = [];
    const page = currentPageDelegate();
    let videoSelectMode = false;
    let subSyncAvailable = page !== undefined;

    const interval = setInterval(() => {
        const videoElements = document.getElementsByTagName('video');

        for (let i = 0; i < videoElements.length; ++i) {
            const videoElement = videoElements[i];
            const bindingExists = bindings.filter((b) => b.video.isSameNode(videoElement)).length > 0;

            if (!bindingExists && _hasValidSource(videoElement) && !page?.shouldIgnore(videoElement)) {
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
                        const binding = bindings[0];

                        if (binding.subscribed) {
                            // Special case - show dialog for the one video element
                            binding.showVideoSelect();
                        }
                    } else {
                        // Toggle on
                        videoSelectMode = true;

                        for (const b of bindings) {
                            if (b.subscribed) {
                                b.bindVideoSelect(() => {
                                    for (const b of bindings) {
                                        b.unbindVideoSelect();
                                    }

                                    videoSelectMode = false;
                                });
                            }
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
};

if (document.readyState === 'complete') {
    bind();
} else {
    document.addEventListener('readystatechange', (event) => {
        if (document.readyState === 'complete') {
            bind();
        }
    });
}

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
