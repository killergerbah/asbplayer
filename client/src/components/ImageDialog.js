import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/styles';
import { useWindowSize } from '../hooks/useWindowSize';

import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import Dialog from '@material-ui/core/Dialog';

const useStyles = makeStyles((theme) => ({
    image: ({width, height}) => ({
        width: width,
        height: height,
        backgroundSize: 'contain'
    })
}));

export default function ImageDialog(props) {
    const {open, image, onClose} = props;
    const [dataUrl, setDataUrl] = useState();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();
    const [windowWidth, windowHeight] = useWindowSize(true);

    let resizeRatio;

    if (width > 0 && height > 0) {
        resizeRatio = Math.min(1, Math.min(windowWidth / (2 * width), windowHeight / (2 * height)));
    } else {
        resizeRatio = 1;
    }

    const classes = useStyles({width: width * resizeRatio, height: height * resizeRatio});

    useEffect(() => {
        if (!image) {
            return;
        }

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

    useEffect(() => {
        if (!open) {
            setWidth(0);
            setHeight(0);
            setDataUrl(null);
        }
    }, [open]);

    if (!image) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onBackdropClick={() => onClose()}
            maxWidth='lg'
        >
            <Card>
                <CardMedia
                    className={classes.image}
                    image={dataUrl}
                    title={image.name}
                    style={{width: width * resizeRatio, height: height * resizeRatio}}
                />
            </Card>
        </Dialog>
    );
}
