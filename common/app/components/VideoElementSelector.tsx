import { useState } from 'react';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from 'react-i18next';
import { VideoTabModel } from '../..';
import { useTheme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';

interface Props {
    onVideoElementSelected: (element: VideoTabModel) => void;
    videoElements: VideoTabModel[];
}

const Favicon = ({ videoElement }: { videoElement: VideoTabModel }) => {
    const theme = useTheme();
    return (
        <>
            {videoElement.faviconUrl && (
                <img src={videoElement.faviconUrl} style={{ width: 24, marginRight: theme.spacing(1) }} />
            )}
        </>
    );
};

const VideoElementSelector = ({ videoElements, onVideoElementSelected }: Props) => {
    const { t } = useTranslation();
    const [selectedVideoElement, setSelectedVideoElement] = useState<VideoTabModel>();

    if (videoElements.length === 1) {
        const videoElement = videoElements[0];
        return (
            <Button variant="outlined" style={{ width: '100%' }} onClick={() => onVideoElementSelected(videoElement)}>
                <Favicon videoElement={videoElement} />
                {videoElement.title}
            </Button>
        );
    }

    return (
        <TextField
            select
            variant="outlined"
            size="small"
            color="secondary"
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
                    <Favicon videoElement={v} />
                    {v.title}
                </MenuItem>
            ))}
        </TextField>
    );
};

export default VideoElementSelector;
