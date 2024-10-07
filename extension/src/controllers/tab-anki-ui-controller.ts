import {
    AnkiUiInitialState,
    OpenAsbplayerSettingsMessage,
    CopyToClipboardMessage,
    TabToExtensionCommand,
    CardModel,
    EncodeMp3Message,
} from '@project/common';
import { AnkiSettings, SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import { sourceString } from '@project/common/util';
import UiFrame from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';
import { Mp3Encoder } from '@project/common/audio-clip';
import { base64ToBlob, blobToBase64 } from '@project/common/base64';
import { mp3WorkerFactory } from '../services/mp3-worker-factory';

// We need to write the HTML into the iframe manually so that the iframe keeps it's about:blank URL.
// Otherwise, Chrome won't insert content scripts into the iframe (e.g. Yomichan won't work).
async function html(language: string) {
    return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - Anki</title>
                    <style>
                        @import url(${chrome.runtime.getURL('./assets/fonts.css')});
                    </style>
                </head>
                <body>
                    <div id="root" style="width:100%;height:100vh;"></div>
                    <script type="application/json" id="loc">${JSON.stringify(
                        await fetchLocalization(language)
                    )}</script>
                    <script src="${chrome.runtime.getURL('./anki-ui.js')}"></script>
                </body>
            </html>`;
}

export class TabAnkiUiController {
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider;

    constructor(settings: SettingsProvider) {
        this._frame = new UiFrame(html);
        this._settings = settings;
    }

    async show(card: CardModel) {
        const { themeType, language, ...ankiSettings } = await this._settings.get([
            'themeType',
            'language',
            ...ankiSettingsKeys,
        ]);
        const client = await this._client(language, ankiSettings);
        const state: AnkiUiInitialState = {
            type: 'initial',
            open: true,
            canRerecord: false,
            settingsProvider: ankiSettings,
            source: sourceString(card.subtitleFileName, card.mediaTimestamp ?? 0),
            themeType,
            dialogRequestedTimestamp: 0,
            ...card,
        };
        client.updateState(state);
    }

    async updateSettings() {
        const ankiSettings = await this._settings.get([...ankiSettingsKeys]);
        if (this._frame.bound) {
            this._frame.client().then((client) => client.sendMessage({ command: 'ankiSettings', value: ankiSettings }));
        }
    }

    private async _client(language: string, ankiSettings: AnkiSettings) {
        this._frame.fetchOptions = {
            allowedFetchUrl: ankiSettings.ankiConnectUrl,
        };
        this._frame.language = language;
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage(async (message) => {
                switch (message.command) {
                    case 'openSettings':
                        const openSettingsCommand: TabToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'open-asbplayer-settings',
                            },
                        };
                        chrome.runtime.sendMessage(openSettingsCommand);
                        return;
                    case 'copy-to-clipboard':
                        const copyToClipboardMessage = message as CopyToClipboardMessage;
                        const copyToClipboardCommand: TabToExtensionCommand<CopyToClipboardMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'copy-to-clipboard',
                                dataUrl: copyToClipboardMessage.dataUrl,
                            },
                        };
                        chrome.runtime.sendMessage(copyToClipboardCommand);
                        return;
                    case 'encode-mp3':
                        const { base64, messageId, extension } = message as EncodeMp3Message;
                        const encodedBlob = await Mp3Encoder.encode(
                            await base64ToBlob(base64, `audio/${extension}`),
                            mp3WorkerFactory
                        );
                        client.sendMessage({
                            messageId,
                            base64: await blobToBase64(encodedBlob),
                        });
                        return;
                    case 'resume':
                        this._frame.hide();
                        return;
                }
            });
        }

        this._frame.show();
        return client;
    }

    unbind() {
        this._frame.unbind();
    }
}
