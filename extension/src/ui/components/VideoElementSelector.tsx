import { SettingsProvider } from '@project/common/settings';
import TabRegistry from '../../services/tab-registry';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { useEffect, useState } from 'react';
import { ActiveVideoElement } from '@project/common';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from 'react-i18next';

const settings = new SettingsProvider(new ExtensionSettingsStorage());
const tabRegistry = new TabRegistry(settings);

const useVideoElements = () => {
    const [videoElements, setVideoElements] = useState<ActiveVideoElement[]>([]);

    useEffect(() => {
        const updateVideoElements = () => tabRegistry.activeVideoElements().then(setVideoElements);
        const interval = setInterval(() => updateVideoElements(), 1000);
        updateVideoElements();
        return () => clearInterval(interval);
    });

    return videoElements;
};

interface Props {
    onVideoElementSelected: (element: ActiveVideoElement) => void;
}

const VideoElementSelector = ({ onVideoElementSelected }: Props) => {
    const { t } = useTranslation();
    const videoElements = useVideoElements();
    const [selectedVideoElement, setSelectedVideoElement] = useState<ActiveVideoElement>();
    return (
        <TextField
            select
            color="secondary"
            fullWidth
            value={selectedVideoElement?.src ?? ''}
            onChange={(e) => {
                const element = videoElements.find((v) => v.src === e.target.value);
                setSelectedVideoElement(element);

                if (element) {
                    onVideoElementSelected(element);
                }
            }}
            disabled={videoElements.length === 0}
            label={t('controls.selectVideoElement')!}
            helperText={videoElements.length === 0 ? t('landing.noVideoElementsDetected') : undefined}
        >
            {videoElements.map((v) => (
                <MenuItem key={v.src} value={v.src}>
                    {v.title}
                </MenuItem>
            ))}
        </TextField>
    );
};

export default VideoElementSelector;
