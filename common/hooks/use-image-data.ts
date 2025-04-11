import { CancelledImageDataRenderingError, Image as CommonImage } from '@project/common';
import { useEffect, useState } from 'react';

export const useImageData = ({ image, smoothTransition }: { image?: CommonImage; smoothTransition: boolean }) => {
    const [dataUrl, setDataUrl] = useState<string>('');
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);

    useEffect(() => {
        if (!smoothTransition) {
            setDataUrl('');
            setWidth(0);
            setHeight(0);
        }

        if (!image || image.error !== undefined) {
            return;
        }

        let img: HTMLImageElement | undefined;

        function fetchImage() {
            if (!image) {
                return;
            }

            image
                .dataUrl()
                .then((dataUrl) => {
                    img = new Image();
                    img.onload = () => {
                        if (!img) {
                            return;
                        }

                        setWidth(img.width);
                        setHeight(img.height);
                        setDataUrl(dataUrl);
                    };
                    img.src = dataUrl;
                })
                .catch((e) => {
                    if (!(e instanceof CancelledImageDataRenderingError)) {
                        throw e;
                    }
                });
        }

        fetchImage();

        return () => {
            if (img) {
                img.onload = null;
            }
        };
    }, [image, smoothTransition]);

    return { dataUrl, width, height };
};
