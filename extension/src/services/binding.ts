import {
    AckMessage,
    AnkiUiSavedState,
    AutoPausePreference,
    CardUpdatedMessage,
    CopySubtitleMessage,
    cropAndResize,
    CurrentTimeFromVideoMessage,
    CurrentTimeToVideoMessage,
    ExtensionSyncMessage,
    extractAnkiSettings,
    ImageCaptureParams,
    OffsetToVideoMessage,
    PauseFromVideoMessage,
    PlaybackRateFromVideoMessage,
    PlaybackRateToVideoMessage,
    PlayFromVideoMessage,
    PlayMode,
    PostMineAction,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    RecordMediaAndForwardSubtitleMessage,
    RerecordMediaMessage,
    ScreenshotTakenMessage,
    SettingsProvider,
    ShowAnkiUiAfterRerecordMessage,
    ShowAnkiUiMessage,
    sourceString,
    StartRecordingMediaMessage,
    StopRecordingMediaMessage,
    SubtitleListPreference,
    SubtitleModel,
    SubtitlesToVideoMessage,
    surroundingSubtitlesAroundInterval,
    TakeScreenshotFromExtensionMessage,
    VideoDisappearedMessage,
    VideoHeartbeatMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { SubtitleReader } from '@project/common/subtitle-reader';
import AnkiUiController from '../controllers/anki-ui-controller';
import ControlsController from '../controllers/controls-controller';
import DragController from '../controllers/drag-controller';
import KeyBindings from './key-bindings';
import SubtitleController, { SubtitleModelWithIndex } from '../controllers/subtitle-controller';
import VideoDataSyncController from '../controllers/video-data-sync-controller';
import { i18nInit } from './i18n';
import { ExtensionSettingsStorage } from './extension-settings-storage';
import { bufferToBase64 } from './base64';
import ActiveTabPermissionRequestController from '../controllers/active-tab-permission-request-controller';

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = (e as CustomEvent).detail;
});
document.dispatchEvent(new CustomEvent('asbplayer-query-netflix'));

export default class Binding {
    subscribed: boolean = false;

    ankiUiSavedState?: AnkiUiSavedState;

    private _synced: boolean;
    private _syncedTimestamp?: number;
    private recordingMedia: boolean;
    private recordingMediaStartedTimestamp?: number;
    private recordingMediaWithScreenshot: boolean;
    private _playMode: PlayMode = PlayMode.normal;

    readonly video: HTMLMediaElement;
    readonly subSyncAvailable: boolean;
    readonly subtitleController: SubtitleController;
    readonly videoDataSyncController: VideoDataSyncController;
    readonly controlsController: ControlsController;
    readonly dragController: DragController;
    readonly ankiUiController: AnkiUiController;
    readonly requestActiveTabPermissionController: ActiveTabPermissionRequestController;
    readonly keyBindings: KeyBindings;
    readonly settings: SettingsProvider;

