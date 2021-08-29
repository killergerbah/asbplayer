export default class ImageElement {

    constructor(video) {
        this.video = video;
    }

    element() {
        if (this.imageElement) {
            return this.imageElement;
        }

        const container = document.createElement('div');
        container.classList.add("asbplayer-drag-image-container");
        container.classList.add("asbplayer-hide");

        const image = document.createElement('img');
        image.classList.add("asbplayer-drag-image");
        image.src = chrome.runtime.getURL('assets/drag-image.png');

        this._applyImageContainerStyles(image, container);

        container.appendChild(image);
        document.body.appendChild(container);

        this.imageElementStylesInterval = setInterval(() => this._applyImageContainerStyles(image, container), 1000);
        this.imageElement = container;

        return this.imageElement;
    }

    _applyImageContainerStyles(image, container) {
        const rect = this.video.getBoundingClientRect();
        const containerWidth = rect.width * .9;
        const containerHeight = rect.height * .9;
        container.style.top = (rect.top + rect.height * 0.05) + "px";
        container.style.left = (rect.left + rect.width * 0.05) + "px";
        container.style.width = containerWidth + "px";
        container.style.height = containerHeight + "px";

        const dragImageWidth = 350;
        const dragImageHeight = 450;
        const imageRatio = Math.min(1, Math.min(containerWidth / dragImageWidth, containerHeight / dragImageHeight));
        const imageWidth = dragImageWidth * imageRatio;
        const imageHeight = dragImageHeight * imageRatio;

        const topOffset = (containerHeight - imageHeight) / 2;
        const leftOffset =  (containerWidth - imageWidth) / 2;
        image.style.top = topOffset + "px";
        image.style.left = leftOffset + "px";
        image.style.width = imageWidth + "px";
        image.style.height = imageHeight + "px";
    }

    remove() {
        if (this.imageElementStylesInterval) {
            clearInterval(this.imageElementStylesInterval);
            this.imageElementStylesInterval = null;
        }

        if (this.imageElement) {
            this.imageElement.remove();
            this.imageElement = null;
        }
    }
}