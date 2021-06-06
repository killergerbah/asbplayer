import SubtitleContainer from './SubtitleContainer';
import ControlsContainer from './ControlsContainer';
import DragContainer from './DragContainer';
import KeyBindings from './KeyBindings';

var s = document.createElement('script');
s.src = chrome.runtime.getURL('netflix.js');
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = e.detail;
});

export default class Binding {

    constructor(video) {
        this.video = video;
        this.subtitleContainer = new SubtitleContainer(video);
        this.controlsContainer = new ControlsContainer(video);
        this.dragContainer = new DragContainer(video);
        this.keyBindings = new KeyBindings();
        this.recordMedia = true;
        this.screenshot = true;
        this.cleanScreenshot = true;
        this.bindKeys = true;
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
                        value: 4
                    },
                    src: this.video.src
                });
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings();
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
                selectedAudioTrack: null
            },
            src: this.video.src
        });
    }

    _subscribe() {
        this.playListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false
                },
                src: this.video.src
            });
        };

        this.pauseListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false
                },
                src: this.video.src
            });
        };

        this.seekedListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false
                },
                src: this.video.src
            });
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);

        this.heartbeatInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat'
                },
                src: this.video.src
            });
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            clearInterval(this.heartbeatInterval);
        });

        this.listener = (request, sender, sendResponse) => {
            if (request.sender === 'asbplayer-extension-to-video' && request.src === this.video.src) {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this._play();
                        break;
                    case 'pause':
                        this.video.pause();
                        break;
                    case 'currentTime':
                        this.seek(request.message.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        this.subtitleContainer.subtitles = request.message.value;
                        this.subtitleContainer.showLoadedMessage(request.message.name || "[Subtitles Loaded]");
                        break;
                    case 'subtitleSettings':
                        this.subtitleContainer.subtitleSettings = request.message.value;
                        this.subtitleContainer.refresh();
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        this._copySubtitle();
                        break;
                    case 'screenshot-taken':
                        if (this.cleanScreenshot) {
                            if (this.showControlsTimeout) {
                                clearTimeout(this.showControlsTimeout);
                                this.showControlsTimeout = null;
                            }

                            this.controlsContainer.show();
                        }
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
    }

    _refreshSettings() {
        chrome.storage.sync.get({
            displaySubtitles: true,
            recordMedia: true,
            screenshot: true,
            cleanScreenshot: true,
            bindKeys: true,
            subsDragAndDrop: true,
            subtitlePositionOffsetBottom: 100
        },
        (data) => {
            this.recordMedia = data.recordMedia;
            this.screenshot = data.screenshot;
            this.cleanScreenshot = data.screenshot && data.cleanScreenshot;
            this.subtitleContainer.displaySubtitles = data.displaySubtitles;
            this.subtitleContainer.subtitlePositionOffsetBottom = data.subtitlePositionOffsetBottom;
            this.subtitleContainer.refresh();

            if (data.bindKeys) {
                this.keyBindings.bind(this);
            } else {
                this.keyBindings.unbind();
            }

            if (data.subsDragAndDrop) {
                this.dragContainer.bind();
            } else {
                this.dragContainer.unbind();
            }
        });
    }

    unbind() {
        if (this.playListener) {
            this.video.removeEventListener('play', this.playListener);
        }

        if (this.pauseListener) {
            this.video.removeEventListener('pause', this.pauseListener);
        }

        if (this.seekedListener) {
            this.video.removeEventListener('seeked', this.seekedListener);
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
        }

        this.subtitleContainer.unbind();
        this.dragContainer.unbind();
        this.keyBindings.unbind();
    }

    async _copySubtitle() {
        const subtitle = this.subtitleContainer.currentSubtitle();

        if (subtitle) {
            navigator.clipboard.writeText(subtitle.text);

            if (this.recordMedia) {
                this.seek(subtitle.start / 1000);

                if (this.showControlsTimeout) {
                    clearTimeout(this.showControlsTimeout);
                    this.showControlsTimeout = null;
                }

                if (this.cleanScreenshot) {
                    this.controlsContainer.hide();
                }

                await this._play();

                if (this.cleanScreenshot) {
                    this.showControlsTimeout = setTimeout(() => {
                        this.controlsContainer.show();
                        this.showControlsTimeout = null;
                    }, 1000);
                }
            }

            const message = {
                command: 'record-media-and-forward-subtitle',
                subtitle: subtitle,
                record: this.recordMedia,
                screenshot: this.screenshot
            };

            if (message.screenshot) {
                const rect = this.video.getBoundingClientRect();
                message.rect = {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }
            }

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: message,
                src: this.video.src
            });
        }
    }

    seek(timestamp) {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-seek', {
                detail: timestamp * 1000
            }));
        } else {
            this.video.currentTime = timestamp;
        }
    }

    async _play() {
        try {
            await this.video.play();
        } catch (ex) {
            // Ignore exception

            if (this.video.readyState !== 4) {
                // Deal with Amazon Prime player pausing in the middle of play, without loss of generality
                return new Promise((resolve, reject) => {
                    const listener = async (evt) => {
                        let retries = 3;

                        for (let i = 0; i < retries; ++i) {
                            try {
                                await this.video.play();
                                break;
                            } catch (ex2) {
                                console.error(ex2);
                            }
                        }

                        resolve();
                        this.video.removeEventListener('canplay', listener);
                    };

                    this.video.addEventListener('canplay', listener);
                });
            }
        }
    }
}
