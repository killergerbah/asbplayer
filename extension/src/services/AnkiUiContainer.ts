import {
    AnkiSettings,
    AnkiUiBridgeRerecordMessage,
    AnkiUiBridgeRetakeScreenshotMessage,
    AnkiUiInitialState,
    AnkiUiRerecordState,
    AnkiUiResumeState,
    AudioModel,
    ImageModel,
    SubtitleModel,
} from '@project/common';
import Binding from './Binding';
import FrameBridgeClient from './FrameBridgeClient';

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
    private client?: FrameBridgeClient;
    private frame?: HTMLIFrameElement;
    private fullscreenElement?: Element;
    private activeElement?: Element;

    ankiSettings?: AnkiSettings;

    constructor() {}

    async show(
        context: Binding,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        image: ImageModel | undefined,
        audio: AudioModel | undefined
    ) {
        if (!this.ankiSettings) {
            throw new Error('Unable to show Anki UI because settings are missing.');
            return;
        }

        const subtitleFileNames = context.subtitleContainer.subtitleFileNames;
        const client = await this._client(context);
        this._prepareShow(context);
        const url = context.url;
        const themeType = (await context.settings.get(['lastThemeType'])).lastThemeType;
        const state: AnkiUiInitialState = {
            type: 'initial',
            open: true,
            settingsProvider: this.ankiSettings,
            source:
                (subtitleFileNames && (subtitle.track ? subtitleFileNames[subtitle.track] : subtitleFileNames[0])) ??
                '',
            url: url,
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            image: image,
            audio: audio,
            themeType: themeType,
        };
        client.updateState(state);
    }

    async showAfterRerecord(context: Binding, uiState: AnkiUiRerecordState) {
        if (!this.ankiSettings) {
            throw new Error('Unable to show Anki UI after rerecording because anki settings are undefined');
        }

        const client = await this._client(context);
        this._prepareShow(context);

        const themeType = (await context.settings.get(['lastThemeType'])).lastThemeType;
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            settingsProvider: this.ankiSettings,
            themeType: themeType,
        };
        client.updateState(state);
    }

    async showAfterRetakingScreenshot(context: Binding, uiState: AnkiUiRerecordState) {
        if (!this.ankiSettings) {
            throw new Error('Unable to show Anki UI after retaking screenshot because anki settings are undefined');
        }

        const client = await this._client(context);
        this._prepareShow(context);

        const themeType = (await context.settings.get(['lastThemeType'])).lastThemeType;
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            settingsProvider: this.ankiSettings,
            themeType: themeType,
        };
        client.updateState(state);
    }

    _prepareShow(context: Binding) {
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

    async _client(context: Binding) {
        if (this.client) {
            this.frame?.classList.remove('asbplayer-hide');
            return this.client;
        }

        this.frame = document.createElement('iframe');
        this.frame.className = 'asbplayer-ui-frame';
        this.client = new FrameBridgeClient(this.frame, context.video.src);
        document.body.appendChild(this.frame);
        const doc = this.frame.contentDocument!;
        doc.open();
        doc.write(await html());
        doc.close();
        await this.client.bind();
        this.client.onFinished((message) => {
            context.keyBindings.bind(context);
            context.subtitleContainer.displaySubtitles = context.displaySubtitles;
            this.frame?.classList.add('asbplayer-hide');
            if (this.fullscreenElement) {
                this.fullscreenElement.requestFullscreen();
                this.fullscreenElement = undefined;
            }

            if (this.activeElement) {
                const activeHtmlElement = this.activeElement as HTMLElement;

                if (typeof activeHtmlElement.focus === 'function') {
                    activeHtmlElement.focus();
                }

                this.activeElement = undefined;
            } else {
                window.focus();
            }

            switch (message.command) {
                case 'resume':
                    context.play();
                    break;
                case 'rerecord':
                    const rerecordMessage = message as AnkiUiBridgeRerecordMessage;
                    context.rerecord(rerecordMessage.recordStart, rerecordMessage.recordEnd, rerecordMessage.uiState);
                    break;
                case 'retake-screenshot':
                    const retakeScreenshotMessage = message as AnkiUiBridgeRetakeScreenshotMessage;
                    context.retakingScreenshot = true;
                    context.rerecordAnkiUiState = retakeScreenshotMessage.uiState;
                    break;
                default:
                    console.error('Unknown message received from bridge: ' + message.command);
            }
        });

        return this.client;
    }

    unbind() {
        if (this.client) {
            this.client.unbind();
            this.client = undefined;
        }

        if (this.frame) {
            this.frame.remove();
            this.frame = undefined;
        }
    }
}