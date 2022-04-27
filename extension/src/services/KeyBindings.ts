import {
    ExtensionKeyBindingsSettings,
    KeyBindings as CommonKeyBindings,
    ToggleSubtitlesInListFromVideoMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import Binding from './Binding';

export default class KeyBindings {
    settings?: ExtensionKeyBindingsSettings;

    private unbindPlay: (() => void) | false = false;
    private unbindSeekToSubtitle: (() => void) | false = false;
    private unbindSeekToBeginningOfCurrentSubtitle?: (() => void) | false = false;
    private unbindSeekBackwardOrForward?: (() => void) | false = false;
    private unbindToggleSubtitles: (() => void) | false = false;
    private unbindToggleSubtitleTrackInVideo?: (() => void) | false = false;
    private unbindToggleSubtitleTrackInList?: (() => void) | false = false;
    private unbindOffsetToSubtitle?: (() => void) | false = false;
    private unbindAdjustOffset?: (() => void) | false = false;

    private bound: boolean;

    constructor() {
        this.bound = false;
    }

    bind(context: Binding) {
        if (!this.settings) {
            console.error('Settings are not defined - cannot bind keys');
            return;
        }

        if (this.bound) {
            this.unbind();
        }

        this.unbindPlay =
            this.settings.bindPlay &&
            CommonKeyBindings.bindPlay(
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (context.video.paused) {
                        context.play();
                    } else {
                        context.pause();
                    }
                },
                () => false,
                true
            );

        this.unbindSeekToSubtitle =
            this.settings.bindSeekToSubtitle &&
            CommonKeyBindings.bindSeekToSubtitle(
                (event, subtitle) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    context.seek(subtitle.start / 1000);
                },
                () => false,
                () => context.video.currentTime * 1000,
                () => context.subtitleContainer.subtitles,
                true
            );

        this.unbindSeekBackwardOrForward =
            this.settings.bindSeekBackwardOrForward &&
            CommonKeyBindings.bindSeekBackwardOrForward(
                (event, forward) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    if (forward) {
                        context.seek(Math.min(context.video.duration, context.video.currentTime + 10));
                    } else {
                        context.seek(Math.max(0, context.video.currentTime - 10));
                    }
                },
                () => false,
                true
            );

        this.unbindSeekToBeginningOfCurrentSubtitle =
            this.settings.bindSeekToBeginningOfCurrentSubtitle &&
            CommonKeyBindings.bindSeekToBeginningOfCurrentSubtitle(
                (event, subtitle) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    context.seek(subtitle.start / 1000);
                },
                () => false,
                () => context.video.currentTime * 1000,
                () => context.subtitleContainer.subtitles,
                true
            );

        this.bound = true;

        // We don't stop immediate propagation for "toggle subtitles" because we have knowledge that
        // the toggle-subtitle binding is a subset of the toggle-subtitle-track binding.
        // Might be worth rethinking the KeyBindings API so we don't need this extra knowledge for things to work.
        this.unbindToggleSubtitles =
            this.settings.bindToggleSubtitles &&
            CommonKeyBindings.bindToggleSubtitles(
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

        this.unbindToggleSubtitleTrackInVideo =
            this.settings.bindToggleSubtitleTrackInVideo &&
            CommonKeyBindings.bindToggleSubtitleTrackInVideo(
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

        this.unbindToggleSubtitleTrackInList =
            this.settings.bindToggleSubtitleTrackInAsbplayer &&
            CommonKeyBindings.bindToggleSubtitleTrackInList(
                (event, track) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    const command: VideoToExtensionCommand<ToggleSubtitlesInListFromVideoMessage> = {
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

        this.unbindOffsetToSubtitle =
            this.settings.bindAdjustOffsetToSubtitle &&
            CommonKeyBindings.bindOffsetToSubtitle(
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

        this.unbindAdjustOffset =
            this.settings.bindAdjustOffset &&
            CommonKeyBindings.bindAdjustOffset(
                (event, offset) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    context.subtitleContainer.offset(offset);
                },
                () => false,
                () => context.subtitleContainer.subtitles,
                true
            );
    }

    unbind() {
        if (this.unbindPlay) {
            this.unbindPlay();
            this.unbindPlay = false;
        }

        if (this.unbindSeekToSubtitle) {
            this.unbindSeekToSubtitle();
            this.unbindSeekToSubtitle = false;
        }

        if (this.unbindSeekToBeginningOfCurrentSubtitle) {
            this.unbindSeekToBeginningOfCurrentSubtitle();
            this.unbindSeekToBeginningOfCurrentSubtitle = false;
        }

        if (this.unbindSeekBackwardOrForward) {
            this.unbindSeekBackwardOrForward();
            this.unbindSeekBackwardOrForward = false;
        }

        if (this.unbindToggleSubtitles) {
            this.unbindToggleSubtitles();
            this.unbindToggleSubtitles = false;
        }

        if (this.unbindToggleSubtitleTrackInVideo) {
            this.unbindToggleSubtitleTrackInVideo();
            this.unbindToggleSubtitleTrackInVideo = false;
        }

        if (this.unbindToggleSubtitleTrackInList) {
            this.unbindToggleSubtitleTrackInList();
            this.unbindToggleSubtitleTrackInList = false;
        }

        if (this.unbindOffsetToSubtitle) {
            this.unbindOffsetToSubtitle();
            this.unbindOffsetToSubtitle = false;
        }

        if (this.unbindAdjustOffset) {
            this.unbindAdjustOffset();
            this.unbindAdjustOffset = false;
        }

        this.bound = false;
    }
}
