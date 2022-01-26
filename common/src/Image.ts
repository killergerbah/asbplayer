import CanvasResizer from './CanvasResizer';

class Base64ImageData implements ImageData {
    private readonly _name: string;
    private readonly _base64: string;
    private readonly _extension: string;

    private cachedBlob?: Blob;

    constructor(name: string, base64: string, extension: string) {
        this._name = name;
        this._base64 = base64;
        this._extension = extension;
    }

    get name() {
        return this._name;
    }

    get extension() {
        return this._extension;
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
        return 'data:image/' + this.extension + ';base64,' + this._base64;
    }
}

class FileImageData implements ImageData {
    private readonly file: File;
    private readonly timestamp: number;
    private readonly maxWidth: number;
    private readonly maxHeight: number;
    private readonly _name: string;

    constructor(file: File, timestamp: number, maxWidth: number, maxHeight: number) {
        this.file = file;
        this._name = file.name + '_' + Math.floor(timestamp) + '.jpeg';
        this.timestamp = timestamp;
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
    }

    get name() {
        return this._name;
    }

    async base64(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const canvas = await this._canvas();
            const dataUrl = canvas.toDataURL('image/jpeg');
            resolve(dataUrl.substring(dataUrl.indexOf(',') + 1));
        });
    }

    async blob(): Promise<Blob> {
        return new Promise(async (resolve, reject) => {
            const canvas = await this._canvas();
            canvas.toBlob((blob) => {
                if (blob === null) {
                    reject(new Error('Could not obtain blob'));
                } else {
                    resolve(blob);
                }
            }, 'image/jpeg');
        });
    }

    async dataUrl() {
        const canvas = await this._canvas();
        return canvas.toDataURL();
    }

    async _canvas(): Promise<HTMLCanvasElement> {
        return new Promise(async (resolve, reject) => {
            const video = this._videoElement(this.file);

            video.oncanplay = async (e) => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                if (this.maxWidth > 0 || this.maxHeight > 0) {
                    const resizer = new CanvasResizer();
                    await resizer.resize(canvas, ctx!, this.maxWidth, this.maxHeight);
                    resolve(canvas);
                } else {
                    resolve(canvas);
                }
                URL.revokeObjectURL(video.src);
            };
        });
    }

    _videoElement(source: File) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(source);
        video.preload = 'none';
        video.currentTime = this.timestamp / 1000;
        video.load();

        return video;
    }
}

interface ImageData {
    name: string;
    base64: () => Promise<string>;
    dataUrl: () => Promise<string>;
    blob: () => Promise<Blob>;
}

export default class Image {
    private readonly data: ImageData;

    constructor(data: ImageData) {
        this.data = data;
    }

    static fromBase64(subtitleFileName: string, timestamp: number, base64: string, extension: string) {
        const imageName =
            subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')) +
            '_' +
            Math.floor(timestamp) +
            '.' +
            extension;
        return new Image(new Base64ImageData(imageName, base64, extension));
    }

    static fromFile(file: File, timestamp: number, maxWidth: number, maxHeight: number) {
        return new Image(new FileImageData(file, timestamp, maxWidth, maxHeight));
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
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = this.data.name;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
}
