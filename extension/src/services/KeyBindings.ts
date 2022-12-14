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
import { keyBindSettingsKeys } from './Settings';

type Unbinder = (() => void) | false;

export default class KeyBindings {
    private _settings?: ExtensionKeyBindingsSettings;
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
    private unbindAdjustPlaybackRate?: Unbinder = false;

    private bound: boolean;

    constructor() {
        this.bound = false;
    }

    setSettings(context: Binding, newSettings: ExtensionKeyBindingsSettings) {
        const oldSettings = this._settings;
        this._settings = newSettings;
        if (!oldSettings || this._hasDiff(oldSettings, newSettings)) {
            this.unbind();
            this.bind(context);
        }
    }

    private _hasDiff(a: ExtensionKeyBindingsSettings, b: ExtensionKeyBindingsSettings) {
        for (const key of keyBindSettingsKeys) {
            if (a[key] !== b[key]) {
                return true;
            }
        }

        return false;
    }

    setKeyBindSet(context: Binding, keyBindSet: KeyBindSet) {
        this.keyBinder = new DefaultKeyBinder(keyBindSet);
        this.unbind();
        this.bind(context);
    }

    bind(context: Binding) {
        if (!this._settings) {
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
            this._settings.bindPlay &&
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
            this._settings.bindAutoPause &&
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
            this._settings.bindCondensedPlayback &&
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
            this._settings.bindSeekToSubtitle &&
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
            this._settings.bindSeekBackwardOrForward &&
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
            this._settings.bindSeekToBeginningOfCurrentSubtitle &&
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
            this._settings.bindToggleSubtitles &&
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
            this._settings.bindToggleSubtitleTrackInVideo &&
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
            this._settings.bindToggleSubtitleTrackInAsbplayer &&
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
            this._settings.bindAdjustOffsetToSubtitle &&
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
            this._settings.bindAdjustOffset &&
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

        this.unbindAdjustPlaybackRate =
            this._settings.bindAdjustPlaybackRate &&
            this.keyBinder.bindAdjustPlaybackRate(
                (event, increase) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    if (increase) {
                        context.video.playbackRate = Math.min(5, Math.round(context.video.playbackRate * 10 + 1) / 10);
                    } else {
                        context.video.playbackRate = Math.max(
                            0.1,
                            Math.round(context.video.playbackRate * 10 - 1) / 10
                        );
                    }
                },
                () => false,
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

        if (this.unbindAdjustPlaybackRate) {
            this.unbindAdjustPlaybackRate();
            this.unbindAdjustPlaybackRate = false;
        }

        this.bound = false;
    }
}
