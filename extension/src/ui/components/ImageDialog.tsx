import React, { useEffect, useState, useLayoutEffect } from 'react';
import { makeStyles } from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import Dialog from '@material-ui/core/Dialog';
import { Image as CommonImage } from '@project/common';

interface ImageDimensions {
    width: number;
    height: number;
}

const useStyles = makeStyles((theme) => ({
    image: ({ width, height }: ImageDimensions) => ({
        width: width,
        height: height,
        backgroundSize: 'contain',
    }),
}));

// https://stackoverflow.com/questions/19014250/rerender-view-on-browser-resize-with-react
function useWindowSize() {
    const [size, setSize] = useState([0, 0]);

    useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
        }

        window.addEventListener('resize', updateSize);
        updateSize();

        return () => window.removeEventListener('resize', updateSize);
    }, []);

    return size;
}

interface Props {
    open: boolean;
    image?: CommonImage;
    onClose: () => void;
}

export default function ImageDialog({ open, image, onClose }: Props) {
    const [dataUrl, setDataUrl] = useState<string>();
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [windowWidth, windowHeight] = useWindowSize();

    let resizeRatio;

    if (width > 0 && height > 0) {
        resizeRatio = Math.min(1, Math.min(windowWidth / (2 * width), windowHeight / (2 * height)));
    } else {
        resizeRatio = 1;
    }

    const classes = useStyles({ width: width * resizeRatio, height: height * resizeRatio });

    useEffect(() => {
        setDataUrl(undefined);
        async function fetchImage() {
            if (!image) {
                return;
            }

            const dataUrl = await image.dataUrl();
            const img = new Image();
            img.onload = () => {
                setWidth(img.width);
                setHeight(img.height);
                setDataUrl(dataUrl);
            };
            img.src = dataUrl;
        }

        fetchImage();
    }, [image]);

    if (!image || !dataUrl) {
        return null;
    }

    return (
        <Dialog open={open} onBackdropClick={onClose} onEscapeKeyDown={onClose} maxWidth="lg">
            <Card>
                <CardMedia
                    className={classes.image}
                    image={dataUrl}
                    title={image.name}
                    style={{ width: width * resizeRatio, height: height * resizeRatio }}
                />
            </Card>
        </Dialog>
    );
}
