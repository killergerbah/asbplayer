import {
    ExtensionKeyBindingsSettings,
    KeyBindings as CommonKeyBindings,
    ToggleSubtitlesInListFromVideoMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import Binding from './Binding';

type Unbinder = (() => void) | false;

export default class KeyBindings {
    settings?: ExtensionKeyBindingsSettings;

    private unbindPlay: Unbinder = false;
    private unbindAutoPause: Unbinder = false;
    private unbindSeekToSubtitle: Unbinder = false;
    private unbindSeekToBeginningOfCurrentSubtitle?: Unbinder = false;
    private unbindSeekBackwardOrForward?: Unbinder = false;
    private unbindToggleSubtitles: Unbinder = false;
    private unbindToggleSubtitleTrackInVideo?: Unbinder = false;
    private unbindToggleSubtitleTrackInList?: Unbinder = false;
    private unbindOffsetToSubtitle?: Unbinder = false;
    private unbindAdjustOffset?: Unbinder = false;

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

        this.unbindAutoPause =
            this.settings.bindAutoPause &&
            CommonKeyBindings.bindAutoPause(
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    context.autoPauseEnabled = !context.autoPauseEnabled;
                },
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
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

        // We don't stop immediate propagation for "toggle subtitles" when "toggle-subtitle-track" is enabled
        // because we have knowledge that the "toggle-subtitle" sequence is a subset of the "toggle-subtitle-track" sequence,
        // and we need the the "toggle-subtitle-track" sequence to receive the key event as well so that it can, for example, cancel itself.
        // Might be worth rethinking the KeyBindings API so we don't need this extra knowledge for things to work.
        this.unbindToggleSubtitles =
            this.settings.bindToggleSubtitles &&
            CommonKeyBindings.bindToggleSubtitles(
                (event) => {
                    if (this.settings && !this.settings.bindToggleSubtitleTrackInAsbplayer) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    }

                    const toggleSubtitlesCommand: VideoToExtensionCommand<ToggleSubtitlesMessage> = {
                        sender: 'asbplayer-video',
                        message: {
                            command: 'toggle-subtitles',
                        },
                        src: context.video.src,
                    };

                    chrome.runtime.sendMessage(toggleSubtitlesCommand);
                },
                (event) => {
                    if (this.settings && !this.settings.bindToggleSubtitleTrackInAsbplayer) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    }
                },
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

        this.bound = true;
    }

    unbind() {
        if (this.unbindPlay) {
            this.unbindPlay();
            this.unbindPlay = false;
        }

        if (this.unbindAutoPause) {
            this.unbindAutoPause();
            this.unbindAutoPause = false;
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
