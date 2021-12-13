import FrameBridgeClient from '../services/FrameBridgeClient';

async function html() {
    return `<!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>asbplayer - Subtitle Selection</title>
              </head>
              <body>
              <div id="root" style="width:100%;height:100vh;"></div>
              <script src="${chrome.runtime.getURL('./subtitle-sync-ui.js')}"></script>
              </body>
              </html>`;
}

export default class SubtitleSyncSelectContainer {
    constructor(context) {
        this.context = context;
        this.themeType = 'dark';
        this.preferredSubLanguages = [];
        this.autoSelectPreferredSubLanguage = true;
        this.autoSyncSubtitles = false;
        this.keepPauseAfterSubSync = true;
        this.boundTo = '';
        this.boundFunction;
        this.requested = false;
        this.lastError = '';
        this.data;
        this.client;
    }

    bind() {
        if (this.boundTo === this.context.video.src) {
            return;
        }

        this.boundTo = this.context.video.src;
        this.requested = false;
        this.lastError = '';
        this.data = undefined;

        if (!this.boundFunction) {
            this.boundFunction = this.setSubtitles.bind(this);
            document.addEventListener('asbplayer-external-subtitles', this.boundFunction, false);
        }

        document.dispatchEvent(new CustomEvent('asbplayer-get-external-subtitles'));
    }

    unbind() {
        if (this.boundFunction) {
            document.removeEventListener('asbplayer-external-subtitles', this.boundFunction, false);
        }

        this.boundTo = '';
        this.boundFunction = undefined;
        this.requested = false;
        this.lastError = '';
        this.data = undefined;
    }

    updateSettings({
        preferredSubLanguages = '',
        autoSelectPreferredSubLanguage = true,
        autoSyncSubtitles = false,
        keepPauseAfterSubSync = true,
    }) {
        this.preferredSubLanguages = preferredSubLanguages.split(',').map((lang) => lang.toLowerCase());
        this.autoSelectPreferredSubLanguage = autoSelectPreferredSubLanguage;
        this.autoSyncSubtitles = autoSyncSubtitles;
        this.keepPauseAfterSubSync = keepPauseAfterSubSync;
    }

    setSubtitles({ detail: data }) {
        this.data = data;
        this.lastError = this.data.error;

        if (this.requested || this.autoSyncSubtitles) {
            this.requested = false;
            this.show();
        }
    }

    async show() {
        let state;

        if (!this.data) {
            this.requested = true;
            state = {
                alertOpen: true,
                alert: 'Retrieval of Subtitles in Progress...',
                severity: 'info',
            };
        } else if (this.lastError) {
            state = {
                alertOpen: true,
                alert: this.lastError,
                severity: 'error',
            };
        } else if (!this.data.subtitles.length) {
            state = {
                alertOpen: true,
                alert: 'No suitable Subtitles found...',
                severity: 'info',
            };
        } else {
            let selected;

            const subtitles = this.data.subtitles;

            for (let index = 0, length = this.preferredSubLanguages.length; index < length; index++) {
                const language = this.preferredSubLanguages[index];
                const track = subtitles.find((subtitle) => subtitle.language === language);

                if (track) {
                    selected = track.url;
                    break;
                }
            }

            if (selected && this.autoSelectPreferredSubLanguage) {
                this.context.pause();
                return this.syncSubtitle(selected);
            }

            selected = selected || subtitles[0].url;

            state = {
                open: true,
                themeType: this.themeType,
                tracks: subtitles,
                selected,
            };
        }

        const client = await this.setUp();
        client.updateState(state);
    }

    async setUp() {
        const client = await this._client();
        this._prepareShow();
        return client;
    }

    async _client() {
        if (this.client) {
            this.frame.classList.remove('asbplayer-hide');
            return this.client;
        }

        this.frame = document.createElement('iframe');
        this.frame.className = 'asbplayer-ui-frame';
        this.client = new FrameBridgeClient(this.frame);
        document.body.appendChild(this.frame);
        const doc = this.frame.contentDocument;
        doc.open();
        doc.write(await html());
        doc.close();
        await this.client.bind();
        this.client.onFinished((message) => {
            if (this.context.bindKeys) {
                this.context.keyBindings.bind(this.context);
            }
            this.context.subtitleContainer.displaySubtitles = this.context.displaySubtitles;
            this.frame.classList.add('asbplayer-hide');
            if (this.fullscreenElement) {
                this.fullscreenElement.requestFullscreen();
                this.fullscreenElement = null;
            }

            if (this.activeElement) {
                this.activeElement.focus();
                this.activeElement = null;
            } else {
                window.focus();
            }

            if ('select' === message.command) {
                this.syncSubtitle(message.track);
            }
        });

        return this.client;
    }

    _prepareShow() {
        this.context.pause();

        if (document.fullscreenElement) {
            this.fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        if (document.activeElement) {
            this.activeElement = document.activeElement;
        }

        this.context.keyBindings.unbind();
        this.context.subtitleContainer.displaySubtitles = false;
    }

    async syncSubtitle(url) {
        if (!url) {
            return this.reportError('No Url for Subtitle found...');
        }

        try {
            const response = await fetch(url)
                .then((webResponse) => {
                    if (!webResponse.ok) {
                        throw new Error(
                            `Subtitle Retrieval failed with Status ${webResponse.status}/${webResponse.statusText}...`
                        );
                    }
                    return webResponse.arrayBuffer();
                })
                .catch((error) => {
                    this.reportError(error.message);
                });

            if (!response) return;

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: [
                        {
                            name: this.data.filename,
                            base64: this.bufferToBase64(response),
                        },
                    ],
                },
                src: this.context.video.src,
            });
            if (!this.keepPauseAfterSubSync) {
                this.context.play();
            }
        } catch (error) {
            this.reportError(`Subtitle Processing failed: ${error.message}`);
        }
    }

    async reportError(error) {
        this.lastError = error;
        const client = await this.setUp();
        return client.updateState({
            alertOpen: true,
            alert: this.lastError,
            severity: 'error',
        });
    }

    bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const length = bytes.byteLength;

        for (let i = 0; i < length; ++i) {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa(binary);
    }
}
