import {
    KeyBindings as CommonKeyBindings,
    ToggleSubtitlesInListMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import Binding from './Binding';

export default class KeyBindings {
    private unbindSeekToSubtitle?: () => void;
    private unbindToggleSubtitles?: () => void;
    private unbindToggleSubtitleTrackInVideo?: () => void;
    private unbindToggleSubtitleTrackInList?: () => void;
    private unbindOffsetToSubtitle?: () => void;
    private unbindAdjustOffset?: () => void;

    private bound: boolean;

    constructor() {
        this.bound = false;
    }

    bind(context: Binding) {
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

        // We don't stop immediate propagation for "toggle subtitles" because we have knowledge that
        // the toggle-subtitle binding is a subset of the toggle-subtitle-track binding.
        // Might be worth rethinking the KeyBindings API so we don't need this extra knowledge for things to work.
        this.unbindToggleSubtitles = CommonKeyBindings.bindToggleSubtitles(
            (event) => {
                const toggleSubtitlesCommand: VideoToExtensionCommand<ToggleSubtitlesMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggle-subtitles',
                    },
                    src: context.video.src,
                };

                chrome.runtime.sendMessage(toggleSubtitlesCommand);
            },
            () => {},
            () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
            true
        );

        this.unbindToggleSubtitleTrackInVideo = CommonKeyBindings.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleContainer.disabledSubtitleTracks[track] =
                    !context.subtitleContainer.disabledSubtitleTracks[track];
            },
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
            },
            () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
            true
        );

        this.unbindToggleSubtitleTrackInList = CommonKeyBindings.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const command: VideoToExtensionCommand<ToggleSubtitlesInListMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggleSubtitleTrackInList',
                        track: track,
                    },
                    src: context.video.src,
                };
                chrome.runtime.sendMessage(command);
            },
            (event) => {},
            () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
            true
        );

        this.unbindOffsetToSubtitle = CommonKeyBindings.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopImmediatePropagation();
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
                event.stopImmediatePropagation();
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
            this.unbindSeekToSubtitle = undefined;
        }

        if (this.unbindToggleSubtitles) {
            this.unbindToggleSubtitles();
            this.unbindToggleSubtitles = undefined;
        }

        if (this.unbindToggleSubtitleTrackInVideo) {
            this.unbindToggleSubtitleTrackInVideo();
            this.unbindToggleSubtitleTrackInVideo = undefined;
        }

        if (this.unbindToggleSubtitleTrackInList) {
            this.unbindToggleSubtitleTrackInList();
            this.unbindToggleSubtitleTrackInList = undefined;
        }

        if (this.unbindOffsetToSubtitle) {
            this.unbindOffsetToSubtitle();
            this.unbindOffsetToSubtitle = undefined;
        }

        if (this.unbindAdjustOffset) {
            this.unbindAdjustOffset();
            this.unbindAdjustOffset = undefined;
        }

        this.bound = false;
    }
}
