import FrameBridgeClient from '../services/FrameBridgeClient';

function html() {
    return `<!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>asbplayer - Video Name</title>
              </head>
              <body>
              <div id="root" style="width:100%;height:100vh;"></div>
              <script src="${chrome.runtime.getURL('./video-name-ui.js')}"></script>
              </body>
              </html>`;
}

export default class VideoNameUiContainer {

    constructor(onNameSet, onCancel) {
        this.onNameSet = onNameSet;
        this.onCancel = onCancel;
    }

    async show(context) {
        const client = await this._client(context);
        this._prepareShow(context);
        client.updateState({
            open: true
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
        doc.write(html());
        doc.close();
        await this.client.bind();
        this.client.onFinished((message) => {
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

            if (message.command === 'cancel') {
                this.onCancel();
            } else if (message.command === 'name') {
                this.onNameSet(message.name);
            }

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