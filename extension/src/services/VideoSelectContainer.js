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

        this.mouseEnterListener = (e) => {
            e.preventDefault();
            this.imageElement.element().classList.remove("asbplayer-hide");
        };

        this.mouseLeaveListener = (e) => {
            e.preventDefault();
            this.imageElement.element().classList.add("asbplayer-hide");
        };

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
        }

        this.video.addEventListener('mouseenter', this.mouseEnterListener);
        this.video.addEventListener('mouseleave', this.mouseLeaveListener);
        this.video.addEventListener('click', this.clickListener);
        this.bound = true;
    }

    unbind() {
        if (this.mouseEnterListener) {
            this.video.removeEventListener('mouseenter', this.mouseEnterListener);
            this.mouseEnterListener = null;
        }

        if (this.mouseLeaveListener) {
            this.video.removeEventListener('mouseleave', this.mouseLeaveListener);
            this.mouseLeaveListener = null;
        }

        if (this.clickListener) {
            this.video.removeEventListener('click', this.clickListener);
            this.clickListener = null;
        }

        this.imageElement.remove();
        this.bound = false;
    }
}