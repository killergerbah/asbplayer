import Binding from './Binding';
import Settings from './Settings';
import UiFrame from './UiFrame';

export default class VideoSelectModeContainer {
    private readonly _bindings: Binding[];
    private readonly _frame: UiFrame;
    private readonly _settings: Settings = new Settings();

    private messageListener?: (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;

    constructor(bindings: Binding[]) {
        this._bindings = bindings;
        this._frame = new UiFrame(
            `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - Video Select Mode</title>
                    <style type="text/css">
                        html, body {
                            background-color: transparent !important;
                        }
                    </style>
                </head>
                <body>
                <div id="root" style="width:100%;height:100vh;"></div>
                <script src="${chrome.runtime.getURL('./video-select-mode-ui.js')}"></script>
                </body>
            </html>`
        );
    }

    bind() {
        let videoSelectMode = false;

        this.messageListener = (
            request: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (request.sender !== 'asbplayer-extension-to-video') {
                return;
            }

            switch (request.message.command) {
                case 'toggle-video-select':
                    if (videoSelectMode) {
                        // Toggle off
                        for (const b of this._bindings) {
                            b.unbindVideoSelect();
                        }

                        videoSelectMode = false;
                        this._hideUi();
                        break;
                    }

                    if (this._bindings.length === 1) {
                        const binding = this._bindings[0];

                        if (binding.subscribed) {
                            // Special case - show dialog for the one video element
                            binding.showVideoSelect();
                        }
                    } else if (this._bindings.length > 1) {
                        // Toggle on
                        videoSelectMode = true;
                        this._showUi();

                        for (const b of this._bindings) {
                            if (b.subscribed) {
                                b.bindVideoSelect(() => {
                                    for (const b of this._bindings) {
                                        b.unbindVideoSelect();
                                    }

                                    videoSelectMode = false;
                                    this._hideUi();
                                });
                            }
                        }
                    }
                    break;
                case 'subtitles':
                    for (const b of this._bindings) {
                        b.unbindVideoSelect();
                    }

                    videoSelectMode = false;
                    this._hideUi();
                    break;
                default:
                // ignore
            }
        };

        chrome.runtime.onMessage.addListener(this.messageListener);
    }

    unbind() {
        this._frame.unbind();

        if (this.messageListener) {
            chrome.runtime.onMessage.removeListener(this.messageListener);
        }
    }

    private async _showUi() {
        if (this._frame.bound) {
            return;
        }

        const showVideoSelectModeDialog = (await this._settings.get(['showVideoSelectModeDialog']))
            .showVideoSelectModeDialog;

        if (!showVideoSelectModeDialog) {
            return;
        }

        await this._frame.bind();
        this._frame.show();
        const client = await this._frame.client();
        client.onServerMessage((message) => {
            if (message.command === 'confirm') {
                client.updateState({ open: false });
                this._frame.hide();
                this._settings.set({ showVideoSelectModeDialog: !message.doNotShowDialogAgain });
            }
        });

        const themeType = (await this._settings.get(['lastThemeType'])).lastThemeType;
        client.updateState({ open: true, themeType });
    }

    private async _hideUi() {
        if (!this._frame.bound) {
            return;
        }

        const client = await this._frame.client();
        client.updateState({ open: false });
        this._frame.hide();
    }
}
