import {
    AckMessage,
    AnkiUiSavedState,
    AudioBase64Message,
    AutoPausePreference,
    CardExportedMessage,
    CardSavedMessage,
    CardUpdatedMessage,
    CopySubtitleMessage,
    cropAndResize,
    CurrentTimeFromVideoMessage,
    CurrentTimeToVideoMessage,
    ExtensionSyncMessage,
    ImageCaptureParams,
    NotificationDialogMessage,
    NotifyErrorMessage,
    OffsetToVideoMessage,
    PauseFromVideoMessage,
    PlaybackRateFromVideoMessage,
    PlaybackRateToVideoMessage,
    PlayFromVideoMessage,
    PlayMode,
    PostMineAction,
    PostMinePlayback,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    RecordMediaAndForwardSubtitleMessage,
    RequestingActiveTabPermsisionMessage,
    RerecordMediaMessage,
    ScreenshotTakenMessage,
    ShowAnkiUiAfterRerecordMessage,
    ShowAnkiUiMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StartRecordingMediaMessage,
    StopRecordingAudioMessage,
    StopRecordingMediaMessage,
    SubtitleModel,
    SubtitlesToVideoMessage,
    TakeScreenshotFromExtensionMessage,
    VideoDisappearedMessage,
    VideoHeartbeatMessage,
    VideoToExtensionCommand,
} from '@project/common';
import Mp3Encoder from '@project/common/audio-clip/mp3-encoder';
import { adjacentSubtitle } from '@project/common/key-binder';
import { extractAnkiSettings, SettingsProvider, SubtitleListPreference } from '@project/common/settings';
import { SubtitleSlice } from '@project/common/subtitle-collection';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { extractText, seekWithNudge, sourceString, surroundingSubtitlesAroundInterval } from '@project/common/util';
import AnkiUiController from '../controllers/anki-ui-controller';
import ControlsController from '../controllers/controls-controller';
import DragController from '../controllers/drag-controller';
import { MobileGestureController } from '../controllers/mobile-gesture-controller';
import { MobileVideoOverlayController } from '../controllers/mobile-video-overlay-controller';
import NotificationController from '../controllers/notification-controller';
import SubtitleController, { SubtitleModelWithIndex } from '../controllers/subtitle-controller';
import VideoDataSyncController from '../controllers/video-data-sync-controller';
import AudioRecorder from './audio-recorder';
import { bufferToBase64 } from './base64';
import { isMobile } from './device-detection';
import { OffsetAnchor } from './element-overlay';
import { ExtensionSettingsStorage } from './extension-settings-storage';
import { i18nInit } from './i18n';
import KeyBindings from './key-bindings';
import { shouldShowUpdateAlert } from './update-alert';

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = (e as CustomEvent).detail;
});
document.dispatchEvent(new CustomEvent('asbplayer-query-netflix'));

enum RecordingState {
    requested,
    started,
    notRecording,
}

export default class Binding {
    subscribed: boolean = false;

    ankiUiSavedState?: AnkiUiSavedState;
    alwaysPlayOnSubtitleRepeat: boolean;

    private _synced: boolean;
    private _syncedTimestamp?: number;

    recordingState: RecordingState = RecordingState.notRecording;
    wasPlayingBeforeRecordingMedia?: boolean;
    postMinePlayback: PostMinePlayback = PostMinePlayback.remember;
    private recordingMediaStartedTimestamp?: number;
    private recordingMediaWithScreenshot: boolean;

    private _playMode: PlayMode = PlayMode.normal;
    private _speedChangeStep = 0.1;

    readonly video: HTMLMediaElement;
    readonly subSyncAvailable: boolean;
    readonly subtitleController: SubtitleController;
    readonly videoDataSyncController: VideoDataSyncController;
    readonly controlsController: ControlsController;
    readonly dragController: DragController;
    readonly ankiUiController: AnkiUiController;
    readonly notificationController: NotificationController;
    readonly mobileVideoOverlayController: MobileVideoOverlayController;
    readonly mobileGestureController: MobileGestureController;
    readonly keyBindings: KeyBindings;
    readonly settings: SettingsProvider;
    private readonly _audioRecorder = new AudioRecorder();

    private copyToClipboardOnMine: boolean;
    private takeScreenshot: boolean;
    private cleanScreenshot: boolean;
    private audioPaddingStart: number;
    private audioPaddingEnd: number;
    private maxImageWidth: number;
    private maxImageHeight: number;
    private autoPausePreference: AutoPausePreference;
    private condensedPlaybackMinimumSkipIntervalMs = 1000;
    private fastForwardPlaybackMinimumGapMs = 600;
    private fastForwardModePlaybackRate = 2.7;
    private imageDelay = 0;
    recordMedia: boolean;

