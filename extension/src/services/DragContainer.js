import ImageElement from './ImageElement';
import { bufferToBase64 } from './Base64';

export default class DragContainer {

    constructor(video) {
        this.video = video;
        this.imageElement = new ImageElement(video);
    }

    bind() {
        if (this.bound) {
            return;
        }

        this.dropListener = async (e) => {
            e.preventDefault();

            this.dragEnterElement = null;
            this.imageElement.element().classList.add("asbplayer-hide");
            this.imageElement.element().classList.remove("asbplayer-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
            this._dragElement().classList.add("asbplayer-hide");

            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
                return;
            }

            const files = [];

            for (const f of e.dataTransfer.files) {
                const extensionStartIndex = f.name.lastIndexOf(".");

                if (extensionStartIndex === -1) {
                    return false;
                }

                const extension = f.name.substring(extensionStartIndex + 1, f.name.length);

                if (extension === 'ass' || extension === 'srt' || extension === 'vtt') {
                    files.push(f);
                }
            }

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: await Promise.all(files.map(async (f) => {
                        const base64 = await bufferToBase64(await f.arrayBuffer());

                        return {
                            name: f.name,
                            base64: base64
                        };
                    }))
                },
                src: this.video.src
            });
        };

        this.dragOverListener = (e) => e.preventDefault();

        this.dragEnterListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = e.target;
            this.imageElement.element().classList.add("asbplayer-drag-image");
            this.imageElement.element().classList.remove("asbplayer-hide");
            this.imageElement.element().classList.add("asbplayer-image-fade-in");
        };

        this.dragLeaveListener = (e) => {
            e.preventDefault();

            if (this.dragEnterElement === e.target) {
                this.imageElement.element().classList.add("asbplayer-hide");
                this.imageElement.element().classList.remove("asbplayer-image-fade-in");
                this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
                this._dragElement().classList.add("asbplayer-hide");
            }
        };

        this.bodyDropListener = (e) => {
            e.preventDefault();
            this.imageElement.element().classList.add("asbplayer-hide");
            this.imageElement.element().classList.remove("asbplayer-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
            this._dragElement().classList.add("asbplayer-hide");
        };

        this.bodyDragOverListener = (e) => e.preventDefault();

        this.bodyDragEnterListener = (e) => {
            e.preventDefault();
            this.bodyDragEnterElement = e.target;
            this._dragElement().classList.add("asbplayer-drag-zone-dragging");
            this._dragElement().classList.remove("asbplayer-hide");
        };

        this.bodyDragLeaveListener = (e) => {
            e.preventDefault();

            if (this.bodyDragEnterElement === e.target) {
                this.imageElement.element().classList.add("asbplayer-hide");
                this.imageElement.element().classList.remove("asbplayer-image-fade-in");
                this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
                this._dragElement().classList.add("asbplayer-hide");
            }
        };

        const dragElement = this._dragElement();

        dragElement.addEventListener('drop', this.dropListener);
        dragElement.addEventListener('dragover', this.dragOverListener);
        dragElement.addEventListener('dragenter', this.dragEnterListener);
        dragElement.addEventListener('dragleave', this.dragLeaveListener);
        document.body.addEventListener('drop', this.bodyDropListener);
        document.body.addEventListener('dragover', this.bodyDragOverListener);
        document.body.addEventListener('dragenter', this.bodyDragEnterListener);
        document.body.addEventListener('dragleave', this.bodyDragLeaveListener);

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

        // Shrink the drag zone slightly to avoid accidentally overflowing
        // e.g. when the video's rect changes for some reason

        dragElement.style.top = (rect.top + rect.height * 0.05) + "px";
        dragElement.style.left = (rect.left + rect.width * 0.05) + "px";
        dragElement.style.height = (rect.height * .9) + "px";
        dragElement.style.width = (rect.width * .9) + "px";
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

        if (this.bodyDropListener) {
            document.body.removeEventListener('drop', this.bodyDropListener);
            this.bodyDropListener = null;
        }

        if (this.bodyDragOverListener) {
            document.body.removeEventListener('dragover', this.bodyDragOverListener);
            this.bodyDragOverListener = null;
        }

        if (this.bodyDragEnterListener) {
            document.body.removeEventListener('dragenter', this.bodyDragEnterListener);
            this.bodyDragEnterListener = null;
        }

        if (this.bodyDragLeaveListener) {
            document.body.removeEventListener('dragleave', this.bodyDragLeaveListener);
            this.bodyDragLeaveListener = null;
        }

        if (this.dragElementStylesInterval) {
            clearInterval(this.dragElementStylesInterval);
            this.dragElementStylesInterval = null;
        }

        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = null;
        }

        this.imageElement.remove();
        this.dragEnterElement = null;
        this.bound = false;
    }
}