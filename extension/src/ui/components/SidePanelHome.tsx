import React from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { ChromeExtension } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import CenteredGridItem from './CenteredGridItem';
import CenteredGridContainer from './CenteredGridContainer';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import ListIcon from '@material-ui/icons/List';
import { ButtonGroup } from '@material-ui/core';

interface Props {
    extension: ChromeExtension;
    videoElementCount: number;
    onLoadSubtitles: () => void;
    onShowMiningHistory: () => void;
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

const SidePanelHome = ({ videoElementCount, onLoadSubtitles, onShowMiningHistory: onOpenMiningHistory }: Props) => {
    const { t } = useTranslation();

    return (
        <CenteredGridContainer direction="column">
            <CenteredGridItem>
                <VideoElementInfoText videoElementCount={videoElementCount} />
            </CenteredGridItem>
            <CenteredGridItem>
                <ButtonGroup variant="contained" color="secondary" orientation="vertical">
                    <Button startIcon={<SubtitlesIcon />} disabled={videoElementCount === 0} onClick={onLoadSubtitles}>
                        {t('action.loadSubtitles')}
                    </Button>
                    <Button startIcon={<ListIcon />} onClick={onOpenMiningHistory}>
                        {t('bar.miningHistory')}
                    </Button>
                </ButtonGroup>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

export default SidePanelHome;
