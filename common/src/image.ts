import { resizeCanvas } from './image-transformer';
import { CardModel, FileModel } from './model';
import { download } from '../util/util';
import { isActiveBlobUrl } from '../blob-url';

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

    isAvailable(): boolean {
        return true;
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
    private readonly _file: FileModel;
    private readonly _timestamp: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _name: string;

    constructor(file: FileModel, timestamp: number, maxWidth: number, maxHeight: number) {
        this._file = file;
        this._name = file.name + '_' + Math.floor(timestamp) + '.jpeg';
        this._timestamp = timestamp;
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
    }

    get name() {
        return this._name;
    }

    get extension() {
        return 'jpeg';
    }

    isAvailable(): boolean {
        if (this._file.blobUrl) {
            return isActiveBlobUrl(this._file.blobUrl);
        }

        return false;
    }

    async base64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._canvas()
                .then((canvas) => {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    resolve(dataUrl.substring(dataUrl.indexOf(',') + 1));
                })
                .catch(reject);
        });
    }

    async blob(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this._canvas()
                .then((canvas) => {
                    canvas.toBlob((blob) => {
                        if (blob === null) {
                            reject(new Error('Could not obtain blob'));
                        } else {
                            resolve(blob);
                        }
                    }, 'image/jpeg');
                })
                .catch(reject);
        });
    }

    async dataUrl() {
        const canvas = await this._canvas();
        return canvas.toDataURL();
    }

    async _canvas(): Promise<HTMLCanvasElement> {
        return new Promise(async (resolve, reject) => {
            const video = this._videoElement(this._file);

            video.oncanplay = async (e) => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                if (this._maxWidth > 0 || this._maxHeight > 0) {
                    await resizeCanvas(canvas, ctx!, this._maxWidth, this._maxHeight);
                    resolve(canvas);
                } else {
                    resolve(canvas);
                }
            };

            video.onerror = () => {
                reject(video.error?.message ?? 'Could not load video to obtain screenshot');
            };
        });
    }

    _videoElement(file: FileModel) {
        const video = document.createElement('video');
        video.src = file.blobUrl;
        video.preload = 'metadata';
        video.currentTime = this._timestamp / 1000;

        return video;
    }
}

class MissingFileImageData implements ImageData {
    private readonly _name: string;

    constructor(fileName: string, timestamp: number) {
        this._name = `${fileName}_${Math.floor(timestamp)}`;
    }

    get name() {
        return this._name;
    }

    get extension() {
        return 'jpeg';
    }

    isAvailable() {
        return false;
    }

    base64(): Promise<string> {
        throw new Error('Not supported');
    }

    dataUrl(): Promise<string> {
        throw new Error('Not supported');
    }

    blob(): Promise<Blob> {
        throw new Error('Not supported');
    }
}

interface ImageData {
    name: string;
    extension: string;
    base64: () => Promise<string>;
    dataUrl: () => Promise<string>;
    blob: () => Promise<Blob>;
    isAvailable: () => boolean;
}

export default class Image {
    private readonly data: ImageData;

    constructor(data: ImageData) {
        this.data = data;
    }

    static fromCard(card: CardModel, maxWidth: number, maxHeight: number) {
        if (card.image) {
            return Image.fromBase64(
                card.subtitleFileName,
                card.subtitle.start,
                card.image.base64,
                card.image.extension
            );
        }

        if (card.file) {
            return Image.fromFile(card.file, card.mediaTimestamp ?? card.subtitle.start, maxWidth, maxHeight);
        }

        return undefined;
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

    static fromFile(file: FileModel, timestamp: number, maxWidth: number, maxHeight: number) {
        return new Image(new FileImageData(file, timestamp, maxWidth, maxHeight));
    }

    static fromMissingFile(fileName: string, timestamp: number) {
        return new Image(new MissingFileImageData(fileName, timestamp));
    }

    get name() {
        return this.data.name;
    }

    get extension() {
        return this.data.extension;
    }

    isAvailable() {
        return this.data.isAvailable();
    }

    async base64() {
        return await this.data.base64();
    }

    async dataUrl() {
        return await this.data.dataUrl();
    }

    async blob() {
        return await this.data.blob();
    }

    async pngBlob() {
        return new Promise<Blob>(async (resolve, reject) => {
            try {
                createImageBitmap(await this.blob()).then((bitMap) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = bitMap.width;
                    canvas.height = bitMap.height;
                    canvas.getContext('2d')!.drawImage(bitMap, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject('Failed to convert to PNG');
                        }
                    }, 'image/png');
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async download() {
        const blob = await this.data.blob();
        download(blob, this.data.name);
    }
}
