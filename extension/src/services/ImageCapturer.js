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
                canvas.width = rect.width;
                canvas.height = rect.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
                resolve(canvas.toDataURL('image/jpeg'));
            };

            image.src = dataUrl;
        });
    }
}