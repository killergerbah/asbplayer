import ImageElement from './ImageElement';
import VideoNameUiContainer from './VideoNameUiContainer';

export default class VideoSelectContainer {
    constructor(video) {
        this.video = video;
        this.imageElement = new ImageElement(video);
    }

    bind(context, doneListener) {
        if (this.bound) {
            throw new Error('Video select container already bound');
        }

        const image = this.imageElement.element();
        image.classList.remove('asbplayer-hide');
        image.classList.add('asbplayer-mouse-over-image');

        image.addEventListener('click', (e) => {
            e.preventDefault();
            this.show(context, doneListener);
        });

        this.bound = true;
    }

    show(context, doneListener) {
        this.uiContainer = new VideoNameUiContainer(
            (videoName) => {
                chrome.runtime.sendMessage({
                    sender: 'asbplayer-video',
                    message: {
                        command: 'sync',
                        subtitles: [
                            {
                                name: `${videoName}.srt`,
                                base64: '',
                            },
                        ],
                    },
                    src: this.video.src,
                });
                doneListener();
            },
            () => doneListener()
        );
        this.uiContainer.show(context);
    }

    unbind() {
        this.imageElement.remove();

        if (this.uiContainer) {
            this.uiContainer.unbind();
            this.uiContainer = null;
        }

        this.bound = false;
    }
}
