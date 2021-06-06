export default class DragContainer {

    constructor(video) {
        this.video = video;
    }

    bind() {
        if (this.bound) {
            return;
        }

        this.dropListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = null;
            this._imageElement().classList.add("asbplayer-hide");
            this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");

            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
                return;
            }

            const file = e.dataTransfer.files[0];

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: {
                        name: file.name,
                        fileUrl: URL.createObjectURL(file)
                    }
                },
                src: this.video.src
            });
        };

        this.dragOverListener = (e) => e.preventDefault();

        this.dragEnterListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = e.target;
            this._imageElement().classList.remove("asbplayer-hide");
            this._imageElement().classList.add("asbplayer-drag-image-fade-in");
        };

        this.bodyDragEnterListener = (e) => {
            e.preventDefault();

            this._dragElement().classList.add("asbplayer-drag-zone-dragging");
        };

        this.bodyDropListener = (e) => {
            e.preventDefault();

            this._imageElement().classList.add("asbplayer-hide");
            this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
        };

        this.dragLeaveListener = (e) => {
            e.preventDefault();

            if (this.dragEnterElement === e.target) {
                this._imageElement().classList.add("asbplayer-hide");
                this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
                this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
            }
        };

        const dragElement = this._dragElement();

        dragElement.addEventListener('drop', this.dropListener);
        dragElement.addEventListener('dragover', this.dragOverListener);
        dragElement.addEventListener('dragenter', this.dragEnterListener);
        dragElement.addEventListener('dragleave', this.dragLeaveListener);
        document.body.addEventListener('dragenter', this.bodyDragEnterListener);
        document.body.addEventListener('drop', this.bodyDropListener);

        this.bound = true;
    }

    _dragElement() {
        if (this.dragElement) {
            return this.dragElement;
        }

        const dragElement = document.createElement('div');
        dragElement.classList.add("asbplayer-drag-zone-initial");
        this.dragElement = dragElement;
        this._applyDragElementStyles(dragElement);

        document.body.appendChild(dragElement);

        this.dragElementStylesInterval = setInterval(() => this._applyDragElementStyles(dragElement), 1000);

        return this.dragElement;
    }

    _applyDragElementStyles(dragElement) {
        const rect = this.video.getBoundingClientRect();
        dragElement.style.top = rect.top + "px";
        dragElement.style.left = rect.left + "px";
        dragElement.style.height = rect.height + "px";
        dragElement.style.width = rect.width + "px";
    }

    _imageElement() {
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
        const imageLength = Math.min(rect.width, rect.height, 500);
        const topOffset = (rect.height - imageLength) / 2;
        const leftOffset =  (rect.width - imageLength) / 2;
        image.style.top = topOffset + "px";
        image.style.left = leftOffset + "px";
        image.style.width = imageLength + "px";
        image.style.height = imageLength + "px";
        container.style.top = rect.top + "px";
        container.style.left = rect.left + "px";
        container.style.height = rect.height + "px";
        container.style.width = rect.width + "px";
    }

    unbind() {
        if (this.dropListener) {
            this.dragElement.removeEventListener('drop', this.dropListener, true);
            this.dropListener = null;
        }

        if (this.dragOverListener) {
            this.dragElement.removeEventListener('dragover', this.dragOverListener, true);
            this.dragOverListener = null;
        }

        if (this.dragEnterListener) {
            this.dragElement.removeEventListener('dragenter', this.dragEnterListener, true);
            this.dragEnterListener = null;
        }

        if (this.dragLeaveListener) {
            this.dragElement.removeEventListener('dragleave', this.dragLeaveListener, true);
            this.dragLeaveListener =  null;
        }

        if (this.bodyDragEnterListener) {
            document.body.removeEventListener('dragenter', this.bodyDragEnterListener);
            this.bodyDragEnterListener = null;
        }
        if (this.bodyDropListener) {
            document.body.removeEventListener('drop', this.bodyDropListener);
            this.bodyDropListener = null;
        }

        if (this.imageElementStylesInterval) {
            clearInterval(this.imageElementStylesInterval);
            this.imageElementStylesInterval = null;
        }

        if (this.imageElement) {
            this.imageElement.remove();
            this.imageElement = null;
        }

        if (this.dragElementStylesInterval) {
            clearInterval(this.dragElementStylesInterval);
            this.dragElementStylesInterval = null;
        }

        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = null;
        }

        this.dragEnterElement = null;
        this.bound = false;
    }
}