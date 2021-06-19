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
            () => context.video.currentTime * 1000,
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
            () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
            true
        );

        this.unbindOffsetToSubtitle = CommonKeyBindings.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                context.subtitleContainer.offset(offset);
            },
            () => false,
            () => context.video.currentTime * 1000,
            () => context.subtitleContainer.subtitles,
            true
        );

        this.unbindAdjustOffset = CommonKeyBindings.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                context.subtitleContainer.offset(offset);
            },
            () => false,
            () => context.subtitleContainer.subtitles,
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

        if (this.unbindOffsetToSubtitle) {
            this.unbindOffsetToSubtitle();
            this.unbindOffsetToSubtitle = null;
        }

        if (this.unbindAdjustOffset) {
            this.unbindAdjustOffset();
            this.unbindAdjustOffset = null;
        }

        this.bound = false;
    }
}