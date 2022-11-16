import {
    ExtensionKeyBindingsSettings,
    KeyBindSet,
    PlayMode,
    ToggleSubtitlesInListFromVideoMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { DefaultKeyBinder } from '@project/common/src/KeyBinder';
import Binding from './Binding';

type Unbinder = (() => void) | false;

export default class KeyBindings {
    settings?: ExtensionKeyBindingsSettings;

    private keyBinder: DefaultKeyBinder | undefined;

    private unbindPlay: Unbinder = false;
    private unbindAutoPause: Unbinder = false;
    private unbindCondensedPlayback: Unbinder = false;
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

    set keyBindSet(keyBindSet: KeyBindSet) {
        this.unbind();
        this.keyBinder = new DefaultKeyBinder(keyBindSet);
    }

    bind(context: Binding) {
        if (!this.settings) {
            console.error('Settings are not defined - cannot bind keys');
            return;
        }

        if (!this.keyBinder) {
            // Expected
            return;
        }

        if (this.bound) {
            this.unbind();
        }

        this.unbindPlay =
            this.settings.bindPlay &&
            this.keyBinder.bindPlay(
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
            this.keyBinder.bindAutoPause(
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    context.playMode = context.playMode === PlayMode.autoPause ? PlayMode.normal : PlayMode.autoPause;
                },
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
                true
            );

        this.unbindCondensedPlayback =
            this.settings.bindCondensedPlayback &&
            this.keyBinder.bindCondensedPlayback(
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    context.playMode = context.playMode === PlayMode.condensed ? PlayMode.normal : PlayMode.condensed;
                },
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
                true
            );

        this.unbindSeekToSubtitle =
            this.settings.bindSeekToSubtitle &&
            this.keyBinder.bindSeekToSubtitle(
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
            this.keyBinder.bindSeekBackwardOrForward(
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
            this.keyBinder.bindSeekToBeginningOfCurrentSubtitle(
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

        this.unbindToggleSubtitles =
            this.settings.bindToggleSubtitles &&
            this.keyBinder.bindToggleSubtitles(
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    const toggleSubtitlesCommand: VideoToExtensionCommand<ToggleSubtitlesMessage> = {
                        sender: 'asbplayer-video',
                        message: {
                            command: 'toggle-subtitles',
                        },
                        src: context.video.src,
                    };

                    chrome.runtime.sendMessage(toggleSubtitlesCommand);
                },
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
                true
            );

        this.unbindToggleSubtitleTrackInVideo =
            this.settings.bindToggleSubtitleTrackInVideo &&
            this.keyBinder.bindToggleSubtitleTrackInVideo(
                (event, track) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    context.subtitleContainer.disabledSubtitleTracks[track] =
                        !context.subtitleContainer.disabledSubtitleTracks[track];
                },
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
                true
            );

        this.unbindToggleSubtitleTrackInList =
            this.settings.bindToggleSubtitleTrackInAsbplayer &&
            this.keyBinder.bindToggleSubtitleTrackInList(
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
                () => !context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0,
                true
            );

        this.unbindOffsetToSubtitle =
            this.settings.bindAdjustOffsetToSubtitle &&
            this.keyBinder.bindOffsetToSubtitle(
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
            this.keyBinder.bindAdjustOffset(
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

        if (this.unbindCondensedPlayback) {
            this.unbindCondensedPlayback();
            this.unbindCondensedPlayback = false;
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
