import { CropAndResizeMessage, ExtensionToVideoCommand } from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import Settings from './Settings';

export default class ImageCapturer {
    private readonly settings: Settings;
    private imageBase64Promise: Promise<void> | undefined;
    private imageBase64Resolve: ((value: void) => void) | undefined;
    private lastImageBase64?: string;
    private lastCaptureId?: string;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    consumeImage(): string | undefined {
        const base64 = this.lastImageBase64;
        this.lastImageBase64 = undefined;
        return base64;
    }

    capture(tabId: number, src: string, delay: number): Promise<void> {
        if (this.imageBase64Resolve !== undefined && this.imageBase64Promise !== undefined) {
            this._captureWithDelay(tabId, src, delay, this.imageBase64Resolve);
            return this.imageBase64Promise;
        }

        this.imageBase64Promise = new Promise((resolve, reject) => {
            this.imageBase64Resolve = resolve;
            this._captureWithDelay(tabId, src, delay, this.imageBase64Resolve);
        });

        return this.imageBase64Promise;
    }

    private _captureWithDelay(tabId: number, src: string, delay: number, resolve: (value: void) => void) {
        const captureId = uuidv4();
        this.lastCaptureId = captureId;
        setTimeout(() => {
            chrome.tabs.captureVisibleTab({ format: 'jpeg' }, async (dataUrl) => {
                if (captureId !== this.lastCaptureId) {
                    // The promise was already resolved by another call to capture with a shorter delay
                    return;
                }

                const croppedDataUrl = await this._cropAndResize(dataUrl, tabId, src);

                if (captureId !== this.lastCaptureId) {
                    // The promise was already resolved by another call to capture with a shorter delay
                    return;
                }

                this.lastImageBase64 = croppedDataUrl.substring(croppedDataUrl.indexOf(',') + 1);
                resolve();
                this.imageBase64Promise = undefined;
                this.imageBase64Resolve = undefined;
                this.lastCaptureId = undefined;
            });
        }, delay);
    }

    private _cropAndResize(dataUrl: string, tabId: number, src: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const cropScreenshot = (await this.settings.get(['cropScreenshot'])).cropScreenshot;

            if (!cropScreenshot) {
                resolve(dataUrl);
                return;
            }

            const cropAndResizeCommand: ExtensionToVideoCommand<CropAndResizeMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'crop-and-resize', dataUrl },
                src: src,
            };

            const response = await chrome.tabs.sendMessage(tabId, cropAndResizeCommand);
            resolve(response.dataUrl);
        });
    }
}
