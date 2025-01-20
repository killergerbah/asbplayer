import React, { useState, useLayoutEffect } from 'react';
import makeStyles from '@material-ui/styles/makeStyles';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import { Image as CommonImage } from '@project/common';
import { useImageData } from '../hooks/use-image-data';
import Slider from '@material-ui/core/Slider';
import Modal from '@material-ui/core/Modal';
import { humanReadableTime } from '../util';
import Tooltip from '@material-ui/core/Tooltip';

interface ImageDimensions {
    width: number;
    height: number;
}

const useStyles = makeStyles(() => ({
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
    interval?: number[];
    onClose: () => void;
    onTimestampChange: (timestamp: number) => void;
}

interface ValueLabelComponentProps {
    children: React.ReactElement;
    open: boolean;
    value: number;
}

const ValueLabelComponent = ({ children, open, value }: ValueLabelComponentProps) => {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="bottom" title={value}>
            {children}
        </Tooltip>
    );
};

export default function ImageDialog({ open, image, interval, onClose, onTimestampChange }: Props) {
    const { width, height, dataUrl } = useImageData({ image, smoothTransition: true });
    const [windowWidth, windowHeight] = useWindowSize();

    let resizeRatio;

    if (width > 0 && height > 0) {
        resizeRatio = Math.min(1, Math.min(windowWidth / (2 * width), windowHeight / (2 * height)));
    } else {
        resizeRatio = 1;
    }

    const classes = useStyles({ width: width * resizeRatio, height: height * resizeRatio });

    if (!image || !dataUrl || !open) {
        return null;
    }

    return (
        <div>
            <Modal disableRestoreFocus style={{ width: '100vw', height: '100vh' }} open={open} onClose={onClose}>
                <div
                    style={{
                        position: 'absolute',
                        width: width * resizeRatio,
                        height: height * resizeRatio,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <Card>
                        <CardMedia className={classes.image} image={dataUrl} title={image.name} style={{}} />
                    </Card>
                    {interval && image.canChangeTimestamp && (
                        <Slider
                            color="secondary"
                            value={image.timestamp}
                            min={interval[0]}
                            max={interval[1]}
                            onChange={(e: React.ChangeEvent<{}>, newValue: number | number[]) => {
                                const duration = interval[1] - interval[0];
                                onTimestampChange(((newValue as number) / duration) * duration);
                            }}
                            valueLabelFormat={(v) => humanReadableTime(v, true)}
                            valueLabelDisplay="on"
                            ValueLabelComponent={ValueLabelComponent}
                            track={false}
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
}
