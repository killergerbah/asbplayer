import { FileModel } from './model';

// For certain Chromium/hardware configurations it's not possible to seek a temporary media element
// to certain timestamps.
// For now the workaround is to try nearby timestamps until seeking succeeds.
export const mediaElementAtApproximateTimestamp = async <T extends HTMLMediaElement>(
    blobUrl: string,
    timestamp: number,
    factory: () => T,
    metadataCallback?: (elm: T) => void
) => {
    let lastError: any;
    let currTimestamp = timestamp;

    for (let attempt = 0; attempt < 10; ++attempt) {
        try {
            return await mediaElementAtTimestamp(blobUrl, currTimestamp, factory, metadataCallback);
        } catch (e) {
            console.log('Failed to obtain media element at timestamp ' + timestamp + '; retrying');
            lastError = e;
            currTimestamp -= 50;
        }
    }

    throw lastError;
};

const mediaElementAtTimestamp = <T extends HTMLMediaElement>(
    blobUrl: string,
    timestamp: number,
    factory: () => T,
    metadataCallback?: (elm: T) => void
): Promise<T> => {
    return new Promise((resolve, reject) => {
        const elm = factory();
        elm.src = blobUrl;
        elm.preload = 'metadata';
        elm.autoplay = false;
        elm.controls = false;
        elm.pause();

        if (timestamp === 0) {
            resolve(elm);
        } else {
            const calculateCurrentTime = () => Math.max(0, Math.min(elm.duration, timestamp / 1000));

            if (Number.isFinite(elm.duration)) {
                elm.currentTime = calculateCurrentTime();
            } else {
                elm.onloadedmetadata = () => {
                    metadataCallback?.(elm);
                    elm.currentTime = calculateCurrentTime();
                    elm.onloadedmetadata = null;
                };
            }
            elm.onseeked = () => resolve(elm);
            elm.onerror = () => {
                reject(elm.error?.message ?? 'Could not load media element to extract audio/screenshot');
                elm.removeAttribute('src');
                elm.load();
                elm.remove();
            };
        }
    });
};
