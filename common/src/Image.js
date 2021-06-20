class Base64ImageData {

    constructor(name, base64, extension) {
        this.name = name;
        this._base64 = base64;
        this.extension = extension;
    }

    async base64() {
        return this._base64;
    }

    async blob() {
        return await this._blob();
    }

    async _blob() {
        if (!this.cachedBlob) {
            this.cachedBlob = await (await fetch(this._dataUrl())).blob();
        }

        return this.cachedBlob;
    }

    async dataUrl() {
        return this._dataUrl();
    }

    _dataUrl() {
        return "data:image/" + this.extension + ";base64," + this._base64;
    }
}

class FileImageData {

    constructor(file, timestamp) {
        this.file = file;
        this.name = file.name + "_" + timestamp + ".jpeg";
        this.timestamp = timestamp;
    }

    async base64() {
        return new Promise(async (resolve, reject) => {
            const canvas = await this._canvas();
            const dataUrl = canvas.toDataURL('image/jpeg');
            resolve(dataUrl.substr(dataUrl.indexOf(',') + 1));
        });
    }

    async blob() {
        return new Promise(async (resolve, reject) => {
            const canvas = await this._canvas();
            canvas.toBlob((blob) => {
                this._blob = blob;
                resolve(blob)
            }, 'image/jpeg');
        });
    }

    async dataUrl() {
        const canvas = await this._canvas();
        return canvas.toDataURL();
    }

    async _canvas() {
        return new Promise((resolve, reject) => {
            const video = this._videoElement(this.file);

            video.oncanplay = async (e) => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas);
                URL.revokeObjectURL(video.src);
            };
        });
    }

    _videoElement(source) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(source);
        video.preload = "none";
        video.currentTime = this.timestamp / 1000;
        video.load();

        return video;
    }
}

export default class Image {

    constructor(data) {
        this.data = data;
    }

    static fromBase64(subtitleFileName, timestamp, base64, extension) {
        const imageName = subtitleFileName.substring(0, subtitleFileName.lastIndexOf(".")) + "_" + timestamp + "." + extension;
        return new Image(new Base64ImageData(imageName, base64, extension));
    }

    static fromFile(file, timestamp) {
        return new Image(new FileImageData(file, timestamp));
    }

    get name() {
        return this.data.name;
    }

    async base64() {
        return await this.data.base64();
    }

    async dataUrl() {
        return await this.data.dataUrl();
    }

    async download() {
        const blob = await this.data.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = this.data.name;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
}