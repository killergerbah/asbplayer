import React, { useEffect, useState, useLayoutEffect } from 'react';
import { makeStyles } from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import Dialog from '@material-ui/core/Dialog';

const useStyles = makeStyles((theme) => ({
    image: ({ width, height }) => ({
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

export default function ImageDialog(props) {
    const { open, image, onClose } = props;
    const [dataUrl, setDataUrl] = useState();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();
    const [windowWidth, windowHeight] = useWindowSize();

    let resizeRatio;

    if (width > 0 && height > 0) {
        resizeRatio = Math.min(1, Math.min(windowWidth / (2 * width), windowHeight / (2 * height)));
    } else {
        resizeRatio = 1;
    }

    const classes = useStyles({ width: width * resizeRatio, height: height * resizeRatio });

    useEffect(() => {
        if (!image) {
            return;
        }

        setDataUrl(null);
        async function fetchImage() {
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