    private playListener?: EventListener;
    private pauseListener?: EventListener;
    private seekedListener?: EventListener;
    private playbackRateListener?: EventListener;
    private videoChangeListener?: EventListener;
    private listener?: (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private heartbeatInterval?: NodeJS.Timeout;

    private readonly frameId?: string;

    constructor(video: HTMLMediaElement, syncAvailable: boolean, frameId?: string) {
        this.video = video;
        this.subSyncAvailable = syncAvailable;
        this.settings = new SettingsProvider(new ExtensionSettingsStorage());
        this.subtitleController = new SubtitleController(video, this.settings);
        this.videoDataSyncController = new VideoDataSyncController(this, this.settings);
        this.controlsController = new ControlsController(video);
        this.dragController = new DragController(video);
        this.keyBindings = new KeyBindings();
        this.ankiUiController = new AnkiUiController();
        this.notificationController = new NotificationController(this);
        this.mobileVideoOverlayController = new MobileVideoOverlayController(this, OffsetAnchor.top);
        this.subtitleController.onOffsetChange = () => this.mobileVideoOverlayController.updateModel();
        this.mobileGestureController = new MobileGestureController(this);
        this.recordMedia = true;
        this.takeScreenshot = true;
        this.cleanScreenshot = true;
        this.audioPaddingStart = 0;
        this.audioPaddingEnd = 500;
        this.maxImageWidth = 0;
        this.maxImageHeight = 0;
        this.autoPausePreference = AutoPausePreference.atEnd;
        this.copyToClipboardOnMine = false;
        this.alwaysPlayOnSubtitleRepeat = true;
        this.postMinePlayback = PostMinePlayback.remember;
        this._synced = false;
        this.recordingMediaWithScreenshot = false;
        this.frameId = frameId;
    }

    get recordingMedia() {
        return this.recordingState !== RecordingState.notRecording;
    }

    get synced() {
        return this._synced;
    }

    get url() {
        return window.location !== window.parent.location ? document.referrer : document.location.href;
    }

    get speedChangeStep() {
        return this._speedChangeStep;
    }

    get playMode() {
        return this._playMode;
    }

    set playMode(newPlayMode: PlayMode) {
        const disableCondensedMode = () => {
            this.subtitleController.onNextToShow = undefined;
            this.subtitleController.notification('info.disabledCondensedPlayback');
        };
        const disableFastForwardMode = () => {
            this.subtitleController.onSlice = undefined;
            this.video.playbackRate = 1;
            this.subtitleController.notification('info.disabledFastForwardPlayback');
        };

        switch (newPlayMode) {
            case PlayMode.autoPause:
                this.subtitleController.autoPauseContext.onStartedShowing = () => {
                    if (this.recordingMedia || this.autoPausePreference !== AutoPausePreference.atStart) {
                        return;
                    }

                    this.pause();
                };
                this.subtitleController.autoPauseContext.onWillStopShowing = () => {
                    if (this.recordingMedia || this.autoPausePreference !== AutoPausePreference.atEnd) {
                        return;
                    }

                    this.pause();
                };
                this.subtitleController.notification('info.enabledAutoPause');
                break;
            case PlayMode.condensed:
                if (this._playMode === PlayMode.fastForward) {
                    disableFastForwardMode();
                }
                let seeking = false;
                this.subtitleController.onNextToShow = async (subtitle) => {
                    try {
                        if (
                            this.recordingMedia ||
                            seeking ||
                            this.video.paused ||
                            subtitle.start - this.video.currentTime * 1000 <=
                                this.condensedPlaybackMinimumSkipIntervalMs
                        ) {
                            return;
                        }

                        seeking = true;
                        this.seek(subtitle.start / 1000);
                        await this.play();
                        seeking = false;
                    } finally {
                        seeking = false;
                    }
                };
                this.subtitleController.notification('info.enabledCondensedPlayback');
                break;
            case PlayMode.fastForward:
                if (this._playMode === PlayMode.condensed) {
                    disableCondensedMode();
                }
                this.subtitleController.onSlice = async (slice: SubtitleSlice<SubtitleModelWithIndex>) => {
                    const subtitlesAreSufficientlyOffsetFromNow = (subtitleEdgeTime: number | undefined) => {
                        return (
                            subtitleEdgeTime &&
                            Math.abs(subtitleEdgeTime - this.video.currentTime * 1000) >
                                this.fastForwardPlaybackMinimumGapMs
                        );
                    };
                    if (
                        slice.showing.length === 0 &&
                        // Find latest ending subtitle among the shown last ones
                        subtitlesAreSufficientlyOffsetFromNow(
                            Math.max.apply(
                                undefined,
                                (slice?.lastShown || []).map((e) => e.end)
                            )
                        ) &&
                        // Find earliest starting subtitle among the next ones to be shown
                        subtitlesAreSufficientlyOffsetFromNow(
                            Math.min.apply(
                                undefined,
                                (slice?.nextToShow || []).map((e) => e.start)
                            )
                        )
                    ) {
                        this.video.playbackRate = this.fastForwardModePlaybackRate;
                    } else {
                        this.video.playbackRate = 1;
                    }
                };
                this.subtitleController.notification('info.enabledFastForwardPlayback');
                break;
            case PlayMode.repeat:
                const [currentSubtitle] = this.subtitleController.currentSubtitle();
                if (currentSubtitle) {
                    this.subtitleController.autoPauseContext.onWillStopShowing = () => {
                        this.seek(currentSubtitle.start / 1000);
                    };
                    this.subtitleController.notification('info.enabledRepeatPlayback');
                }
                break;
            case PlayMode.normal:
                if (this._playMode === PlayMode.repeat) {
                    this.subtitleController.autoPauseContext.onWillStopShowing = undefined;
                    this.subtitleController.notification('info.disabledRepeatPlayback');
                } else if (this._playMode === PlayMode.autoPause) {
                    this.subtitleController.autoPauseContext.onStartedShowing = undefined;
                    this.subtitleController.autoPauseContext.onWillStopShowing = undefined;
                    this.subtitleController.notification('info.disabledAutoPause');
                } else if (this._playMode === PlayMode.condensed) {
                    disableCondensedMode();
                } else if (this._playMode === PlayMode.fastForward) {
                    disableFastForwardMode();
                }
                break;
            default:
                console.error('Unknown play mode ' + newPlayMode);
        }

        this._playMode = newPlayMode;
    }

    subtitleFileName(track: number = 0) {
        return this.subtitleController.subtitleFileNames?.[track] ?? '';
    }

    private get _imageCaptureParams(): ImageCaptureParams {
        const rect = this.video.getBoundingClientRect();

        return {
            maxWidth: this.maxImageWidth,
            maxHeight: this.maxImageHeight,
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            },
            frameId: this.frameId,
        };
    }

