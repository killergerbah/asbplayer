import { CropAndResizeMessage, ExtensionToVideoCommand, ImageCaptureParams, RectModel } from '@project/common';
import Settings from './settings';

export interface CaptureOptions {
    maxWidth: number;
    maxHeight: number;
    rect: RectModel;
    frameId?: string;
}

export default class ImageCapturer {
    private readonly settings: Settings;
    private imageBase64Promise: Promise<string> | undefined;
    private imageBase64Resolve: ((value: string) => void) | undefined;
    private lastCaptureTimeoutId?: NodeJS.Timeout;

    private _lastImageBase64?: string;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    get lastImageBase64() {
        return this._lastImageBase64;
    }

    capture(tabId: number, src: string, delay: number, captureParams: ImageCaptureParams): Promise<string> {
        this._lastImageBase64 = undefined;

        if (this.imageBase64Resolve !== undefined && this.imageBase64Promise !== undefined) {
            this._captureWithDelay(tabId, src, delay, captureParams, this.imageBase64Resolve);
            return this.imageBase64Promise;
        }

        this.imageBase64Promise = new Promise((resolve, reject) => {
            this.imageBase64Resolve = resolve;
            this._captureWithDelay(tabId, src, delay, captureParams, this.imageBase64Resolve);
        });

        return this.imageBase64Promise;
    }

    private _captureWithDelay(
        tabId: number,
        src: string,
        delay: number,
        captureParams: ImageCaptureParams,
        resolve: (value: string) => void
    ) {
        const timeoutId = setTimeout(() => {
            chrome.tabs.captureVisibleTab({ format: 'jpeg' }, async (dataUrl) => {
                if (timeoutId !== this.lastCaptureTimeoutId) {
                    // The promise was already resolved by another call to capture with a shorter delay
                    return;
                }

                const croppedDataUrl = await this._cropAndResize(dataUrl, tabId, src, captureParams);

                if (timeoutId !== this.lastCaptureTimeoutId) {
                    // The promise was already resolved by another call to capture with a shorter delay
                    return;
                }

                this._lastImageBase64 = croppedDataUrl.substring(croppedDataUrl.indexOf(',') + 1);
                resolve(this._lastImageBase64);
                this.imageBase64Promise = undefined;
                this.imageBase64Resolve = undefined;
                this.lastCaptureTimeoutId = undefined;
            });
        }, delay);
        this.lastCaptureTimeoutId = timeoutId;
    }

    private _cropAndResize(
        dataUrl: string,
        tabId: number,
        src: string,
        imageCaptureParams: ImageCaptureParams
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const cropScreenshot = await this.settings.getSingle('cropScreenshot');

            if (!cropScreenshot) {
                resolve(dataUrl);
                return;
            }

            const cropAndResizeCommand: ExtensionToVideoCommand<CropAndResizeMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'crop-and-resize', dataUrl, ...imageCaptureParams },
                src: src,
            };

            const response = await chrome.tabs.sendMessage(tabId, cropAndResizeCommand);
            resolve(response.dataUrl);
        });
    }
}
