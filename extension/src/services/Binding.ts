import { AnkiUiContainerCurrentItem, AnkiUiState } from '@project/common';
import AnkiUiContainer from './AnkiUiContainer';
import ControlsContainer from './ControlsContainer';
import DragContainer from './DragContainer';
import KeyBindings from './KeyBindings';
import Settings from './Settings';
import SubtitleContainer from './SubtitleContainer';
import VideoDataSyncContainer from './VideoDataSyncContainer';

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = (e as CustomEvent).detail;
});

export default class Binding {
    displaySubtitles: boolean;
    recordMedia: boolean;
    screenshot: boolean;
    cleanScreenshot: boolean;
    bindKeys: boolean;
    audioPaddingStart: number;
    audioPaddingEnd: number;
    maxImageWidth: number;
    maxImageHeight: number;
    
    private synced: boolean;
    private recordingMedia: boolean;
    private recordingMediaStartedTimestamp?: number;
    private recordingMediaWithScreenshot: boolean;

    readonly video: HTMLVideoElement;
    readonly subSyncAvailable: boolean;
    readonly subtitleContainer: SubtitleContainer;
    readonly videoDataSyncContainer: VideoDataSyncContainer;
    readonly controlsContainer: ControlsContainer;
    readonly dragContainer: DragContainer;
    readonly ankiUiContainer: AnkiUiContainer;
    readonly keyBindings: KeyBindings;
    readonly settings: Settings;

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
    private showControlsTimeout?: NodeJS.Timeout;

    constructor(video: HTMLVideoElement, syncAvailable: boolean) {
        this.video = video;
        this.subSyncAvailable = syncAvailable;
        this.subtitleContainer = new SubtitleContainer(video);
        this.videoDataSyncContainer = new VideoDataSyncContainer(this);
        this.controlsContainer = new ControlsContainer(video);
        this.dragContainer = new DragContainer(video);
        this.ankiUiContainer = new AnkiUiContainer();
        this.keyBindings = new KeyBindings();
        this.settings = new Settings();
        this.displaySubtitles = true;
        this.recordMedia = true;
        this.screenshot = true;
        this.cleanScreenshot = true;
        this.bindKeys = true;
        this.audioPaddingStart = 0;
        this.audioPaddingEnd = 500;
        this.maxImageWidth = 0;
        this.maxImageHeight = 0;
        this.synced = false;
        this.recordingMedia = false;
        this.recordingMediaWithScreenshot = false;
    }

    get url() {
        return window.location !== window.parent.location ? document.referrer : document.location.href;
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

                chrome.runtime.sendMessage({
                    sender: 'asbplayer-video',
                    message: {
                        command: 'readyState',
                        value: 4,
                    },
                    src: this.video.src,
                });
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings().then(() => {
            this.videoDataSyncContainer.requestSubtitles();
        });
        this.subtitleContainer.bind();
        this.dragContainer.bind();
    }