    bind() {
        let bound = false;

        if (this.video.readyState === 4) {
            this._bind();
            bound = true;
        } else {
            this.video.addEventListener('canplay', (event) => {
                if (!bound) {
                    this._bind();
                    bound = true;
                }

                const command: VideoToExtensionCommand<ReadyStateFromVideoMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'readyState',
                        value: 4,
                    },
                    src: this.video.src,
                };

                chrome.runtime.sendMessage(command);
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings().then(() => {
            this.videoDataSyncController.requestSubtitles();
        });
        this.subtitleController.bind();
        this.dragController.bind(this);
        this.mobileGestureController.bind();

        const seek = (forward: boolean) => {
            const subtitle = adjacentSubtitle(
                forward,
                this.video.currentTime * 1000,
                this.subtitleController.subtitles
            );

            if (subtitle !== null) {
                this.seek(subtitle.start / 1000);
            }
        };

        this.mobileGestureController.onSwipeLeft = () => seek(false);
        this.mobileGestureController.onSwipeRight = () => seek(true);
    }

    _notifyReady() {
        const command: VideoToExtensionCommand<ReadyFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.video.duration,
                currentTime: this.video.currentTime,
                paused: this.video.paused,
                audioTracks: undefined,
                selectedAudioTrack: undefined,
                playbackRate: this.video.playbackRate,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    _subscribe() {
        this.playListener = (event) => {
            const command: VideoToExtensionCommand<PlayFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        };

        this.pauseListener = (event) => {
            const command: VideoToExtensionCommand<PauseFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        };

        this.seekedListener = (event) => {
            const currentTimeCommand: VideoToExtensionCommand<CurrentTimeFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false,
                },
                src: this.video.src,
            };
            const readyStateCommand: VideoToExtensionCommand<ReadyStateFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'readyState',
                    value: this.video.readyState,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(currentTimeCommand);
            chrome.runtime.sendMessage(readyStateCommand);

            this.subtitleController.autoPauseContext.clear();
        };

        this.playbackRateListener = (event) => {
            const command: VideoToExtensionCommand<PlaybackRateFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'playbackRate',
                    value: this.video.playbackRate,
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);

            if (this._synced && this._playMode !== PlayMode.fastForward) {
                this.subtitleController.notification('info.playbackRate', {
                    rate: this.video.playbackRate.toFixed(1),
                });
            }
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);
        this.video.addEventListener('ratechange', this.playbackRateListener);

        if (this.subSyncAvailable) {
            this.videoChangeListener = () => {
                this.videoDataSyncController.requestSubtitles();
                this.mobileVideoOverlayController.disposeOverlay();
            };
            this.video.addEventListener('loadedmetadata', this.videoChangeListener);
        }

        this.heartbeatInterval = setInterval(() => {
            const command: VideoToExtensionCommand<VideoHeartbeatMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                    subscribed: this.subscribed,
                    synced: this._synced,
                    syncedTimestamp: this._syncedTimestamp,
                    loadedSubtitles: this.subtitleController.subtitles.length > 0,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            this.heartbeatInterval && clearInterval(this.heartbeatInterval);
        });

