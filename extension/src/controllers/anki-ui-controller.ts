import {
    AnkiSettings,
    AnkiUiBridgeRerecordMessage,
    AnkiUiInitialState,
    AnkiUiSavedState,
    AnkiUiResumeState,
    AudioModel,
    ImageModel,
    SubtitleModel,
    AnkiUiBridgeResumeMessage,
    AnkiUiBridgeRewindMessage,
    OpenAsbplayerSettingsMessage,
    VideoToExtensionCommand,
    CopyToClipboardMessage,
} from '@project/common';
import Binding from '../services/binding';
import UiFrame from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';

// We need to write the HTML into the iframe manually so that the iframe keeps it's about:blank URL.
// Otherwise, Chrome won't insert content scripts into the iframe (e.g. Yomichan won't work).
async function html(language: string) {
    const mp3WorkerSource = await (await fetch(chrome.runtime.getURL('./mp3-encoder-worker.worker.js'))).text();
    return `<!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>asbplayer - Anki</title>
              </head>
              <body>
              <div id="root" style="width:100%;height:100vh;"></div>
              <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(language))}</script>
              <script id="mp3-encoder-worker" type="javascript/worker">${mp3WorkerSource}</script>
              <script src="${chrome.runtime.getURL('./anki-ui.js')}"></script>
              </body>
              </html>`;
}

export default class AnkiUiController {
    private readonly frame: UiFrame;

    private fullscreenElement?: Element;
    private activeElement?: Element;
    private focusInListener?: (event: FocusEvent) => void;
    private _ankiSettings?: AnkiSettings;

    constructor() {
        this.frame = new UiFrame(html);
    }

    get ankiSettings() {
        return this._ankiSettings;
    }

    set ankiSettings(value) {
        this._ankiSettings = value;

        if (this.frame?.bound) {
            this.frame.client().then((client) => client.sendClientMessage({ command: 'ankiSettings', value }));
        }
    }

    get showing() {
        return !this.frame.hidden;
    }

    async show(
        context: Binding,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        image: ImageModel | undefined,
        audio: AudioModel | undefined
    ) {
        if (!this._ankiSettings) {
            throw new Error('Unable to show Anki UI because settings are missing.');
        }

        this._prepareShow(context);
        const client = await this._client(context);
        const url = context.url;
        const themeType = await context.settings.getSingle('themeType');

        const state: AnkiUiInitialState = {
            type: 'initial',
            open: true,
            settingsProvider: this._ankiSettings,
            source: context.sourceString(subtitle.start, subtitle.track),
            url: url,
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            image: image,
            audio: audio,
            themeType: themeType,
            dialogRequestedTimestamp: context.video.currentTime * 1000,
        };
        client.updateState(state);
    }

    async showAfterRerecord(context: Binding, uiState: AnkiUiSavedState) {
        if (!this._ankiSettings) {
            throw new Error('Unable to show Anki UI after rerecording because anki settings are undefined');
        }

        this._prepareShow(context);
        const client = await this._client(context);

        const themeType = await context.settings.getSingle('themeType');
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            settingsProvider: this._ankiSettings,
            themeType: themeType,
            dialogRequestedTimestamp: context.video.currentTime * 1000,
        };
        client.updateState(state);
    }

    async showAfterRetakingScreenshot(context: Binding, uiState: AnkiUiSavedState) {
        if (!this._ankiSettings) {
            throw new Error('Unable to show Anki UI after retaking screenshot because anki settings are undefined');
        }

        this._prepareShow(context);
        const client = await this._client(context);

        const themeType = await context.settings.getSingle('themeType');
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            settingsProvider: this._ankiSettings,
            themeType: themeType,
        };
        client.updateState(state);
    }

    async requestRewind(context: Binding) {
        const client = await this._client(context);
        client.sendClientMessage({ command: 'rewind' });
    }

    private _prepareShow(context: Binding) {
        context.pause();

        if (document.activeElement) {
            this.activeElement = document.activeElement;
        }

        if (document.fullscreenElement) {
            this.fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        context.keyBindings.unbind();
        context.subtitleController.forceHideSubtitles = true;
    }

    private async _client(context: Binding) {
        this.frame.fetchOptions = {
            videoSrc: context.video.src,
            allowedFetchUrl: this._ankiSettings!.ankiConnectUrl,
        };
        this.frame.language = await context.settings.getSingle('language');
        const isNewClient = await this.frame.bind();
        const client = await this.frame.client();

        if (isNewClient) {
            this.focusInListener = (event: FocusEvent) => {
                if (this.frame === undefined || this.frame.hidden) {
                    return;
                }

                // Refocus Anki UI to workaround sites like Netflix that automatically
                // take focus away when hiding video controls
                client.sendClientMessage({ command: 'focus' });
            };
            window.addEventListener('focusin', this.focusInListener);

            client.onServerMessage((message) => {
                switch (message.command) {
                    case 'openSettings':
                        const openSettingsCommand: VideoToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'open-asbplayer-settings',
                            },
                            src: context.video.src,
                        };
                        chrome.runtime.sendMessage(openSettingsCommand);
                        return;
                    case 'copy-to-clipboard':
                        const copyToClipboardMessage = message as CopyToClipboardMessage;
                        const copyToClipboardCommand: VideoToExtensionCommand<CopyToClipboardMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'copy-to-clipboard',
                                dataUrl: copyToClipboardMessage.dataUrl,
                            },
                            src: context.video.src,
                        };
                        chrome.runtime.sendMessage(copyToClipboardCommand);
                        return;
                }

                context.keyBindings.bind(context);
                context.subtitleController.forceHideSubtitles = false;
                this.frame?.hide();

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
                        const resumeMessage = message as AnkiUiBridgeResumeMessage;
                        context.ankiUiSavedState = resumeMessage.uiState;

                        if (resumeMessage.cardExported && resumeMessage.uiState.dialogRequestedTimestamp !== 0) {
                            const seekTo = resumeMessage.uiState.dialogRequestedTimestamp / 1000;

                            if (context.video.currentTime !== seekTo) {
                                context.seek(seekTo);
                            }

                            context.play();
                        } else {
                            context.play();
                        }
                        break;
                    case 'rewind':
                        const rewindMessage = message as AnkiUiBridgeRewindMessage;
                        context.ankiUiSavedState = rewindMessage.uiState;
                        context.pause();
                        context.seek(rewindMessage.uiState.subtitle.start / 1000);
                        break;
                    case 'rerecord':
                        const rerecordMessage = message as AnkiUiBridgeRerecordMessage;
                        context.rerecord(
                            rerecordMessage.recordStart,
                            rerecordMessage.recordEnd,
                            rerecordMessage.uiState
                        );
                        break;
                    default:
                        console.error('Unknown message received from bridge: ' + message.command);
                }
            });
        }

        this.frame.show();
        return client;
    }

    unbind() {
        this.frame.unbind();

        if (this.focusInListener) {
            window.removeEventListener('focusin', this.focusInListener);
            this.focusInListener = undefined;
        }
    }
}
