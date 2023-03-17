import { CaptureVisibleTabMessage, ForegroundToExtensionCommand } from '@project/common';
import { VideoElement } from '../ui/components/VideoSelectUi';
import Binding from '../services/Binding';
import Settings from '../services/Settings';
import UiFrame from '../services/UiFrame';

export default class VideoSelectController {
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
                    <title>asbplayer - Video Select</title>
                </head>
                <body>
                <div id="root" style="width:100%;height:100vh;"></div>
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
                    this._trigger();
                    break;
                case 'copy-subtitle':
                case 'toggle-recording':
                case 'take-screenshot':
                    this._triggerIfNoSyncedVideo();
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
        }
    }

    private _triggerIfNoSyncedVideo() {
        if (this._bindings.find((b) => b.synced) === undefined) {
            this._trigger();
        }
    }

    private async _trigger() {
        if (this._bindings.length === 1) {
            const binding = this._bindings[0];

            if (binding.subscribed) {
                // Special case - show dialog for the one video element
                binding.showVideoDataDialog();
            }
        } else if (this._bindings.length > 1) {
            // Toggle on
            this._showUi();
        }
    }

    private async _showUi() {
        await this._frame.bind();
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

        this._frame.show();
        const client = await this._frame.client();

        client.onServerMessage((message) => {
            if (message.command === 'confirm') {
                client.updateState({ open: false });
                this._frame.hide();
                this._bindings.find((b) => b.video.src === message.selectedVideoElementSrc)?.showVideoDataDialog();
            } else if (message.command === 'cancel') {
                client.updateState({ open: false });
                this._frame.hide();
            }
        });

        const themeType = (await this._settings.get(['lastThemeType'])).lastThemeType;
        client.updateState({ open: true, themeType, videoElements });
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
