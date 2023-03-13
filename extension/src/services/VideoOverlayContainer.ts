import { PostMineAction } from '@project/common';
import Binding from './Binding';
import Overlay from './Overlay';
import FrameBridgeClient from './FrameBridgeClient';
import { ExtensionMessageProtocol } from './FrameBridgeProtocol';

export default class VideoOverlayContainer {
    private readonly _context: Binding;
    private readonly _video: HTMLVideoElement;
    private readonly _overlay: Overlay;

    private _pauseListener?: () => void;
    private _playListener?: () => void;
    private _mousemoveListener?: (e: MouseEvent) => void;
    private _stylesInterval?: NodeJS.Timer;
    private _bound = false;
    private _canShow = false;
    private _hidden = true;
    private _frame?: HTMLIFrameElement;
    private _client?: FrameBridgeClient;

    constructor(context: Binding) {
        this._context = context;
        this._video = context.video;
        this._overlay = new Overlay(context.video, {
            onFullscreenContainerElementCreated: (container) => this._applyContainerStyles(container),
            onNonFullscreenContainerElementCreated: (container) => this._applyContainerStyles(container),
        });
    }

    bind() {
        if (this._bound) {
            return;
        }

        this._mousemoveListener = (e: MouseEvent) => {
            var rect = this._video.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;

            if (x > Math.max(0, rect.width - 150) && x <= rect.width && y < Math.min(rect.height, 150) && y >= 0) {
                this._show();
            } else {
                this._hide();
            }
        };
        document.addEventListener('mousemove', this._mousemoveListener);

        if (this._paused()) {
            this._canShow = true;
        }

        this._pauseListener = () => {
            this._canShow = true;
        };
        this._playListener = () => {
            this._canShow = false;
        };
        this._video.addEventListener('pause', this._pauseListener);
        this._video.addEventListener('play', this._playListener);
        this._video.addEventListener('playing', this._playListener);
        this._stylesInterval = setInterval(() => {
            if (this._overlay.fullscreenContainerElement) {
                this._applyContainerStyles(this._overlay.fullscreenContainerElement);
            }

            if (this._overlay.nonFullscreenContainerElement) {
                this._applyContainerStyles(this._overlay.nonFullscreenContainerElement);
            }
        }, 1000);

        this._bound = true;
    }

    private _show() {
        if (!this._context.recordingMedia && (!this._canShow || !this._paused())) {
            return;
        }

        if (!this._hidden) {
            return;
        }
        
        // It's difficult to cache the iframe since we would potentially need to change its parent in order to keep it visible.
        // However, iframes lose their contents when their parent changes.
        // So while it's extremely inefficient, we recreate it every time we need to show it.
        this._frame?.remove();
        this._frame = undefined;
        this._client?.unbind();
        this._client = undefined;
        this._frame = document.createElement('iframe');
        this._frame.style.width = '48px';
        this._frame.style.colorScheme = 'normal';
        this._frame.style.border = '0';
        this._frame.src = chrome.runtime.getURL('./video-overlay-ui.html');
        const client = new FrameBridgeClient(
            new ExtensionMessageProtocol('asbplayer-video-to-frame', 'asbplayer-frame-to-video')
        );
        this._client = client;
        this._overlay.remove();
        this._overlay.setChild(this._frame);
        client.onServerMessage((message) => {
            if (message.command === 'subtitles') {
                this._context.videoDataSyncContainer.show();
            } else if (message.command === 'anki') {
                this._context.copySubtitle(PostMineAction.showAnkiDialog);
            }
        });
        client.bind().then(() => client.updateState({ showAnkiButton: this._context.synced }));

        this._hidden = false;
    }

    private _hide() {
        if (this._hidden) {
            return;
        }

        if (this._overlay.nonFullscreenContainerElement) {
            this._hideElement(this._overlay.nonFullscreenContainerElement);
        }

        if (this._overlay.fullscreenContainerElement) {
            this._hideElement(this._overlay.fullscreenContainerElement);
        }

        this._hidden = true;
    }

    private _hideElement(element: HTMLElement) {
        element.classList.add('asbplayer-hide');
    }

    private _paused() {
        return this._video.paused || this._video.currentTime === 0;
    }

    private _applyContainerStyles(container: HTMLElement) {
        const rect = this._video.getBoundingClientRect();
        container.classList.add('asbplayer-video-overlay-container');
        const containerWidth = Math.min(rect.width, 48);
        container.style.top = rect.top + window.scrollY + 10 + 'px';
        container.style.left = rect.left + (rect.width - containerWidth) - 10 + 'px';
        container.style.width = containerWidth + 'px';
    }

    unbind() {
        if (this._mousemoveListener) {
            document.removeEventListener('mousemove', this._mousemoveListener);
            this._mousemoveListener = undefined;
        }

        if (this._pauseListener) {
            this._video.removeEventListener('pause', this._pauseListener);
            this._pauseListener = undefined;
        }

        if (this._playListener) {
            this._video.removeEventListener('play', this._playListener);
            this._video.removeEventListener('playing', this._playListener);
            this._playListener = undefined;
        }

        if (this._stylesInterval) {
            clearInterval(this._stylesInterval);
            this._stylesInterval = undefined;
        }

        this._overlay.remove();
        this._frame?.remove();
        this._frame = undefined;
        this._client?.unbind();
        this._client = undefined;
        this._bound = false;
    }
}
