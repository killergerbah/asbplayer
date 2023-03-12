import { PostMineAction } from '@project/common';
import Binding from './Binding';
import Overlay from './Overlay';
import FrameBridgeClient from './FrameBridgeClient';

const html = `<!DOCTYPE html>
                <html lang="en">
                    <body>
                        <html lang="en">
                        <head>
                            <meta charset="utf-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <title>asbplayer - Video Overlay</title>
                        </head>
                        <body>
                        <div id="root" style="width:100%;height:100vh;"></div>
                            <script src="${chrome.runtime.getURL('./video-overlay-ui.js')}"></script>
                        </body>
                    </body>
                </html>
`;

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
    private _uiLoaded = false;
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

            if (x > rect.width * 0.75 && x <= rect.width && y < rect.height * 0.25 && y >= 0) {
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
        if (!this._canShow) {
            return;
        }

        if (!this._paused()) {
            return;
        }

        if (!this._uiLoaded) {
            this._frame = document.createElement('iframe');
            this._frame.style.width = '48px';
            this._frame.style.colorScheme = 'normal';
            this._client = new FrameBridgeClient(this._frame);
            this._overlay.setChild(this._frame);
            const doc = this._frame.contentDocument!;
            doc.open();
            doc.write(html);
            doc.close();
            this._client.bind();
            this._client.onServerMessage((message) => {
                if (message.command === 'subtitles') {
                    this._context.videoDataSyncContainer.show();
                } else if (message.command === 'anki') {
                    this._context.copySubtitle(PostMineAction.showAnkiDialog);
                }
            });
            this._uiLoaded = true;
        }

        if (this._overlay.nonFullscreenContainerElement) {
            this._showElement(this._overlay.nonFullscreenContainerElement);
        }

        if (this._overlay.fullscreenContainerElement) {
            this._showElement(this._overlay.fullscreenContainerElement);
        }
    }

    private _hide() {
        if (this._overlay.nonFullscreenContainerElement) {
            this._hideElement(this._overlay.nonFullscreenContainerElement);
        }

        if (this._overlay.fullscreenContainerElement) {
            this._hideElement(this._overlay.fullscreenContainerElement);
        }
    }

    private _showElement(element: HTMLElement) {
        element.classList.remove('asbplayer-hide');
        element.classList.add('asbplayer-fade-in');
    }

    private _hideElement(element: HTMLElement) {
        element.classList.add('asbplayer-hide');
        element.classList.remove('asbplayer-fade-in');
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
        this._uiLoaded = false;
    }
}
