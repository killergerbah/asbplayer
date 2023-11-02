import {
    KeyBindSet,
    PlayMode,
    ToggleSubtitlesInListFromVideoMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { DefaultKeyBinder } from '@project/common/key-binder';
import Binding from './binding';
import { OpenSidePanelMessage } from '../ui/components/PopupUi';

type Unbinder = (() => void) | false;

export default class KeyBindings {
    private _keyBinder: DefaultKeyBinder | undefined;

    private _unbindPlay: Unbinder = false;
    private _unbindAutoPause: Unbinder = false;
    private _unbindCondensedPlayback: Unbinder = false;
    private _unbindSeekToSubtitle: Unbinder = false;
    private _unbindSeekToBeginningOfCurrentSubtitle?: Unbinder = false;
    private _unbindSeekBackwardOrForward?: Unbinder = false;
    private _unbindToggleSubtitles: Unbinder = false;
    private _unbindToggleSubtitleTrackInVideo?: Unbinder = false;
    private _unbindToggleSubtitleTrackInList?: Unbinder = false;
    private _unbindOffsetToSubtitle?: Unbinder = false;
    private _unbindAdjustOffset?: Unbinder = false;
    private _unbindResetOffset?: Unbinder = false;
    private _unbindAdjustPlaybackRate?: Unbinder = false;
    private _unbindOpenSidePanel?: Unbinder = false;

    private _bound: boolean;

    constructor() {
        this._bound = false;
    }

    setKeyBindSet(context: Binding, keyBindSet: KeyBindSet) {
        this._keyBinder = new DefaultKeyBinder(keyBindSet);
        this.unbind();
        this.bind(context);
    }

    bind(context: Binding) {
        if (!this._keyBinder) {
            return;
        }

        if (this._bound) {
            this.unbind();
        }

        this._unbindPlay = this._keyBinder.bindPlay(
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

        this._unbindAutoPause = this._keyBinder.bindAutoPause(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                context.playMode = context.playMode === PlayMode.autoPause ? PlayMode.normal : PlayMode.autoPause;
            },
            () => !context.subtitleController.subtitles || context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindCondensedPlayback = this._keyBinder.bindCondensedPlayback(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                context.playMode = context.playMode === PlayMode.condensed ? PlayMode.normal : PlayMode.condensed;
            },
            () => !context.subtitleController.subtitles || context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindSeekToSubtitle = this._keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.seek(subtitle.start / 1000);
            },
            () => false,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindSeekBackwardOrForward = this._keyBinder.bindSeekBackwardOrForward(
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

        this._unbindSeekToBeginningOfCurrentSubtitle = this._keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.seek(subtitle.start / 1000);
            },
            () => false,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindToggleSubtitles = this._keyBinder.bindToggleSubtitles(
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
            () => !context.subtitleController.subtitles || context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindToggleSubtitleTrackInVideo = this._keyBinder.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.disabledSubtitleTracks[track] =
                    !context.subtitleController.disabledSubtitleTracks[track];
            },
            () => !context.subtitleController.subtitles || context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindToggleSubtitleTrackInList = this._keyBinder.bindToggleSubtitleTrackInList(
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
            () => !context.subtitleController.subtitles || context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindOffsetToSubtitle = this._keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(offset);
            },
            () => false,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindAdjustOffset = this._keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(offset);
            },
            () => false,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindResetOffset = this._keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(0);
            },
            () => false,
            true
        );

        this._unbindAdjustPlaybackRate = this._keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                if (increase) {
                    context.video.playbackRate = Math.min(5, Math.round(context.video.playbackRate * 10 + 1) / 10);
                } else {
                    context.video.playbackRate = Math.max(0.1, Math.round(context.video.playbackRate * 10 - 1) / 10);
                }
            },
            () => false,
            true
        );

        this._unbindOpenSidePanel = this._keyBinder.bindOpenSidePanel(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const command: VideoToExtensionCommand<OpenSidePanelMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'open-side-panel',
                    },
                    src: context.video.src,
                };
                chrome.runtime.sendMessage(command);
            },
            () => false,
            true
        )

        this._bound = true;
    }

    unbind() {
        if (this._unbindPlay) {
            this._unbindPlay();
            this._unbindPlay = false;
        }

        if (this._unbindAutoPause) {
            this._unbindAutoPause();
            this._unbindAutoPause = false;
        }

        if (this._unbindCondensedPlayback) {
            this._unbindCondensedPlayback();
            this._unbindCondensedPlayback = false;
        }

        if (this._unbindSeekToSubtitle) {
            this._unbindSeekToSubtitle();
            this._unbindSeekToSubtitle = false;
        }

        if (this._unbindSeekToBeginningOfCurrentSubtitle) {
            this._unbindSeekToBeginningOfCurrentSubtitle();
            this._unbindSeekToBeginningOfCurrentSubtitle = false;
        }

        if (this._unbindSeekBackwardOrForward) {
            this._unbindSeekBackwardOrForward();
            this._unbindSeekBackwardOrForward = false;
        }

        if (this._unbindToggleSubtitles) {
            this._unbindToggleSubtitles();
            this._unbindToggleSubtitles = false;
        }

        if (this._unbindToggleSubtitleTrackInVideo) {
            this._unbindToggleSubtitleTrackInVideo();
            this._unbindToggleSubtitleTrackInVideo = false;
        }

        if (this._unbindToggleSubtitleTrackInList) {
            this._unbindToggleSubtitleTrackInList();
            this._unbindToggleSubtitleTrackInList = false;
        }

        if (this._unbindOffsetToSubtitle) {
            this._unbindOffsetToSubtitle();
            this._unbindOffsetToSubtitle = false;
        }

        if (this._unbindAdjustOffset) {
            this._unbindAdjustOffset();
            this._unbindAdjustOffset = false;
        }

        if (this._unbindResetOffset) {
            this._unbindResetOffset();
            this._unbindResetOffset = false;
        }

        if (this._unbindAdjustPlaybackRate) {
            this._unbindAdjustPlaybackRate();
            this._unbindAdjustPlaybackRate = false;
        }

        if (this._unbindOpenSidePanel) {
            this._unbindOpenSidePanel();
            this._unbindOpenSidePanel = false;
        }

        this._bound = false;
    }
}