        this.listener = (
            request: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (request.sender === 'asbplayer-extension-to-video' && request.src === this.video.src) {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this.play();
                        break;
                    case 'pause':
                        this.pause();
                        break;
                    case 'currentTime':
                        const currentTimeMessage = request.message as CurrentTimeToVideoMessage;
                        this.seek(currentTimeMessage.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        const subtitlesMessage = request.message as SubtitlesToVideoMessage;
                        const subtitles: SubtitleModel[] = subtitlesMessage.value;
                        this._updateSubtitles(
                            subtitles.map((s, index) => ({ ...s, index })),
                            subtitlesMessage.names || [subtitlesMessage.name]
                        );
                        break;
                    case 'request-subtitles':
                        sendResponse({
                            subtitles: this.subtitleController.subtitles,
                            subtitleFileNames: this.subtitleController.subtitleFileNames ?? [],
                        });
                        break;
                    case 'offset':
                        const offsetMessage = request.message as OffsetToVideoMessage;
                        this.subtitleController.offset(offsetMessage.value, true);
                        break;
                    case 'playbackRate':
                        const playbackRateMessage = request.message as PlaybackRateToVideoMessage;
                        this.video.playbackRate = playbackRateMessage.value;
                        break;
                    case 'subtitleSettings':
                        // ignore
                        break;
                    case 'ankiSettings':
                        // ignore
                        break;
                    case 'miscSettings':
                        // ignore
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        const copySubtitleMessage = request.message as CopySubtitleMessage;

                        if (this._synced) {
                            if (
                                copySubtitleMessage.subtitle !== undefined &&
                                copySubtitleMessage.surroundingSubtitles !== undefined
                            ) {
                                this._copySubtitle(copySubtitleMessage);
                            } else if (this.subtitleController.subtitles.length > 0) {
                                const [subtitle, surroundingSubtitles] = this.subtitleController.currentSubtitle();
                                if (subtitle !== null && surroundingSubtitles !== null) {
                                    this._copySubtitle({ ...copySubtitleMessage, subtitle, surroundingSubtitles });
                                }
                            } else {
                                this._toggleRecordingMedia(copySubtitleMessage.postMineAction);
                            }

                            this.mobileVideoOverlayController.updateModel();
                        }
                        break;
                    case 'toggle-recording':
                        if (this._synced) {
                            this._toggleRecordingMedia(PostMineAction.showAnkiDialog);
                            this.mobileVideoOverlayController.updateModel();
                        }
                        break;
                    case 'card-updated':
                    case 'card-exported':
                    case 'card-saved':
                        const cardMessage = request.message as
                            | CardUpdatedMessage
                            | CardExportedMessage
                            | CardSavedMessage;
                        let locKey: string;
                        switch (cardMessage.command) {
                            case 'card-updated':
                                locKey = 'info.updatedCard';
                                break;
                            case 'card-exported':
                                locKey = 'info.exportedCard';
                                break;
                            case 'card-saved':
                                locKey = 'info.copiedSubtitle2';
                                break;
                        }
                        this.subtitleController.notification(locKey, { result: request.message.cardName });
                        this.ankiUiSavedState = {
                            ...cardMessage,
                            text: cardMessage.text ?? '',
                            definition: cardMessage.definition ?? '',
                            word: cardMessage.word ?? cardMessage.cardName,
                            source: sourceString(this.subtitleFileName(), cardMessage.subtitle.start),
                            url: cardMessage.url ?? '',
                            customFieldValues: cardMessage.customFieldValues ?? {},
                            timestampInterval: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            initialTimestampInterval: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            lastAppliedTimestampIntervalToText: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            lastAppliedTimestampIntervalToAudio: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            dialogRequestedTimestamp: this.video.currentTime * 1000,
                        };
                        this.mobileVideoOverlayController.updateModel();
                        break;
                    case 'notify-error':
                        const notifyErrorMessage = request.message as NotifyErrorMessage;
                        this.subtitleController.notification('info.error', { message: notifyErrorMessage.message });
                        break;
                    case 'recording-started':
                        this.recordingState = RecordingState.started;
                        break;
                    case 'recording-finished':
                        this.recordingState = RecordingState.notRecording;
                        this.recordingMediaStartedTimestamp = undefined;

                        switch (this.postMinePlayback) {
                            case PostMinePlayback.remember:
                                if (!this.wasPlayingBeforeRecordingMedia) {
                                    this.video.pause();
                                } else if (!this.video.paused) {
                                    this.mobileVideoOverlayController.hide();
                                }
                                break;
                            case PostMinePlayback.play:
                                // already playing, don't need to do anything
                                this.mobileVideoOverlayController.hide();
                                break;
                            case PostMinePlayback.pause:
                                this.video.pause();
                                break;
                        }
                        break;
                    case 'show-anki-ui':
                        const showAnkiUiMessage = request.message as ShowAnkiUiMessage;
                        this.ankiUiController.show(this, showAnkiUiMessage);
                        break;
                    case 'show-anki-ui-after-rerecord':
                        const showAnkiUiAfterRerecordMessage = request.message as ShowAnkiUiAfterRerecordMessage;
                        this.ankiUiController.showAfterRerecord(this, showAnkiUiAfterRerecordMessage.uiState);
                        break;
                    case 'take-screenshot':
                        if (this._synced) {
                            if (this.ankiUiController.showing) {
                                this.ankiUiController.requestRewind(this);
                            } else {
                                this._takeScreenshot();
                            }
                        }
                        break;
                    case 'screenshot-taken':
                        const screenshotTakenMessage = request.message as ScreenshotTakenMessage;
                        this.subtitleController.forceHideSubtitles = false;
                        this.mobileVideoOverlayController.forceHide = false;
                        this.controlsController.show();

                        if (!this.recordingMedia && screenshotTakenMessage.ankiUiState) {
                            this.ankiUiController.showAfterRetakingScreenshot(this, screenshotTakenMessage.ankiUiState);
                        }
                        break;
                    case 'alert':
                        // ignore
                        break;
                    case 'request-active-tab-permission':
                        this.notificationController.onClose = () => {
                            this._notifyRequestingActiveTabPermission(false);
                        };
                        this.notificationController.show(
                            'activeTabPermissionRequest.title',
                            'activeTabPermissionRequest.prompt'
                        );
                        this._notifyRequestingActiveTabPermission(true);
                        break;
                    case 'granted-active-tab-permission':
                        if (this.notificationController.showing) {
                            this.notificationController.show(
                                'activeTabPermissionRequest.grantedTitle',
                                'activeTabPermissionRequest.grantedPrompt'
                            );
                        }
                        break;
                    case 'load-subtitles':
                        this.showVideoDataDialog(false);
                        break;
                    case 'start-recording-audio-with-timeout':
                        const startRecordingAudioWithTimeoutMessage =
                            request.message as StartRecordingAudioWithTimeoutViaCaptureStreamMessage;

                        this._captureStream()
                            .then((stream) =>
                                this._audioRecorder.startWithTimeout(
                                    stream,
                                    startRecordingAudioWithTimeoutMessage.timeout,
                                    () => sendResponse(true)
                                )
                            )
                            .then((audioBase64) =>
                                this._sendAudioBase64(audioBase64, startRecordingAudioWithTimeoutMessage.preferMp3)
                            )
                            .then(() => this._resumeAudioAfterRecording())
                            .catch((e) => {
                                console.error(e instanceof Error ? e.message : String(e));
                                sendResponse(false);
                            });
                        return true;
                    case 'start-recording-audio':
                        this._captureStream()
                            .then((stream) => this._audioRecorder.start(stream))
                            .then(() => sendResponse(true))
                            .then(() => this._resumeAudioAfterRecording())
                            .catch((e) => {
                                console.error(e instanceof Error ? e.message : String(e));
                                sendResponse(false);
                            });
                        return true;
                    case 'stop-recording-audio':
                        const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                        this._audioRecorder
                            .stop()
                            .then((audioBase64) =>
                                this._sendAudioBase64(audioBase64, stopRecordingAudioMessage.preferMp3)
                            );
                        break;
                    case 'notification-dialog':
                        const notificationDialogMessage = request.message as NotificationDialogMessage;
                        this.notificationController.show(
                            notificationDialogMessage.titleLocKey,
                            notificationDialogMessage.messageLocKey
                        );
                        break;
                }

                if ('messageId' in request.message) {
                    const ackCommand: VideoToExtensionCommand<AckMessage> = {
                        sender: 'asbplayer-video',
                        message: {
                            command: 'ack-message',
                            messageId: request.message['messageId'],
                        },
                        src: this.video.src,
                    };
                    chrome.runtime.sendMessage(ackCommand);
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
        this.subscribed = true;
    }

    async _refreshSettings() {
        const currentSettings = await this.settings.getAll();
        this._speedChangeStep = currentSettings.speedChangeStep;
        this.recordMedia = currentSettings.streamingRecordMedia;
        this.takeScreenshot = currentSettings.streamingTakeScreenshot;
        this.cleanScreenshot = currentSettings.streamingTakeScreenshot && currentSettings.streamingCleanScreenshot;
        this.condensedPlaybackMinimumSkipIntervalMs = currentSettings.streamingCondensedPlaybackMinimumSkipIntervalMs;
        this.fastForwardModePlaybackRate = currentSettings.fastForwardModePlaybackRate;
        this.imageDelay = currentSettings.streamingScreenshotDelay;
        this.audioPaddingStart = currentSettings.audioPaddingStart;
        this.audioPaddingEnd = currentSettings.audioPaddingEnd;
        this.maxImageWidth = currentSettings.maxImageWidth;
        this.maxImageHeight = currentSettings.maxImageHeight;
        this.copyToClipboardOnMine = currentSettings.copyToClipboardOnMine;
        this.autoPausePreference = currentSettings.autoPausePreference;
        this.alwaysPlayOnSubtitleRepeat = currentSettings.alwaysPlayOnSubtitleRepeat;

        this.subtitleController.displaySubtitles = currentSettings.streamingDisplaySubtitles;
        this.subtitleController.subtitlePositionOffset = currentSettings.subtitlePositionOffset;
        this.subtitleController.subtitleAlignment = currentSettings.subtitleAlignment;
        this.subtitleController.surroundingSubtitlesCountRadius = currentSettings.surroundingSubtitlesCountRadius;
        this.subtitleController.surroundingSubtitlesTimeRadius = currentSettings.surroundingSubtitlesTimeRadius;
        this.subtitleController.autoCopyCurrentSubtitle = currentSettings.autoCopyCurrentSubtitle;
        this.subtitleController.preCacheDom = currentSettings.preCacheSubtitleDom;
        this.subtitleController.setSubtitleSettings(currentSettings);
        this.subtitleController.refresh();

        this.videoDataSyncController.updateSettings(currentSettings);
        this.ankiUiController.ankiSettings = extractAnkiSettings(currentSettings);
        this.postMinePlayback = currentSettings.postMiningPlaybackState;
        this.keyBindings.setKeyBindSet(this, currentSettings.keyBindSet);

        if (currentSettings.streamingSubsDragAndDrop) {
            this.dragController.bind(this);
        } else {
            this.dragController.unbind();
        }

        if (currentSettings.streamingEnableOverlay) {
            this.mobileVideoOverlayController.offsetAnchor =
                currentSettings.subtitleAlignment === 'bottom' ? OffsetAnchor.top : OffsetAnchor.bottom;
            this.mobileVideoOverlayController.bind();
            this.mobileVideoOverlayController.updateModel();
        } else {
            this.mobileVideoOverlayController.unbind();
        }

        await i18nInit(currentSettings.language);
    }

    unbind() {
        if (this.playListener) {
            this.video.removeEventListener('play', this.playListener);
            this.playListener = undefined;
        }

        if (this.pauseListener) {
            this.video.removeEventListener('pause', this.pauseListener);
            this.pauseListener = undefined;
        }

        if (this.seekedListener) {
            this.video.removeEventListener('seeked', this.seekedListener);
            this.seekedListener = undefined;
        }

        if (this.playbackRateListener) {
            this.video.removeEventListener('ratechange', this.playbackRateListener);
            this.playbackRateListener = undefined;
        }

        if (this.videoChangeListener) {
            this.video.removeEventListener('loadedmetadata', this.videoChangeListener);
            this.videoChangeListener = undefined;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
            this.listener = undefined;
        }

        this.subtitleController.unbind();
        this.dragController.unbind();
        this.keyBindings.unbind();
        this.videoDataSyncController.unbind();
        this.mobileVideoOverlayController.unbind();
        this.mobileGestureController.unbind();
        this.notificationController.unbind();
        this.subscribed = false;

        const command: VideoToExtensionCommand<VideoDisappearedMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'video-disappeared',
            },
            src: this.video.src,
        };
        chrome.runtime.sendMessage(command);
    }

