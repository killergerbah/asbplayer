import { ForwardCommandMessage, GetSettingsMessage, SetSettingsMessage, SettingsProvider } from '@project/common';
import { ExtensionSettingsStorage } from '../services/extension-settings-storage';
import FrameBridgeClient from '../services/frame-bridge-client';
import UiFrame from '../services/ui-frame';

export class AppUiController {
    private readonly _settingsStorage = new ExtensionSettingsStorage();
    private readonly _settings = new SettingsProvider(this._settingsStorage);
    private readonly _frame: UiFrame;
    private _chromeMessageListener?: (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _client?: FrameBridgeClient;

    constructor() {
        this._frame = new UiFrame(
            async (lang) => `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - App </title>
                </head>
                <body>
                    <div id="root" data-logo-url=${chrome.runtime.getURL(
                        'assets/image.png'
                    )} style="width:100%;height:100vh;"></div>
                    <script type="application/json" id="manifest">${JSON.stringify(
                        chrome.runtime.getManifest()
                    )}</script>
                    <script type="application/json" id="extensionCommands">${JSON.stringify(
                        await chrome.runtime.sendMessage({
                            sender: 'asbplayerv2',
                            message: {
                                command: 'extension-commands',
                            },
                        })
                    )}</script>
                    <script src="${chrome.runtime.getURL('./app-ui.js')}"></script>
                </body>
            </html>`
        );
    }

    async show() {
        this.unbind();
        this._frame.fetchOptions = {
            allowedFetchUrl: await this._settings.getSingle('ankiConnectUrl'),
        };
        const isNewClient = await this._frame.bind();
        this._client = await this._frame.client();

        if (isNewClient) {
            this._chromeMessageListener = (request, sender, sendResponse) => {
                if (request.sender === 'asbplayer-extension-to-player') {
                    this._client?.sendMessage(request);
                }
            };
            chrome.runtime.onMessage.addListener(this._chromeMessageListener);

            this._client.onMessage(async (message) => {
                switch (message.command) {
                    case 'get-settings':
                        const getSettingsMessage: GetSettingsMessage = message as GetSettingsMessage;
                        const response = await this._settingsStorage.get(getSettingsMessage.keysAndDefaults);
                        this._client?.sendMessage({ messageId: getSettingsMessage.messageId, response });
                        break;
                    case 'set-settings':
                        const setSettingsMessage: SetSettingsMessage = message as SetSettingsMessage;
                        await this._settingsStorage.set(setSettingsMessage.settings);
                        this._client?.sendMessage({ messageId: setSettingsMessage.messageId });
                        break;
                    case 'forward-command':
                        const forwardCommandMessage = message as ForwardCommandMessage;
                        chrome.runtime.sendMessage(forwardCommandMessage.commandToForward);
                        break;
                }
            });
        }

        this._frame.show();
    }

    unbind() {
        this._client?.unbind();

        if (this._chromeMessageListener) {
            chrome.runtime.onMessage.removeListener(this._chromeMessageListener);
            this._chromeMessageListener = undefined;
        }
    }
}
