import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { AsbPlayerToTabCommand, LoadSubtitlesMessage, VideoTabModel } from '@project/common';
import { ChromeExtension } from '@project/common/app';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CenteredGridItem from './CenteredGridItem';
import CenteredGridContainer from './CenteredGridContainer';

interface Props {
    extension: ChromeExtension;
    currentTabId: number;
    videoElementCount: number;
}

const VideoElementInfoText = ({ videoElementCount }: { videoElementCount: number }) => {
    const { t } = useTranslation();
    return (
        <Box p={3}>
            <Typography variant="h6">
                {videoElementCount === 0 ? t('landing.noVideoElementsDetected') : t('landing.videoElementsDetected')}
            </Typography>
        </Box>
    );
};

const SidePanelHome = ({ currentTabId, videoElementCount }: Props) => {
    const { t } = useTranslation();

    const handleLoadSubtitles = useCallback(() => {
        if (currentTabId === undefined) {
            return;
        }

        const message: AsbPlayerToTabCommand<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: currentTabId,
        };
        chrome.runtime.sendMessage(message);
    }, [currentTabId]);

    return (
        <CenteredGridContainer>
            <CenteredGridItem>
                <VideoElementInfoText videoElementCount={videoElementCount} />
            </CenteredGridItem>
            <CenteredGridItem>
                <Button
                    variant="contained"
                    color="secondary"
                    disabled={videoElementCount === 0}
                    onClick={handleLoadSubtitles}
                >
                    {t('action.loadSubtitles')}
                </Button>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

export default SidePanelHome;
