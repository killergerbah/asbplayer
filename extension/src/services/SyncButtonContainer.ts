import Binding from './Binding';
import ImageElement, { Layout } from './ImageElement';

export default class SyncButtonContainer {
    private readonly _imageElement: ImageElement;
    private readonly _video: HTMLVideoElement;

    private _clickListener?: (event: MouseEvent) => void;
    private _pauseListener?: () => void;
    private _playListener?: () => void;
    // private _fullscreenChangeListener?: () => void;
    private _mousemoveListener?: (e: MouseEvent) => void;
    private _bound = false;
    private _canShow = false;

    constructor(video: HTMLVideoElement) {
        this._imageElement = new ImageElement(video, Layout.corner, 'asbplayer-sync-button-fade-in');
        this._video = video;
    }

    bind(context: Binding) {
        if (this._bound) {
            return;
        }

        this._clickListener = () => context.showVideoDataDialog();
        this._imageElement.containerHtmlElement.addEventListener('click', this._clickListener);
        this._imageElement.containerHtmlElement.classList.add('asbplayer-sync-button');

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
        // this._fullscreenChangeListener = () => {
        //     if (document.fullscreenElement) {
        //         this._canShow = false;
        //         this._hide();
        //     } else {
        //         this._canShow = true;
        //     }
        // };
        this._video.addEventListener('pause', this._pauseListener);
        this._video.addEventListener('play', this._playListener);
        this._video.addEventListener('playing', this._playListener);
        // document.addEventListener('fullscreenchange', this._fullscreenChangeListener);
        this._bound = true;
    }

    private _show() {
        if (!this._canShow) {
            return;
        }

        if (!this._paused()) {
            return;
        }

        this._imageElement.show();
    }

    private _hide() {
        this._imageElement.hide();
    }

    private _paused() {
        return this._video.paused || this._video.currentTime === 0;
    }

    unbind() {
        if (this._mousemoveListener) {
            document.removeEventListener('mousemove', this._mousemoveListener);
        }

        if (this._pauseListener) {
            this._video.removeEventListener('pause', this._pauseListener);
        }

        if (this._playListener) {
            this._video.removeEventListener('play', this._playListener);
            this._video.removeEventListener('playing', this._playListener);
            this._playListener = undefined;
        }

        // if (this._fullscreenChangeListener) {
        //     document.removeEventListener('fullscreenchange', this._fullscreenChangeListener);
        //     this._fullscreenChangeListener = undefined;
        // }

        if (this._clickListener) {
            this._imageElement.containerHtmlElement.removeEventListener('click', this._clickListener);
            this._clickListener = undefined;
        }

        this._imageElement.remove();
        this._bound = false;
    }
}
