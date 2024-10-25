import {
    CaptureVisibleTabMessage,
    ForegroundToExtensionCommand,
    OpenAsbplayerSettingsMessage,
    TabToExtensionCommand,
    VideoSelectModeConfirmMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { VideoElement } from '../ui/components/VideoSelectUi';
import Binding from '../services/binding';
import UiFrame from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';
import { ExtensionSettingsStorage } from '../services/extension-settings-storage';

export default class VideoSelectController {
    private readonly _bindings: Binding[];
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

    private messageListener?: (
        request: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;

    constructor(bindings: Binding[]) {
        this._bindings = bindings;
        this._frame = new UiFrame(
            async (lang) => `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - Video Select</title>
                    <style>
                        @import url(${chrome.runtime.getURL('./assets/fonts.css')});
                    </style>
                </head>
                <body>
                    <div id="root" style="width:100%;height:100vh;"></div>
                    <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(lang))}</script>
                    <script src="${chrome.runtime.getURL('./video-select-ui.js')}"></script>
                </body>
            </html>`
        );
    }

    bind() {
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
                    this._trigger(false, request.message.fromAsbplayerId, request.src);
                    break;
                case 'copy-subtitle':
                case 'toggle-recording':
                case 'take-screenshot':
                    if (this._bindings.find((b) => b.synced) === undefined) {
                        this._trigger(true);
                    }
                    break;
                case 'subtitles':
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
            this.messageListener = undefined;
        }
    }

    private async _trigger(openedFromMiningCommand: boolean, fromAsbplayerId?: string, targetSrc?: string) {
        if (targetSrc !== undefined) {
            var binding = this._bindings.find((b) => b.video.src === targetSrc);

            if (binding !== undefined && binding.subscribed) {
                binding.showVideoDataDialog(openedFromMiningCommand, fromAsbplayerId);
            }
        } else if (this._bindings.length === 1) {
            const binding = this._bindings[0];

            if (binding.subscribed) {
                // Special case - show dialog for the one video element
                binding.showVideoDataDialog(openedFromMiningCommand);
            }
        } else if (this._bindings.length > 1) {
            // Toggle on
            this._showUi(openedFromMiningCommand);
        }
    }

    private async _showUi(openedFromMiningCommand: boolean) {
        const captureVisibleTabCommand: ForegroundToExtensionCommand<CaptureVisibleTabMessage> = {
            sender: 'asbplayer-foreground',
            message: { command: 'capture-visible-tab' },
        };

        const tabImageDataUrl = (await chrome.runtime.sendMessage(captureVisibleTabCommand)) as string;
        const videoElementPromises: Promise<VideoElement>[] = this._bindings.map(async (b) => {
            return {
                src: b.video.src,
                imageDataUrl: await b.cropAndResize(tabImageDataUrl),
            };
        });

        const videoElements: VideoElement[] = [];

        for (const p of videoElementPromises) {
            videoElements.push(await p);
        }

        const client = await this._prepareAndShowFrame();
        const themeType = await this._settings.getSingle('themeType');
        client.updateState({ open: true, themeType, videoElements, openedFromMiningCommand });
    }

    private async _prepareAndShowFrame() {
        this._frame.language = await this._settings.getSingle('language');
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage((message) => {
                if (message.command === 'confirm') {
                    client.updateState({ open: false });
                    this._frame.hide();
                    this._bindings
                        .find((b) => b.video.src === (message as VideoSelectModeConfirmMessage).selectedVideoElementSrc)
                        ?.showVideoDataDialog(false);
                } else if (message.command === 'openSettings') {
                    const openSettingsCommand: TabToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                        sender: 'asbplayer-video-tab',
                        message: {
                            command: 'open-asbplayer-settings',
                        },
                    };
                    chrome.runtime.sendMessage(openSettingsCommand);
                } else if (message.command === 'cancel') {
                    client.updateState({ open: false });
                    this._frame.hide();
                }
            });
        }

        this._frame.show();
        return client;
    }

    private async _hideUi() {
        if (this._frame.hidden) {
            return;
        }

        const client = await this._frame.client();
        client.updateState({ open: false });
        this._frame.hide();
    }
}