    private copyToClipboardOnMine: boolean;
    private recordMedia: boolean;
    private takeScreenshot: boolean;
    private cleanScreenshot: boolean;
    private audioPaddingStart: number;
    private audioPaddingEnd: number;
    private maxImageWidth: number;
    private maxImageHeight: number;
    private autoPausePreference: AutoPausePreference;
    private condensedPlaybackMinimumSkipIntervalMs = 1000;
    private imageDelay = 0;

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
        this.subtitleController = new SubtitleController(video);
        this.settings = new SettingsProvider(new ExtensionSettingsStorage());
        this.videoDataSyncController = new VideoDataSyncController(this, this.settings);
        this.controlsController = new ControlsController(video);
        this.dragController = new DragController(video);
        this.keyBindings = new KeyBindings();
        this.ankiUiController = new AnkiUiController();
        this.requestActiveTabPermissionController = new ActiveTabPermissionRequestController(this);
        this.recordMedia = true;
        this.takeScreenshot = true;
        this.cleanScreenshot = true;
        this.audioPaddingStart = 0;
        this.audioPaddingEnd = 500;
        this.maxImageWidth = 0;
        this.maxImageHeight = 0;
        this.autoPausePreference = AutoPausePreference.atEnd;
        this.copyToClipboardOnMine = false;
        this._synced = false;
        this.recordingMedia = false;
        this.recordingMediaWithScreenshot = false;
        this.frameId = frameId;
    }

    get synced() {
        return this._synced;
    }

    get url() {
        return window.location !== window.parent.location ? document.referrer : document.location.href;
    }

    get playMode() {
        return this._playMode;
    }

    set playMode(newPlayMode: PlayMode) {
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
            case PlayMode.normal:
                if (this._playMode === PlayMode.autoPause) {
                    this.subtitleController.autoPauseContext.onStartedShowing = undefined;
                    this.subtitleController.autoPauseContext.onWillStopShowing = undefined;
                    this.subtitleController.notification('info.disabledAutoPause');
                } else if (this._playMode === PlayMode.condensed) {
                    this.subtitleController.onNextToShow = undefined;
                    this.subtitleController.notification('info.disabledCondensedPlayback');
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
            const command: VideoToExtensionCommand<CurrentTimeFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);

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

            if (this._synced) {
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
                        sendResponse(this.subtitleController.subtitles);
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
                            if (this.subtitleController.subtitles.length > 0) {
                                this._copySubtitle(copySubtitleMessage.postMineAction);
                            } else {
                                this._toggleRecordingMedia(copySubtitleMessage.postMineAction);
                            }
                        }
                        break;
                    case 'toggle-recording':
                        if (this._synced) {
                            this._toggleRecordingMedia(PostMineAction.showAnkiDialog);
                        }
                        break;
                    case 'card-updated':
                        const cardUpdatedMessage = request.message as CardUpdatedMessage;
                        this.subtitleController.notification('info.updatedCard', { result: request.message.cardName });
                        this.ankiUiSavedState = {
                            subtitle: cardUpdatedMessage.subtitle,
                            text: '',
                            sliderContext: {
                                subtitleStart: cardUpdatedMessage.subtitle.start,
                                subtitleEnd: cardUpdatedMessage.subtitle.end,
                                subtitles: cardUpdatedMessage.surroundingSubtitles,
                            },
                            definition: '',
                            image: cardUpdatedMessage.image,
                            audio: cardUpdatedMessage.audio,
                            word: cardUpdatedMessage.cardName,
                            source: sourceString(this.subtitleFileName(), cardUpdatedMessage.subtitle.start),
                            url: cardUpdatedMessage.url ?? '',
                            customFieldValues: {},
                            timestampInterval: [cardUpdatedMessage.subtitle.start, cardUpdatedMessage.subtitle.end],
                            initialTimestampInterval: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            lastAppliedTimestampIntervalToText: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            lastAppliedTimestampIntervalToAudio: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            dialogRequestedTimestamp: this.video.currentTime * 1000,
                        };
                        break;
                    case 'recording-finished':
                        this.recordingMedia = false;
                        this.recordingMediaStartedTimestamp = undefined;
                        break;
                    case 'show-anki-ui':
                        const showAnkiUiMessage = request.message as ShowAnkiUiMessage;
                        this.ankiUiController.show(
                            this,
                            showAnkiUiMessage.subtitle,
                            showAnkiUiMessage.surroundingSubtitles,
                            showAnkiUiMessage.image,
                            showAnkiUiMessage.audio
                        );
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

                        if (screenshotTakenMessage.ankiUiState) {
                            this.ankiUiController.showAfterRetakingScreenshot(this, screenshotTakenMessage.ankiUiState);
                        }

                        this.controlsController.show();
                        break;
                    case 'alert':
                        // ignore
                        break;
                    case 'request-active-tab-permission':
                        this.requestActiveTabPermissionController.show();
                        // Recording must have failed, reset flag
                        this.recordingMedia = false;
                        break;
                    case 'granted-active-tab-permission':
                        this.requestActiveTabPermissionController.onPermissionGranted();
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
        this.recordMedia = currentSettings.streamingRecordMedia;
        this.takeScreenshot =
            currentSettings.streamingTakeScreenshot &&
            // @ts-ignore
            (typeof this.video.webkitVideoDecodedByteCount !== 'number' || this.video.webkitVideoDecodedByteCount > 0);
        this.cleanScreenshot = currentSettings.streamingTakeScreenshot && currentSettings.streamingCleanScreenshot;
        this.subtitleController.displaySubtitles = currentSettings.streamingDisplaySubtitles;
        this.subtitleController.subtitlePositionOffset = currentSettings.streamingSubtitlePositionOffset;
        this.subtitleController.subtitleAlignment = currentSettings.streamingSubtitleAlignment;
        this.subtitleController.refresh();
        this.videoDataSyncController.updateSettings(currentSettings);
        this.keyBindings.setKeyBindSet(this, currentSettings.keyBindSet);
        this.condensedPlaybackMinimumSkipIntervalMs = currentSettings.streamingCondensedPlaybackMinimumSkipIntervalMs;
        this.imageDelay = currentSettings.streamingScreenshotDelay;
        this.subtitleController.setSubtitleSettings(currentSettings);
        this.subtitleController.refresh();
        this.ankiUiController.ankiSettings = extractAnkiSettings(currentSettings);
        this.audioPaddingStart = currentSettings.audioPaddingStart;
        this.audioPaddingEnd = currentSettings.audioPaddingEnd;
        this.maxImageWidth = currentSettings.maxImageWidth;
        this.maxImageHeight = currentSettings.maxImageHeight;
        this.subtitleController.surroundingSubtitlesCountRadius = currentSettings.surroundingSubtitlesCountRadius;
        this.subtitleController.surroundingSubtitlesTimeRadius = currentSettings.surroundingSubtitlesTimeRadius;
        this.copyToClipboardOnMine = currentSettings.copyToClipboardOnMine;
        this.autoPausePreference = currentSettings.autoPausePreference;
        this.keyBindings.setKeyBindSet(this, currentSettings.keyBindSet);
        this.subtitleController.autoCopyCurrentSubtitle = currentSettings.autoCopyCurrentSubtitle;
        this.subtitleController.preCacheDom = currentSettings.preCacheSubtitleDom;

        if (currentSettings.streamingSubsDragAndDrop) {
            this.dragController.bind(this);
        } else {
            this.dragController.unbind();
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

    async _copySubtitle(postMineAction: PostMineAction) {
        const [subtitle, surroundingSubtitles] = this.subtitleController.currentSubtitle();

        if (subtitle && surroundingSubtitles) {
            if (this.copyToClipboardOnMine) {
                navigator.clipboard.writeText(subtitle.text);
            }

            if (this.takeScreenshot) {
                await this._prepareScreenshot();
            }

            if (this.recordMedia) {
                this.recordingMedia = true;
                this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
                const start = Math.max(0, subtitle.start - this.audioPaddingStart);
                this.seek(start / 1000);
                await this.play();
            }

            const ankiSettings =
                postMineAction === PostMineAction.updateLastCard ? this.ankiUiController.ankiSettings : undefined;

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
                    ankiSettings: ankiSettings,
                    ...this._imageCaptureParams,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }
    }

    async _toggleRecordingMedia(postMineAction: PostMineAction) {
        const ankiSettings =
            postMineAction === PostMineAction.updateLastCard ? this.ankiUiController.ankiSettings : undefined;
        if (this.recordingMedia) {
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
                    ankiSettings: ankiSettings,
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
                this.recordingMedia = true;
                this.recordingMediaStartedTimestamp = timestamp;
                this.recordingMediaWithScreenshot = this.takeScreenshot;
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
                    ankiSettings: ankiSettings,
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
            this.subtitleController.forceHideSubtitles = true;
            await this.controlsController.hide();
        }
    }

    async rerecord(start: number, end: number, uiState: AnkiUiSavedState) {
        const noSubtitles = this.subtitleController.subtitles.length === 0;
        const audioPaddingStart = noSubtitles ? 0 : this.audioPaddingStart;
        const audioPaddingEnd = noSubtitles ? 0 : this.audioPaddingEnd;
        this.recordingMedia = true;
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
            this.video.currentTime = timestamp;
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
        const { streamingSubtitleListPreference, subtitleRegexFilter, subtitleRegexFilterTextReplacement } =
            await this.settings.get([
                'streamingSubtitleListPreference',
                'subtitleRegexFilter',
                'subtitleRegexFilterTextReplacement',
            ]);
        switch (streamingSubtitleListPreference) {
            case SubtitleListPreference.noSubtitleList:
                const reader = new SubtitleReader({
                    regexFilter: subtitleRegexFilter,
                    regexFilterTextReplacement: subtitleRegexFilterTextReplacement,
                });
                const subtitles = await reader.subtitles(files, flatten);
                this._updateSubtitles(
                    subtitles.map((s, index) => ({ ...s, index, originalStart: s.start, originalEnd: s.end })),
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

        this.subtitleController.showLoadedMessage();
        this.videoDataSyncController.unbindVideoSelect();
        this.ankiUiSavedState = undefined;
        this._synced = true;
        this._syncedTimestamp = Date.now();
    }
}
