import { resizeCanvas } from './image-transformer';
import { CardModel, FileModel, ImageErrorCode } from './model';
import { download } from '../util/util';
import { isActiveBlobUrl } from '../blob-url';

const maxPrefixLength = 24;

const makeFileName = (prefix: string, timestamp: number) => {
    return `${prefix.replaceAll(' ', '_').substring(0, Math.min(prefix.length, maxPrefixLength))}_${Math.floor(
        timestamp
    )}`;
};

class Base64ImageData implements ImageData {
    private readonly _name: string;
    private readonly _timestamp: number;
    private readonly _base64: string;
    private readonly _extension: string;
    private readonly _error?: ImageErrorCode;

    private cachedBlob?: Blob;

    constructor(name: string, timestamp: number, base64: string, extension: string, error?: ImageErrorCode) {
        this._name = name;
        this._timestamp = timestamp;
        this._base64 = base64;
        this._extension = extension;
        this._error = error;
    }

    get name() {
        return this._name;
    }

    get timestamp() {
        return this._timestamp;
    }

    get extension() {
        return this._extension;
    }

    get error() {
        return this._error;
    }

    atTimestamp(_: number) {
        return this;
    }

    get canChangeTimestamp() {
        return false;
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

    private _dataUrl() {
        return 'data:image/' + this.extension + ';base64,' + this._base64;
    }

    dispose() {}
}

export class CancelledImageDataRenderingError extends Error {}

class FileImageData implements ImageData {
    private readonly _file: FileModel;
    private readonly _timestamp: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _name: string;
    private _video?: HTMLVideoElement;
    private _canvas?: HTMLCanvasElement;
    private _canvasPromise?: Promise<HTMLCanvasElement>;
    private _canvasPromiseReject?: (error: Error) => void;

    constructor(
        file: FileModel,
        timestamp: number,
        maxWidth: number,
        maxHeight: number,
        video?: HTMLVideoElement,
        canvas?: HTMLCanvasElement
    ) {
        this._file = file;
        this._name = `${makeFileName(file.name, timestamp)}.jpeg`;
        this._timestamp = timestamp;
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
        this._video = video;
        this._canvas = canvas;
    }

    get name() {
        return this._name;
    }

    get timestamp() {
        return this._timestamp;
    }

    get extension() {
        return 'jpeg';
    }

    get error(): ImageErrorCode | undefined {
        if (this._file.blobUrl) {
            return isActiveBlobUrl(this._file.blobUrl) ? undefined : ImageErrorCode.fileLinkLost;
        }

        return undefined;
    }

    atTimestamp(timestamp: number) {
        if (timestamp === this._timestamp) {
            return this;
        }

        this._canvasPromiseReject?.(new CancelledImageDataRenderingError());
        return new FileImageData(this._file, timestamp, this._maxWidth, this._maxHeight, this._video, this._canvas);
    }

    get canChangeTimestamp() {
        return true;
    }

    async base64(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._getCanvas()
                .then((canvas) => {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    resolve(dataUrl.substring(dataUrl.indexOf(',') + 1));
                })
                .catch(reject);
        });
    }

    async blob(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this._getCanvas()
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
        const canvas = await this._getCanvas();
        return canvas.toDataURL();
    }

    async _getCanvas(): Promise<HTMLCanvasElement> {
        if (this._canvasPromise) {
            return this._canvasPromise;
        }

        this._canvasPromise = new Promise(async (resolve, reject) => {
            this._canvasPromiseReject = reject;
            const video = await this._videoElement(this._file);
            const calculateCurrentTime = () => Math.max(0, Math.min(video.duration, this._timestamp / 1000));

            if (Number.isFinite(video.duration)) {
                video.currentTime = calculateCurrentTime();
            } else {
                video.onloadedmetadata = () => {
                    video.currentTime = calculateCurrentTime();
                    video.onloadedmetadata = null;
                };
            }

            video.onseeked = async () => {
                try {
                    this._canvasPromiseReject = undefined;

                    if (!this._canvas) {
                        this._canvas = document.createElement('canvas');
                    }

                    const canvas = this._canvas;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                    video.onseeked = null;

                    if (this._maxWidth > 0 || this._maxHeight > 0) {
                        await resizeCanvas(canvas, ctx!, this._maxWidth, this._maxHeight);
                        resolve(canvas);
                    } else {
                        resolve(canvas);
                    }
                } catch (e) {
                    reject(e);
                }
            };

            video.onerror = () => {
                reject(video.error?.message ?? 'Could not load video to obtain screenshot');
            };
        });

        return this._canvasPromise;
    }

    private async _videoElement(file: FileModel): Promise<HTMLVideoElement> {
        if (this._video) {
            return this._video;
        }

        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = file.blobUrl;
            video.preload = 'auto';
            video.autoplay = false;
            video.volume = 0;
            video.controls = false;
            video.pause();
            const t0 = Date.now();
            const interval = setInterval(() => {
                if (
                    (video.seekable.length > 0 && video.seekable.end(0) === video.duration) ||
                    Date.now() - t0 >= 5_000
                ) {
                    this._video = video;
                    clearInterval(interval);
                    resolve(video);
                }
            }, 100);
        });
    }

    dispose() {
        if (!this._video) {
            return;
        }

        this._video.removeAttribute('src');
        this._video.load();
        this._video.remove();
        this._video = undefined;
        this._canvas?.remove();
    }
}

interface ImageData {
    name: string;
    extension: string;
    timestamp: number;
    base64: () => Promise<string>;
    dataUrl: () => Promise<string>;
    blob: () => Promise<Blob>;
    atTimestamp: (timestamp: number) => ImageData;
    canChangeTimestamp: boolean;
    error?: ImageErrorCode;
    dispose: () => void;
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
                card.image.extension,
                card.image.error
            );
        }

        if (card.file) {
            return Image.fromFile(card.file, card.mediaTimestamp ?? card.subtitle.start, maxWidth, maxHeight);
        }

        return undefined;
    }

    static fromBase64(
        subtitleFileName: string,
        timestamp: number,
        base64: string,
        extension: string,
        error: ImageErrorCode | undefined
    ) {
        const prefix = subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.'));
        const imageName = `${makeFileName(prefix, timestamp)}.${extension}`;
        return new Image(new Base64ImageData(imageName, timestamp, base64, extension, error));
    }

    static fromFile(file: FileModel, timestamp: number, maxWidth: number, maxHeight: number) {
        return new Image(new FileImageData(file, timestamp, maxWidth, maxHeight));
    }

    get name() {
        return this.data.name;
    }

    get timestamp() {
        return this.data.timestamp;
    }

    get extension() {
        return this.data.extension;
    }

    get error() {
        return this.data.error;
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

    atTimestamp(timestamp: number) {
        return new Image(this.data.atTimestamp(timestamp));
    }

    get canChangeTimestamp() {
        return this.data.canChangeTimestamp;
    }

    dispose() {
        return this.data.dispose();
    }

    async download() {
        const blob = await this.data.blob();
        download(blob, this.data.name);
    }
}
