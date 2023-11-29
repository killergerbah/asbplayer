import Binding from './services/binding';
import { currentPageDelegate } from './services/pages';
import VideoSelectController from './controllers/video-select-controller';
import {
    CopyToClipboardMessage,
    CropAndResizeMessage,
    TabToExtensionCommand,
    ToggleSidePanelMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { FrameInfoListener, fetchFrameId } from './services/frame-info';
import { cropAndResize } from '@project/common/src/image-transformer';
import { TabAnkiUiController } from './controllers/tab-anki-ui-controller';
import { ExtensionSettingsStorage } from './services/extension-settings-storage';
import { DefaultKeyBinder } from '@project/common/key-binder';

const extensionSettingsStorage = new ExtensionSettingsStorage();
const settingsProvider = new SettingsProvider(extensionSettingsStorage);
const iframesByFrameId: { [frameId: string]: HTMLIFrameElement } = {};

const cacheIframesByFrameId = () => {
    const iframes = document.getElementsByTagName('iframe');

    for (let i = 0; i < iframes.length; ++i) {
        const iframe = iframes[i];

        if (!Object.values(iframesByFrameId).find((f) => iframe === f)) {
            fetchFrameId(iframe).then((frameId) => {
                if (frameId) {
                    iframesByFrameId[frameId] = iframe;
                }
            });
        }
    }

    for (const frameId of Object.keys(iframesByFrameId)) {
        let iframeExists = false;

        for (let i = 0; i < iframes.length; ++i) {
            const iframe = iframes[i];

            if (iframe.isSameNode(iframesByFrameId[frameId])) {
                iframeExists = true;
            }
        }

        if (!iframeExists) {
            delete iframesByFrameId[frameId];
        }
    }
};

let unbindToggleSidePanel: (() => void) | undefined;

const bindToggleSidePanel = () => {
    settingsProvider.getSingle('keyBindSet').then((keyBindSet) => {
        unbindToggleSidePanel?.();
        unbindToggleSidePanel = new DefaultKeyBinder(keyBindSet).bindToggleSidePanel(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const command: TabToExtensionCommand<ToggleSidePanelMessage> = {
                    sender: 'asbplayer-video-tab',
                    message: {
                        command: 'toggle-side-panel',
                    },
                };
                chrome.runtime.sendMessage(command);
            },
            () => false,
            true
        );
    });
};

const hasValidVideoSource = (videoElement: HTMLVideoElement) => {
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
};

const bind = () => {
    const bindings: Binding[] = [];
    const page = currentPageDelegate();
    let subSyncAvailable = page !== undefined;
    let frameInfoListener: FrameInfoListener | undefined;

    if (window.self !== window.top) {
        // Inside iframe, listen for frame ID requests
        frameInfoListener = new FrameInfoListener();
        frameInfoListener.bind();
    }

    const bindToVideoElements = () => {
        const videoElements = document.getElementsByTagName('video');

        for (let i = 0; i < videoElements.length; ++i) {
            const videoElement = videoElements[i];
            const bindingExists = bindings.filter((b) => b.video.isSameNode(videoElement)).length > 0;

            if (!bindingExists && hasValidVideoSource(videoElement) && !page?.shouldIgnore(videoElement)) {
                const b = new Binding(videoElement, subSyncAvailable, frameInfoListener?.frameId);
                b.bind();
                bindings.push(b);
            }
        }

        for (let i = bindings.length - 1; i >= 0; --i) {
            const b = bindings[i];
            let videoElementExists = false;

            for (let j = 0; j < videoElements.length; ++j) {
                const videoElement = videoElements[j];

                if (videoElement.isSameNode(b.video) && hasValidVideoSource(videoElement)) {
                    videoElementExists = true;
                    break;
                }
            }

            if (!videoElementExists) {
                bindings.splice(i, 1);
                b.unbind();
            }
        }
    };

    bindToVideoElements();
    cacheIframesByFrameId();
    const videoInterval = setInterval(bindToVideoElements, 1000);
    const iframeInterval = setInterval(cacheIframesByFrameId, 10000);

    const videoSelectController = new VideoSelectController(bindings);
    videoSelectController.bind();

    const ankiUiController = new TabAnkiUiController(settingsProvider);
    const isParentDocument = window.self === window.top;

    if (isParentDocument) {
        bindToggleSidePanel();
    }

    const messageListener = (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        if (!isParentDocument) {
            // Inside iframe - only root window is allowed to handle messages here
            return;
        }

        if (request.sender !== 'asbplayer-extension-to-video') {
            return;
        }

        switch (request.message.command) {
            case 'copy-to-clipboard':
                const copyToClipboardMessage = request.message as CopyToClipboardMessage;
                fetch(copyToClipboardMessage.dataUrl)
                    .then((response) => response.blob())
                    .then((blob) =>
                        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(console.error)
                    );
                break;
            case 'crop-and-resize':
                const cropAndResizeMessage = request.message as CropAndResizeMessage;
                let rect = cropAndResizeMessage.rect;

                if (cropAndResizeMessage.frameId !== undefined) {
                    const iframe = iframesByFrameId[cropAndResizeMessage.frameId];

                    if (iframe !== undefined) {
                        const iframeRect = iframe.getBoundingClientRect();
                        rect = {
                            left: rect.left + iframeRect.left,
                            top: rect.top + iframeRect.top,
                            width: rect.width,
                            height: rect.height,
                        };
                    }
                }

                cropAndResize(
                    cropAndResizeMessage.maxWidth,
                    cropAndResizeMessage.maxHeight,
                    rect,
                    cropAndResizeMessage.dataUrl
                ).then((dataUrl) => sendResponse({ dataUrl }));
                return true;
            case 'show-anki-ui':
                if (request.src === undefined) {
                    // Message intended for the tab, and not a specific video binding
                    ankiUiController.show(request.message);
                }
                break;
            case 'settings-updated':
                bindToggleSidePanel();
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

        clearInterval(videoInterval);
        clearInterval(iframeInterval);
        videoSelectController.unbind();
        frameInfoListener?.unbind();
        unbindToggleSidePanel?.();
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
