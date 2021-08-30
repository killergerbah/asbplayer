import ImageElement from './ImageElement';

export default class VideoSelectContainer {

    constructor(video) {
        this.video = video;
        this.imageElement = new ImageElement(video);
    }

    bind(selectedListener) {
        if (this.bound) {
            throw new Error("Video select container already bound");
        }

        const image = this.imageElement.element();
        const container = this._containerElement();
        image.classList.remove("asbplayer-hide");

        this.clickListener = (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: [{
                        name: `${document.title}.srt`,
                        base64: ''
                    }]
                },
                src: this.video.src
            });
            selectedListener();
        };

        container.addEventListener('click', this.clickListener);
        container.appendChild(image);

        this.bound = true;
    }

    _containerElement() {
        if (this.containerElement) {
            return this.containerElement;
        }

        const containerElement = document.createElement('div');
        containerElement.classList.add("asbplayer-mouse-over-container");
        this.containerElement = containerElement;
        this._applyContainerElementStyles(containerElement);

        document.body.appendChild(containerElement);

        this.containerElementStylesInterval = setInterval(() => this._applyContainerElementStyles(containerElement), 1000);

        return this.containerElement;
    }

    _applyContainerElementStyles(element) {
        const rect = this.video.getBoundingClientRect();
        element.style.top = (rect.top + rect.height * 0.05) + "px";
        element.style.left = (rect.left + rect.width * 0.05) + "px";
        element.style.height = (rect.height * .9) + "px";
        element.style.width = (rect.width * .9) + "px";
    }

    unbind() {
        if (this.containerElement) {
            if (this.clickListener) {
                this.containerElement.removeEventListener('click', this.clickListener);
            }

            this.containerElement.remove();
            this.containerElement = null;
        }

        if (this.containerElementStylesInterval) {
            clearInterval(this.containerElementStylesInterval);
            this.containerElementStylesInterval = null;
        }

        this.clickListener = null;
        this.imageElement.remove();
        this.bound = false;
    }
}