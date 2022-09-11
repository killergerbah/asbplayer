import { CanvasResizer, CropAndResizeMessage, ExtensionToVideoCommand } from '@project/common';
import { RectModel } from '@project/common';
import Settings from './Settings';

export default class ImageCapturer {
    private readonly settings: Settings;
    private readonly canvasResizer: CanvasResizer;
    public lastImageBase64?: string;

    constructor(settings: Settings) {
        this.settings = settings;
        this.canvasResizer = new CanvasResizer();
    }

    capture(rect: RectModel, maxWidth: number, maxHeight: number, tabId: number, src: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            chrome.tabs.captureVisibleTab({ format: 'jpeg' }, async (dataUrl) => {
                const croppedDataUrl = await this._cropAndResize(dataUrl, rect, maxWidth, maxHeight, tabId, src);
                this.lastImageBase64 = croppedDataUrl.substring(croppedDataUrl.indexOf(',') + 1);
                resolve(this.lastImageBase64);
            });
        });
    }

    _cropAndResize(
        dataUrl: string,
        rect: RectModel,
        maxWidth: number,
        maxHeight: number,
        tabId: number,
        src: string
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const cropScreenshot = (await this.settings.get(['cropScreenshot'])).cropScreenshot;

            if (!cropScreenshot) {
                resolve(dataUrl);
                return;
            }

            const cropAndResizeCommand: ExtensionToVideoCommand<CropAndResizeMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'crop-and-resize', dataUrl, rect, maxWidth, maxHeight },
                src: src,
            };

            const response = await chrome.tabs.sendMessage(tabId, cropAndResizeCommand);
            resolve(response.dataUrl);
        });
    }
}
