import Overlay from './Overlay';

const fillImageWidth = 300;
const fillImageHeight = 300;

export default class ImageElement {
    private readonly _video: HTMLVideoElement;
    private readonly _overlay: Overlay;
    private _imageElement?: HTMLDivElement;
    private _containerElement?: HTMLDivElement;
    private _imageElementStylesInterval?: NodeJS.Timeout;

    constructor(video: HTMLVideoElement) {
        this._video = video;
        this._overlay = new Overlay(this._video, {
            onFullscreenContainerElementCreated: (container) => {
                container.classList.add('asbplayer-image-fill-container');
            },
        });
    }

    get containerHtmlElement() {
        if (this._containerElement) {
            return this._containerElement;
        }

        this._init();
        return this._containerElement!;
    }

    private _init() {
        const container = document.createElement('div');
        container.classList.add('asbplayer-hide');

        const image = document.createElement('img');
        image.classList.add('asbplayer-image');
        image.src = chrome.runtime.getURL('assets/image.png');

        this._applyImageContainerStyles(image, container);

        container.appendChild(image);
        this._overlay.setChild(container);

        this._imageElementStylesInterval = setInterval(() => this._applyImageContainerStyles(image, container), 1000);
        this._containerElement = container;
        this._imageElement = image;
    }

    show() {
        this.containerHtmlElement.classList.remove('asbplayer-hide');
        this.containerHtmlElement.classList.add('asbplayer-fade-in');
    }

    hide() {
        this.containerHtmlElement.classList.add('asbplayer-hide');
        this.containerHtmlElement.classList.remove('asbplayer-fade-in');
    }

    private _applyImageContainerStyles(image: HTMLImageElement, container: HTMLDivElement) {
        const rect = this._video.getBoundingClientRect();
        container.classList.add('asbplayer-image-fill-container');
        const containerWidth = Math.min(window.innerWidth, rect.width) * 0.9;
        const containerHeight = Math.min(window.innerHeight, rect.height) * 0.9;
        container.style.top = rect.top + window.scrollY + rect.height * 0.05 + 'px';
        container.style.left = rect.left + rect.width * 0.05 + 'px';
        container.style.width = containerWidth + 'px';
        container.style.height = containerHeight + 'px';
        const imageRatio = Math.min(1, Math.min(containerWidth / fillImageWidth, containerHeight / fillImageHeight));
        const imageWidth = fillImageWidth * imageRatio;
        const imageHeight = fillImageHeight * imageRatio;
        const topOffset = (containerHeight - imageHeight) / 2;
        const leftOffset = (containerWidth - imageWidth) / 2;
        image.style.top = topOffset + 'px';
        image.style.left = leftOffset + 'px';
        image.style.width = imageWidth + 'px';
        image.style.height = imageHeight + 'px';
    }

    remove() {
        if (this._imageElementStylesInterval) {
            clearInterval(this._imageElementStylesInterval);
            this._imageElementStylesInterval = undefined;
        }

        if (this._imageElement) {
            this._imageElement.remove();
            this._imageElement = undefined;
        }
    }
}
