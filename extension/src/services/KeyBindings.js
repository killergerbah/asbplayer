import { KeyBindings as CommonKeyBindings } from '@project/common';

export default class KeyBindings {

    constructor() {
    }

    bind(context) {
        if (this.bound) {
            return;
        }

        this.unbindSeekToSubtitle = CommonKeyBindings.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const progress = subtitle.start / length;
                context.seek(subtitle.start / 1000);
            },
            () => false,
            () => context.video.currentTime,
            () => context.subtitleContainer.subtitles,
            true
        );

        this.unbindToggleSubtitles = CommonKeyBindings.bindToggleSubtitles(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                chrome.runtime.sendMessage({
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggle-subtitles'
                    },
                    src: context.video.src
                });
            },
            () => false,
            true
        );

        this.bound = true;
    }

    unbind() {
        if (this.unbindSeekToSubtitle) {
            this.unbindSeekToSubtitle();
            this.unbindSeekToSubtitle = null;
        }

        if (this.unbindToggleSubtitles) {
            this.unbindToggleSubtitles();
            this.unbindToggleSubtitles = null;
        }

        this.bound = false;
    }
}