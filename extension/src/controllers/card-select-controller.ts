import {
    AnkiDialogSettings,
    CardModel,
    CardUpdatedDialogMessage,
    ShowCardSelectUiMessage,
    VideoToExtensionCommand,
} from '@project/common';
import Binding from '../services/binding';
import { fetchLocalization } from '../services/localization-fetcher';
import UiFrame from '../services/ui-frame';

async function html(language: string) {
    return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - Select Card</title>
                    <style>
                        @import url(${browser.runtime.getURL('/fonts/fonts.css')});
                    </style>
                </head>
                <body>
                    <div id="root" style="width:100%;height:100vh;"></div>
                    <script type="application/json" id="loc">${JSON.stringify(
                        await fetchLocalization(language)
                    )}</script>
                    <script type="module" src="${browser.runtime.getURL('/card-select-ui.js')}"></script>
                </body>
            </html>`;
}

export interface CardSelectUiState {
    open: boolean;
    settings: AnkiDialogSettings;
    card: CardModel;
}

export default class CardSelectController {
    private readonly frame: UiFrame;
    private fullscreenElement?: Element;
    private activeElement?: Element;
    private focusInListener?: (event: FocusEvent) => void;
    private _ankiDialogSettings?: AnkiDialogSettings;

    constructor() {
        this.frame = new UiFrame(html);
    }

    get showing() {
        return !this.frame.hidden;
    }

    updateSettings(settings: AnkiDialogSettings) {
        this._ankiDialogSettings = settings;
    }

    async show(context: Binding, message: ShowCardSelectUiMessage) {
        if (!this._ankiDialogSettings) {
            throw new Error('Unable to show card select UI because settings are missing.');
        }

        this._prepareShow(context);
        const client = await this._client(context);

        const state: CardSelectUiState = {
            open: true,
            settings: this._ankiDialogSettings,
            card: message as CardModel,
        };

        client.updateState(state);
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
        context.mobileVideoOverlayController.forceHide = true;
    }

    private async _client(context: Binding) {
        this.frame.fetchOptions = {
            videoSrc: context.video.src,
            allowedFetchUrl: this._ankiDialogSettings!.ankiConnectUrl,
        };
        this.frame.language = await context.settings.getSingle('language');
        const isNewClient = await this.frame.bind();
        const client = await this.frame.client();

        if (isNewClient) {
            this.focusInListener = (event: FocusEvent) => {
                if (this.frame === undefined || this.frame.hidden) {
                    return;
                }
                client.sendMessage({ command: 'focus' });
            };
            window.addEventListener('focusin', this.focusInListener);

            client.onMessage((message) => {
                if (message.command === 'card-updated-dialog') {
                    const cardUpdatedDialogCommand: VideoToExtensionCommand<CardUpdatedDialogMessage> = {
                        sender: 'asbplayer-video',
                        message: message as CardUpdatedDialogMessage,
                        src: context.video.src,
                    };
                    browser.runtime.sendMessage(cardUpdatedDialogCommand);
                    return;
                }

                context.keyBindings.bind(context);
                context.subtitleController.forceHideSubtitles = false;
                context.mobileVideoOverlayController.forceHide = false;
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
