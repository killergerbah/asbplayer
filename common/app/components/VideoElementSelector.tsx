import { useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { VideoTabModel } from '../..';
import Button from '@mui/material/Button';
import VideoElementFavicon from './VideoElementFavicon';

interface Props {
    onVideoElementSelected: (element: VideoTabModel) => void;
    videoElements: VideoTabModel[];
}

const VideoElementSelector = ({ videoElements, onVideoElementSelected }: Props) => {
    const { t } = useTranslation();
    const [selectedVideoElement, setSelectedVideoElement] = useState<VideoTabModel>();

    if (videoElements.length === 1) {
        const videoElement = videoElements[0];
        return (
            <Button variant="outlined" style={{ width: '100%' }} onClick={() => onVideoElementSelected(videoElement)}>
                <VideoElementFavicon videoElement={videoElement} />
                {videoElement.title}
            </Button>
        );
    }

    return (
        <TextField
            select
            variant="outlined"
            size="small"
            color="primary"
            style={{ width: '100%' }}
            value={selectedVideoElement?.src ?? ''}
            onChange={(e) => {
                const element = videoElements.find((v) => v.src === e.target.value);
                setSelectedVideoElement(element);

                if (element) {
                    onVideoElementSelected(element);
                }
            }}
            disabled={videoElements.length === 0}
            label={t('controls.selectVideoElement')}
            helperText={videoElements.length === 0 ? t('landing.noVideoElementsDetected') : undefined}
        >
            {videoElements.map((v) => (
                <MenuItem key={v.src} value={v.src}>
                    <VideoElementFavicon videoElement={v} />
                    {v.title}
                </MenuItem>
            ))}
        </TextField>
    );
};

export default VideoElementSelector;
