import {
    AnkiSettings,
    AnkiUiInitialState,
    AudioModel,
    ImageModel,
    SubtitleModel,
    OpenAsbplayerSettingsMessage,
    CopyToClipboardMessage,
    SettingsProvider,
    ankiSettingsKeys,
    TabToExtensionCommand,
    sourceString,
} from '@project/common';
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

export class TabAnkiUiController {
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider;

    constructor(settings: SettingsProvider) {
        this._frame = new UiFrame(html);
        this._settings = settings;
    }

    async show({
        subtitle,
        surroundingSubtitles,
        image,
        audio,
        subtitleFileName,
        mediaTimestamp,
        url,
    }: {
        subtitle: SubtitleModel;
        surroundingSubtitles: SubtitleModel[];
        image: ImageModel | undefined;
        audio: AudioModel | undefined;
        subtitleFileName: string;
        mediaTimestamp: number;
        url: string;
    }) {
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
            source: sourceString(subtitleFileName, mediaTimestamp),
            url,
            subtitle: subtitle,
            surroundingSubtitles,
            image,
            audio,
            themeType,
            dialogRequestedTimestamp: 0,
        };
        client.updateState(state);
    }

    private async _client(language: string, ankiSettings: AnkiSettings) {
        this._frame.fetchOptions = {
            allowedFetchUrl: ankiSettings.ankiConnectUrl,
        };
        this._frame.language = language;
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage((message) => {
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
