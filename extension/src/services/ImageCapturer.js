export default class ImageCapturer {

    constructor(settings) {
        this.settings = settings;
    }

    capture(rect) {
        return new Promise(async (resolve, reject) => {
            chrome.tabs.captureVisibleTab(
                null,
                {format: 'jpeg'},
                async (dataUrl) => {
                    const croppedDataUrl = await this._crop(dataUrl, rect);
                    resolve(croppedDataUrl.substr(croppedDataUrl.indexOf(',') + 1));
                }
            );
        });
    }

    _crop(dataUrl, rect) {
        return new Promise(async (resolve, reject) => {
            const cropScreenshot = (await this.settings.get(['cropScreenshot'])).cropScreenshot;

            if (!cropScreenshot) {
                resolve(dataUrl);
            }

            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const r = window.devicePixelRatio;
                const width = rect.width * r;
                const height = rect.height * r;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, rect.left * r, rect.top * r, width, height, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg'));
            };

            image.src = dataUrl;
        });
    }
}