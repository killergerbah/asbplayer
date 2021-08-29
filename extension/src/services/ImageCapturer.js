import { CanvasResizer } from '@project/common'

export default class ImageCapturer {

    constructor(settings) {
        this.settings = settings;
        this.canvasResizer = new CanvasResizer();
    }

    capture(rect, maxWidth, maxHeight) {
        return new Promise(async (resolve, reject) => {
            chrome.tabs.captureVisibleTab(
                null,
                {format: 'jpeg'},
                async (dataUrl) => {
                    const croppedDataUrl = await this._cropAndResize(dataUrl, rect, maxWidth, maxHeight);
                    this.lastImageBase64 = croppedDataUrl.substr(croppedDataUrl.indexOf(',') + 1);
                    resolve(this.lastImageBase64);
                }
            );
        });
    }

    _cropAndResize(dataUrl, rect, maxWidth, maxHeight) {
        return new Promise(async (resolve, reject) => {
            const cropScreenshot = (await this.settings.get(['cropScreenshot'])).cropScreenshot;

            if (!cropScreenshot) {
                resolve(dataUrl);
            }

            const image = new Image();
            image.onload = async () => {
                const canvas = document.createElement('canvas');
                const r = window.devicePixelRatio;
                const width = rect.width * r;
                const height = rect.height * r;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, rect.left * r, rect.top * r, width, height, 0, 0, width, height);

                if (maxWidth > 0 || maxHeight > 0) {
                    try {
                        await this.canvasResizer.resize(canvas, ctx, maxWidth, maxHeight);
                        resolve(canvas.toDataURL('image/jpeg'));
                    } catch(e) {
                        reject(e);
                    }
                } else {
                    resolve(canvas.toDataURL('image/jpeg'));
                }
            };

            image.src = dataUrl;
        });
    }
}