    async _takeScreenshot() {
        if (!this.takeScreenshot) {
            return;
        }

        await this._prepareScreenshot();

        const command: VideoToExtensionCommand<TakeScreenshotFromExtensionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'take-screenshot',
                ankiUiState: this.ankiUiSavedState,
                ...this._imageCaptureParams,
                subtitleFileName: this.subtitleFileName(),
                mediaTimestamp: this.video.currentTime * 1000,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
        this.ankiUiSavedState = undefined;
    }

    async _copySubtitle({
        postMineAction,
        subtitle,
        surroundingSubtitles,
        text,
        definition,
        word,
        customFieldValues,
    }: CopySubtitleMessage) {
        if (!subtitle || !surroundingSubtitles) {
            return;
        }

        if (this.recordMedia && this.recordingMedia) {
            return;
        }

        if (this.copyToClipboardOnMine) {
            navigator.clipboard.writeText(subtitle.text);
        }

        if (this.takeScreenshot) {
            await this._prepareScreenshot();
        }

        if (this.recordMedia) {
            this.recordingState = RecordingState.requested;
            this.wasPlayingBeforeRecordingMedia = !this.video.paused;
            this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
            this.recordingMediaWithScreenshot = this.takeScreenshot;
            const start = Math.max(0, subtitle.start - this.audioPaddingStart);
            this.seek(start / 1000);
            await this.play();
        }

        if (!text || subtitle.text.includes(text.trim())) {
            text = extractText(subtitle, surroundingSubtitles);
        }

        const command: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'record-media-and-forward-subtitle',
                subtitle: subtitle,
                surroundingSubtitles: surroundingSubtitles,
                record: this.recordMedia,
                screenshot: this.takeScreenshot,
                url: this.url,
                mediaTimestamp: this.video.currentTime * 1000,
                subtitleFileName: this.subtitleFileName(subtitle.track),
                postMineAction: postMineAction,
                audioPaddingStart: this.audioPaddingStart,
                audioPaddingEnd: this.audioPaddingEnd,
                imageDelay: this.imageDelay,
                playbackRate: this.video.playbackRate,
                text,
                definition,
                word,
                customFieldValues,
                ...this._imageCaptureParams,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    async _toggleRecordingMedia(postMineAction: PostMineAction) {
        if (this.recordingState === RecordingState.requested) {
            return;
        }

        if (this.recordingState === RecordingState.started) {
            const currentTimestamp = this.video.currentTime * 1000;
            const command: VideoToExtensionCommand<StopRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'stop-recording-media',
                    postMineAction: postMineAction,
                    startTimestamp: this.recordingMediaStartedTimestamp!,
                    endTimestamp: currentTimestamp,
                    playbackRate: this.video.playbackRate,
                    screenshot: this.recordingMediaWithScreenshot,
                    videoDuration: this.video.duration * 1000,
                    url: this.url,
                    subtitleFileName: this.subtitleFileName(),
                    ...this._imageCaptureParams,
                    ...this._surroundingSubtitlesAroundInterval(this.recordingMediaStartedTimestamp!, currentTimestamp),
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        } else {
            this.ankiUiSavedState = undefined;

            if (this.takeScreenshot) {
                await this._prepareScreenshot();
            }

            const timestamp = this.video.currentTime * 1000;

            if (this.recordMedia) {
                this.recordingState = RecordingState.requested;
                this.wasPlayingBeforeRecordingMedia = !this.video.paused;
                this.recordingMediaStartedTimestamp = timestamp;
                this.recordingMediaWithScreenshot = this.takeScreenshot;

                if (this.video.paused) {
                    await this.play();
                }
            }

            const command: VideoToExtensionCommand<StartRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'start-recording-media',
                    mediaTimestamp: timestamp,
                    record: this.recordMedia,
                    postMineAction: postMineAction,
                    screenshot: this.takeScreenshot,
                    url: this.url,
                    subtitleFileName: this.subtitleFileName(),
                    imageDelay: this.imageDelay,
                    ...this._imageCaptureParams,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }
    }

    private _surroundingSubtitlesAroundInterval(start: number, end: number) {
        return surroundingSubtitlesAroundInterval(
            this.subtitleController.subtitles,
            start,
            end,
            this.ankiUiController.ankiSettings!.surroundingSubtitlesCountRadius,
            this.ankiUiController.ankiSettings!.surroundingSubtitlesTimeRadius
        );
    }

    async _prepareScreenshot() {
        if (this.cleanScreenshot) {
            this.notificationController.hide();
            this.subtitleController.forceHideSubtitles = true;
            this.mobileVideoOverlayController.forceHide = true;
            await this.controlsController.hide();
        }
    }

    async rerecord(start: number, end: number, uiState: AnkiUiSavedState) {
        if (this.recordingMedia) {
            return;
        }

        const noSubtitles = this.subtitleController.subtitles.length === 0;
        const audioPaddingStart = noSubtitles ? 0 : this.audioPaddingStart;
        const audioPaddingEnd = noSubtitles ? 0 : this.audioPaddingEnd;
        this.recordingState = RecordingState.requested;
        this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
        this.seek(Math.max(0, start - audioPaddingStart) / 1000);
        await this.play();

        const command: VideoToExtensionCommand<RerecordMediaMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'rerecord-media',
                duration: end - start,
                uiState: uiState,
                audioPaddingStart: audioPaddingStart,
                audioPaddingEnd: audioPaddingEnd,
                playbackRate: this.video.playbackRate,
                timestamp: start,
                subtitleFileName: this.subtitleFileName(),
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    seek(timestamp: number) {
        if (netflix) {
            document.dispatchEvent(
                new CustomEvent('asbplayer-netflix-seek', {
                    detail: timestamp * 1000,
                })
            );
        } else {
            seekWithNudge(this.video, timestamp);
        }
    }

    async play() {
        if (netflix) {
            await this._playNetflix();
            return;
        }

        try {
            await this.video.play();
        } catch (ex) {
            // Ignore exception

            if (this.video.readyState !== 4) {
                // Deal with Amazon Prime player pausing in the middle of play, without loss of generality
                return new Promise((resolve, reject) => {
                    const listener = async (evt: Event) => {
                        let retries = 3;

                        for (let i = 0; i < retries; ++i) {
                            try {
                                await this.video.play();
                                break;
                            } catch (ex2) {
                                console.error(ex2);
                            }
                        }

                        resolve(undefined);
                        this.video.removeEventListener('canplay', listener);
                    };

                    this.video.addEventListener('canplay', listener);
                });
            }
        }
    }

    _playNetflix() {
        return new Promise((resolve, reject) => {
            const listener = async (evt: Event) => {
                this.video.removeEventListener('play', listener);
                this.video.removeEventListener('playing', listener);
                resolve(undefined);
            };

            this.video.addEventListener('play', listener);
            this.video.addEventListener('playing', listener);
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-play'));
        });
    }

    pause() {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-pause'));
            return;
        }

        this.video.pause();
    }

    bindVideoSelect(doneListener: () => void) {
        this.videoDataSyncController.bindVideoSelect(doneListener);
    }

    unbindVideoSelect() {
        this.videoDataSyncController.unbindVideoSelect();
    }

    showVideoDataDialog(openedFromMiningCommand: boolean) {
        this.videoDataSyncController.show({ userRequested: true, openedFromMiningCommand });
    }

    async cropAndResize(tabImageDataUrl: string): Promise<string> {
        const rect = this.video.getBoundingClientRect();
        const maxWidth = this.maxImageWidth;
        const maxHeight = this.maxImageHeight;
        return await cropAndResize(maxWidth, maxHeight, rect, tabImageDataUrl);
    }

    async loadSubtitles(files: File[], flatten: boolean) {
        const {
            streamingSubtitleListPreference,
            subtitleRegexFilter,
            subtitleRegexFilterTextReplacement,
            rememberSubtitleOffset,
            lastSubtitleOffset,
        } = await this.settings.get([
            'streamingSubtitleListPreference',
            'subtitleRegexFilter',
            'subtitleRegexFilterTextReplacement',
            'rememberSubtitleOffset',
            'lastSubtitleOffset',
        ]);
        switch (streamingSubtitleListPreference) {
            case SubtitleListPreference.noSubtitleList:
                const reader = new SubtitleReader({
                    regexFilter: subtitleRegexFilter,
                    regexFilterTextReplacement: subtitleRegexFilterTextReplacement,
                    pgsWorkerFactory: async () => {
                        const code = await (await fetch(chrome.runtime.getURL('./pgs-parser-worker.js'))).text();
                        const blob = new Blob([code], { type: 'application/javascript' });
                        return new Worker(URL.createObjectURL(blob));
                    },
                });
                const offset = rememberSubtitleOffset ? lastSubtitleOffset : 0;
                const subtitles = await reader.subtitles(files, flatten);
                this._updateSubtitles(
                    subtitles.map((s, index) => ({
                        start: s.start + offset,
                        end: s.end + offset,
                        text: s.text,
                        textImage: s.textImage,
                        track: s.track,
                        index,
                        originalStart: s.start,
                        originalEnd: s.end,
                    })),
                    files.map((f) => f.name)
                );
                break;
            case SubtitleListPreference.app:
                const syncMessage: VideoToExtensionCommand<ExtensionSyncMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'sync',
                        subtitles: await Promise.all(
                            files.map(async (f) => {
                                const base64 = await bufferToBase64(await f.arrayBuffer());

                                return {
                                    type: "file",
                                    name: f.name,
                                    base64: base64,
                                };
                            })
                        ),
                    },
                    src: this.video.src,
                };
                chrome.runtime.sendMessage(syncMessage);
                break;
        }
    }

    private _updateSubtitles(subtitles: SubtitleModelWithIndex[], subtitleFileNames: string[]) {
        this.subtitleController.subtitles = subtitles;
        this.subtitleController.subtitleFileNames = subtitleFileNames;
        this.subtitleController.cacheHtml();

        if (this._playMode !== PlayMode.normal && (!subtitles || subtitles.length === 0)) {
            this.playMode = PlayMode.normal;
        }

        let nonEmptyTrackIndex: number[] = [];
        for (let i = 0; i < subtitles.length; i++) {
            if (!nonEmptyTrackIndex.includes(subtitles[i].track)) {
                nonEmptyTrackIndex.push(subtitles[i].track);
            }
        }
        this.subtitleController.showLoadedMessage(nonEmptyTrackIndex);
        this.videoDataSyncController.unbindVideoSelect();
        this.ankiUiSavedState = undefined;
        this._synced = true;
        this._syncedTimestamp = Date.now();

        if (this.video.paused) {
            this.mobileVideoOverlayController.show();
        }

        this.mobileVideoOverlayController.updateModel();

        if (!isMobile && subtitles.length > 0) {
            this.settings
                .get(['streamingDisplaySubtitles', 'keyBindSet'])
                .then(({ streamingDisplaySubtitles, keyBindSet }) => {
                    if (!streamingDisplaySubtitles && keyBindSet.toggleSubtitles.keys) {
                        this.subtitleController.notification('info.toggleSubtitlesShortcut', {
                            keys: keyBindSet.toggleSubtitles.keys,
                        });
                    }
                });
        }

        shouldShowUpdateAlert().then((shouldShowUpdateAlert) => {
            if (shouldShowUpdateAlert) {
                this.notificationController.updateAlert(chrome.runtime.getManifest().version);
            }
        });
    }

    private _captureStream(): Promise<MediaStream> {
        return new Promise((resolve, reject) => {
            try {
                let stream: MediaStream | undefined;

                if (typeof (this.video as any).captureStream === 'function') {
                    stream = (this.video as any).captureStream();
                }

                if (typeof (this.video as any).mozCaptureStreamUntilEnded === 'function') {
                    stream = (this.video as any).mozCaptureStreamUntilEnded();
                }

                if (stream === undefined) {
                    reject(new Error('Unable to capture stream from audio'));
                    return;
                }

                const audioStream = new MediaStream();

                for (const track of stream.getVideoTracks()) {
                    track.stop();
                }

                for (const track of stream.getAudioTracks()) {
                    if (track.enabled) {
                        audioStream.addTrack(track);
                    }
                }

                resolve(audioStream);
            } catch (e) {
                reject(e);
            }
        });
    }

    private async _resumeAudioAfterRecording() {
        // On Firefox the audio is muted once audio recording is stopped.
        // Below is a hack to resume the audio.
        const stream = await this._captureStream();
        const output = new AudioContext();
        const source = output.createMediaStreamSource(stream);
        source.connect(output.destination);
    }

    private async _sendAudioBase64(base64: string, preferMp3: boolean) {
        if (preferMp3) {
            const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
            const mp3Blob = await Mp3Encoder.encode(blob, async () => {
                const code = await (await fetch(chrome.runtime.getURL('./mp3-encoder-worker.js'))).text();
                const blob = new Blob([code], { type: 'application/javascript' });
                return new Worker(URL.createObjectURL(blob));
            });
            base64 = bufferToBase64(await mp3Blob.arrayBuffer());
        }

        const command: VideoToExtensionCommand<AudioBase64Message> = {
            sender: 'asbplayer-video',
            message: {
                command: 'audio-base64',
                base64: base64,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    private _notifyRequestingActiveTabPermission(requesting: boolean) {
        const command: VideoToExtensionCommand<RequestingActiveTabPermsisionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'requesting-active-tab-permission',
                requesting,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }
}
