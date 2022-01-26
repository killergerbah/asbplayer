import FrameBridgeClient from '../services/FrameBridgeClient';

// We need to write the HTML into the iframe manually so that the iframe keeps it's about:blank URL.
// Otherwise, Chrome won't insert content scripts into the iframe (e.g. Yomichan won't work).
async function html() {
    const mp3WorkerSource = await (await fetch(chrome.runtime.getURL('./mp3-encoder.worker.js'))).text();
    return `<!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>asbplayer - Anki</title>
              </head>
              <body>
              <div id="root" style="width:100%;height:100vh;"></div>
              <script id="mp3-encoder-worker" type="javascript/worker">${mp3WorkerSource}</script>
              <script src="${chrome.runtime.getURL('./anki-ui.js')}"></script>
              </body>
              </html>`;
}

export default class AnkiUiContainer {
    constructor() {
        this.currentItem = {};
    }

    async show(context, subtitle, surroundingSubtitles, image, audio, id) {
        if (!this.ankiSettings) {
            throw new Error('Unable to show Anki UI because settings are missing.');
            return;
        }

        const subtitleFileNames = context.subtitleContainer.subtitleFileNames;
        const client = await this._client(context);
        this._prepareShow(context);
        const url = context.url;
        this.currentItem = {
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            image: image,
            audio: audio,
            url: url,
            id: id,
        };
        client.updateState({
            type: 'initial',
            open: true,
            id: id,
            settingsProvider: this.ankiSettings,
            source: subtitle.track ? subtitleFileNames[subtitle.track] : subtitleFileNames[0],
            url: url,
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            image: image,
            audio: audio,
            themeType: this.themeType,
        });
    }

    async showAfterRerecord(context, audio, uiState, id) {
        if (!this.ankiSettings) {
            throw new Error('Unable to show Anki UI because settings are missing.');
            return;
        }

        const client = await this._client(context);
        this._prepareShow(context);
        this.currentItem.audio = audio;
        client.updateState({
            type: 'resume',
            id: id,
            open: true,
            settingsProvider: this.ankiSettings,
            ...uiState,
            themeType: this.themeType,
        });
    }

    _prepareShow(context) {
        context.pause();

        if (document.fullscreenElement) {
            this.fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        if (document.activeElement) {
            this.activeElement = document.activeElement;
        }

        context.keyBindings.unbind();
        context.subtitleContainer.displaySubtitles = false;
    }

    async _client(context) {
        if (this.client) {
            this.frame.classList.remove('asbplayer-hide');
            return this.client;
        }

        this.frame = document.createElement('iframe');
        this.frame.className = 'asbplayer-ui-frame';
        this.client = new FrameBridgeClient(this.frame, context.video.src);
        document.body.appendChild(this.frame);
        const doc = this.frame.contentDocument;
        doc.open();
        doc.write(await html());
        doc.close();
        await this.client.bind();
        this.client.onFinished((message) => {
            if (context.bindKeys) {
                context.keyBindings.bind(context);
            }
            context.subtitleContainer.displaySubtitles = context.displaySubtitles;
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

            if (message.command === 'resume') {
                context.play();
                this.currentItem = {};
            } else if (message.command === 'rerecord') {
                context.rerecord(message.recordStart, message.recordEnd, this.currentItem, message.uiState);
            }
        });

        return this.client;
    }

    unbind() {
        if (this.client) {
            this.client.unbind();
            this.client = null;
        }

        if (this.frame) {
            this.frame.remove();
            this.frame = null;
        }
    }
}
