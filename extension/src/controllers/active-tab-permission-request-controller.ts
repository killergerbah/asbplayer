import { RequestingActiveTabPermsisionMessage, VideoToExtensionCommand } from '@project/common';
import Binding from '../services/binding';
import { fetchLocalization } from '../services/localization-fetcher';
import UiFrame from '../services/ui-frame';
import FrameBridgeClient from '../services/frame-bridge-client';

export default class ActiveTabPermissionRequestController {
    private readonly _context: Binding;
    private readonly _frame: UiFrame;
    private _client?: FrameBridgeClient;

    constructor(context: Binding) {
        this._context = context;
        this._frame = new UiFrame(
            async (lang) => `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>asbplayer - Request Active Tab Permission</title>
        </head>
        <body>
        <div id="root" style="width:100%;height:100vh;"></div>
        <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(lang))}</script>
        <script src="${chrome.runtime.getURL('./active-tab-permission-request-ui.js')}"></script>
        </body>
    </html>`
        );
    }

    onPermissionGranted() {
        this._client?.updateState({ permissionGranted: true });
    }

    async show() {
        this._frame.language = await this._context.settings.getSingle('language');
        const isNewClient = await this._frame.bind();
        this._client?.unbind();
        this._client = await this._frame.client();

        if (isNewClient) {
            this._client.onMessage((message) => {
                if (message.command === 'close') {
                    this._frame.hide();
                    this._notifyRequesting(false);
                }
            });
        }

        this._frame.show();
        this._client.updateState({ themeType: await this._context.settings.getSingle('themeType') });
        this._context.pause();
        this._notifyRequesting(true);
    }

    private _notifyRequesting(requesting: boolean) {
        const command: VideoToExtensionCommand<RequestingActiveTabPermsisionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'requesting-active-tab-permission',
                requesting,
            },
            src: this._context.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    unbind() {
        this._client?.unbind();
    }
}
