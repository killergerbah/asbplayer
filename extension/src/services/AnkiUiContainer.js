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

    async show(context, subtitle, image, audio) {
        if (!this.ankiSettings) {
            throw new Error("Unable to show Anki UI because settings are missing.");
            return;
        }

        const subtitleFileNames = context.subtitleContainer.subtitleFileNames;
        const client = await this._client(context);
        context.video.pause();

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        client.updateState({
            open: true,
            settingsProvider: this.ankiSettings,
            source: subtitle.track ? subtitleFileNames[subtitle.track] : subtitleFileNames[0],
            subtitle: subtitle,
            image: image,
            audio: audio,
            themeType: this.themeType
        });
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
        this.client = new FrameBridgeClient(this.frame);
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
            this.frame.classList.add('asbplayer-hide');
            context.subtitleContainer.displaySubtitles = context.displaySubtitles;
            window.focus();
            context.play();
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