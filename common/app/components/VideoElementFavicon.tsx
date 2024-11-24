import React from 'react';
import { VideoTabModel } from '../..';
import { useTheme } from '@material-ui/core/styles';

const VideoElementFavicon = ({ videoElement }: { videoElement: VideoTabModel }) => {
    const theme = useTheme();
    return (
        <>
            {videoElement.faviconUrl && (
                <img src={videoElement.faviconUrl} style={{ width: 24, marginRight: theme.spacing(1) }} />
            )}
        </>
    );
};

export default VideoElementFavicon;