    _notifyReady() {
        chrome.runtime.sendMessage({
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.video.duration,
                currentTime: this.video.currentTime,
                paused: this.video.paused,
                audioTracks: null,
                selectedAudioTrack: null,
                playbackRate: this.video.playbackRate,
            },
            src: this.video.src,
        });
    }

    _subscribe() {
        this.playListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false,
                },
                src: this.video.src,
            });
        };

        this.pauseListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false,
                },
                src: this.video.src,
            });
        };

        this.seekedListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false,
                },
                src: this.video.src,
            });
        };

        this.playbackRateListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'playbackRate',
                    value: this.video.playbackRate,
                    echo: false,
                },
                src: this.video.src,
            });
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);
        this.video.addEventListener('ratechange', this.playbackRateListener);

        if (this.subSyncAvailable) {
            this.videoChangeListener = () => {
                this.videoDataSyncContainer.requestSubtitles();
            };
            this.video.addEventListener('loadedmetadata', this.videoChangeListener);
        }

        this.heartbeatInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                },
                src: this.video.src,
            });
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
                        this.seek(request.message.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        this.subtitleContainer.subtitles = request.message.value;
                        this.subtitleContainer.subtitleFileNames = request.message.names || [request.message.name];

                        let loadedMessage;

                        if (request.message.names) {
                            loadedMessage = request.message.names.join('<br>');
                        } else {
                            loadedMessage = request.message.name || '[Subtitles Loaded]';
                        }

                        this.subtitleContainer.showLoadedMessage(loadedMessage);
                        this.videoDataSyncContainer.unbindVideoSelect();
                        this.synced = true;
                        break;
                    case 'subtitleSettings':
                        this.subtitleContainer.subtitleSettings = request.message.value;
                        this.subtitleContainer.refresh();
                        break;
                    case 'ankiSettings':
                        const ankiSettings = request.message.value;
                        ankiSettings.tags = typeof ankiSettings.tags === 'undefined' ? [] : ankiSettings.tags;
                        this.ankiUiContainer.ankiSettings = ankiSettings;
                        this.audioPaddingStart =
                            typeof request.message.value.audioPaddingStart === 'undefined'
                                ? this.audioPaddingStart
                                : request.message.value.audioPaddingStart;
                        this.audioPaddingEnd =
                            typeof request.message.value.audioPaddingEnd === 'undefined'
                                ? this.audioPaddingEnd
                                : request.message.value.audioPaddingEnd;
                        this.maxImageWidth =
                            typeof request.message.value.maxImageWidth === 'undefined'
                                ? this.maxImageWidth
                                : request.message.value.maxImageWidth;
                        this.maxImageHeight =
                            typeof request.message.value.maxImageHeight === 'undefined'
                                ? this.maxImageHeight
                                : request.message.value.maxImageHeight;
                        this.subtitleContainer.surroundingSubtitlesCountRadius =
                            typeof request.message.value.surroundingSubtitlesCountRadius === 'undefined'
                                ? this.subtitleContainer.surroundingSubtitlesCountRadius
                                : request.message.value.surroundingSubtitlesCountRadius;
                        this.subtitleContainer.surroundingSubtitlesTimeRadius =
                            typeof request.message.value.surroundingSubtitlesTimeRadius === 'undefined'
                                ? this.subtitleContainer.surroundingSubtitlesTimeRadius
                                : request.message.value.surroundingSubtitlesTimeRadius;
                        break;
                    case 'miscSettings':
                        this.settings.set({ lastThemeType: request.message.value.themeType });
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        if (this.synced) {
                            if (this.subtitleContainer.subtitles.length > 0) {
                                this._copySubtitle(request.message.showAnkiUi);
                            } else {
                                this._toggleRecordingMedia(request.message.showAnkiUi);
                            }
                        }
                        break;
                    case 'show-anki-ui':
                        this.ankiUiContainer.show(
                            this,
                            request.message.subtitle,
                            request.message.surroundingSubtitles,
                            request.message.image,
                            request.message.audio,
                            request.message.id
                        );
                        break;
                    case 'show-anki-ui-after-rerecord':
                        this.ankiUiContainer.showAfterRerecord(
                            this,
                            request.message.audio,
                            request.message.uiState,
                            request.message.id
                        );
                        break;
                    case 'screenshot-taken':
                        if (this.cleanScreenshot) {
                            if (this.showControlsTimeout) {
                                clearTimeout(this.showControlsTimeout);
                                this.showControlsTimeout = undefined;
                            }

                            this.controlsContainer.show();
                            this.settings
                                .get(['displaySubtitles'])
                                .then(
                                    ({ displaySubtitles }) =>
                                        (this.subtitleContainer.displaySubtitles = displaySubtitles)
                                );
                        }
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
    }

    async _refreshSettings() {
        const currentSettings = await this.settings.get();
        this.recordMedia = currentSettings.recordMedia;
        this.screenshot = currentSettings.screenshot;
        this.cleanScreenshot = currentSettings.screenshot && currentSettings.cleanScreenshot;
        this.displaySubtitles = currentSettings.displaySubtitles;
        this.subtitleContainer.displaySubtitles = currentSettings.displaySubtitles;
        this.subtitleContainer.subtitlePositionOffsetBottom = currentSettings.subtitlePositionOffsetBottom;
        this.subtitleContainer.refresh();
        this.bindKeys = currentSettings.bindKeys;
        this.videoDataSyncContainer.updateSettings(currentSettings);

        if (currentSettings.bindKeys) {
            this.keyBindings.bind(this);
        } else {
            this.keyBindings.unbind();
        }

        if (currentSettings.subsDragAndDrop) {
            this.dragContainer.bind();
        } else {
            this.dragContainer.unbind();
        }
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

        this.subtitleContainer.unbind();
        this.dragContainer.unbind();
        this.keyBindings.unbind();
        this.videoDataSyncContainer.unbind();
    }

    async _copySubtitle(showAnkiUi: boolean) {
        const [subtitle, surroundingSubtitles] = this.subtitleContainer.currentSubtitle();

        if (subtitle && surroundingSubtitles) {
            navigator.clipboard.writeText(subtitle.text);

            if (this.screenshot) {
                await this._prepareScreenshot();
            }

            if (this.recordMedia) {
                const start = Math.max(0, subtitle.start - this.audioPaddingStart);
                this.seek(start / 1000);
                await this.play();
            }

            const message = {
                command: 'record-media-and-forward-subtitle',
                subtitle: subtitle,
                surroundingSubtitles: surroundingSubtitles,
                record: this.recordMedia,
                screenshot: this.screenshot,
                url: this.url,
                showAnkiUi: showAnkiUi,
                audioPaddingStart: this.audioPaddingStart,
                audioPaddingEnd: this.audioPaddingEnd,
                playbackRate: this.video.playbackRate,
                rect: this.screenshot ? this.video.getBoundingClientRect() : null,
                maxImageWidth: this.maxImageWidth,
                maxImageHeight: this.maxImageHeight,
            };

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: message,
                src: this.video.src,
            });
        }
    }

    async _toggleRecordingMedia(showAnkiUi: boolean) {
        if (this.recordingMedia) {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'stop-recording-media',
                    showAnkiUi: showAnkiUi,
                    startTimestamp: this.recordingMediaStartedTimestamp,
                    endTimestamp: this.video.currentTime * 1000,
                    screenshot: this.recordingMediaWithScreenshot,
                    videoDuration: this.video.duration * 1000,
                    url: this.url,
                },
                src: this.video.src,
            });

            this.recordingMedia = false;
            this.recordingMediaStartedTimestamp = undefined;
        } else {
            if (this.screenshot) {
                await this._prepareScreenshot();
            }

            const timestamp = this.video.currentTime * 1000;

            if (this.recordMedia) {
                this.recordingMedia = true;
                this.recordingMediaStartedTimestamp = timestamp;
                this.recordingMediaWithScreenshot = this.screenshot;
            }

            const message = {
                command: 'start-recording-media',
                timestamp: timestamp,
                record: this.recordMedia,
                showAnkiUi: showAnkiUi,
                screenshot: this.screenshot,
                rect: this.screenshot ? this.video.getBoundingClientRect() : null,
                maxImageWidth: this.maxImageWidth,
                maxImageHeight: this.maxImageHeight,
                url: this.url,
            };

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: message,
                src: this.video.src,
            });
        }
    }

    async _prepareScreenshot() {
        if (this.showControlsTimeout) {
            clearTimeout(this.showControlsTimeout);
            this.showControlsTimeout = undefined;
        }

        if (this.cleanScreenshot) {
            this.subtitleContainer.displaySubtitles = false;
            await this.controlsContainer.hide();
            this.showControlsTimeout = setTimeout(() => {
                this.controlsContainer.show();
                this.showControlsTimeout = undefined;
                this.settings
                    .get(['displaySubtitles'])
                    .then(({ displaySubtitles }) => (this.subtitleContainer.displaySubtitles = displaySubtitles));
            }, 1000);
        }
    }

    async rerecord(start: number, end: number, currentItem: AnkiUiContainerCurrentItem, uiState: AnkiUiState) {
        const noSubtitles = this.subtitleContainer.subtitles.length === 0;
        const audioPaddingStart = noSubtitles ? 0 : this.audioPaddingStart;
        const audioPaddingEnd = noSubtitles ? 0 : this.audioPaddingEnd;

        this.seek(Math.max(0, start - audioPaddingStart) / 1000);
        await this.play();

        const message = {
            command: 'rerecord-media',
            duration: end - start,
            uiState: uiState,
            audioPaddingStart: audioPaddingStart,
            audioPaddingEnd: audioPaddingEnd,
            currentItem: currentItem,
            playbackRate: this.video.playbackRate,
            timestamp: start,
        };

        chrome.runtime.sendMessage({
            sender: 'asbplayer-video',
            message: message,
            src: this.video.src,
        });
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
        this.videoDataSyncContainer.bindVideoSelect(doneListener);
    }

    unbindVideoSelect() {
        this.videoDataSyncContainer.unbindVideoSelect();
    }

    showVideoSelect() {
        this.videoDataSyncContainer.show();
    }
}
