import Binding from './services/binding';
import { currentPageDelegate } from './services/pages';
import VideoSelectController from './controllers/video-select-controller';
import { CopyToClipboardMessage } from '@project/common';

const bind = () => {
    const bindings: Binding[] = [];
    const page = currentPageDelegate();
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

        for (let i = bindings.length - 1; i >= 0; --i) {
            const b = bindings[i];
            let videoElementExists = false;

            for (let j = 0; j < videoElements.length; ++j) {
                const videoElement = videoElements[j];

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

    const videoSelectController = new VideoSelectController(bindings);
    videoSelectController.bind();

    const messageListener = (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        if (request.sender !== 'asbplayer-extension-to-video') {
            return;
        }

        switch (request.message.command) {
            case 'copy-to-clipboard':
                if (window.self !== window.top) {
                    // Inside iframe, copy might not work
                    return;
                }

                const copyToClipboardMessage = request.message as CopyToClipboardMessage;
                fetch(copyToClipboardMessage.dataUrl)
                    .then((response) => response.blob())
                    .then((blob) =>
                        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(console.error)
                    );
                break;
            default:
            // ignore
        }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    window.addEventListener('beforeunload', (event) => {
        for (let b of bindings) {
            b.unbind();
        }

        bindings.length = 0;

        clearInterval(interval);
        videoSelectController.unbind();
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
