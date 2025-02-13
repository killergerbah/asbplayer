import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import LoadSubtitlesIcon from '@project/common/components/LoadSubtitlesIcon';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import { ForwardedRef, useEffect, useState } from 'react';
import React from 'react';
import Tooltip from '@project/common/components/Tooltip';
import { useTranslation } from 'react-i18next';

interface Props {
    show: boolean;
    canDownloadSubtitles: boolean;
    onLoadSubtitles: () => void;
    onDownloadSubtitles: () => void;
    onShowMiningHistory: () => void;
}

const SidePanelTopControls = React.forwardRef(function SidePanelTopControls(
    { show, canDownloadSubtitles, onLoadSubtitles, onDownloadSubtitles, onShowMiningHistory }: Props,
    ref: ForwardedRef<HTMLDivElement>
) {
    const { t } = useTranslation();
    const [forceShow, setForceShow] = useState<boolean>(true);

    useEffect(() => {
        const timeoutId = setTimeout(() => setForceShow(false), 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <Fade in={show || forceShow}>
            {/* Box type is missing ref support */}
            {/* @ts-ignore */}
            <Box ref={ref} style={{ position: 'absolute', top: 12, right: 12 }}>
                <Grid container direction="column">
                    <Grid item>
                        <Tooltip title={t('action.loadSubtitles')!}>
                            <IconButton onClick={onLoadSubtitles}>
                                <LoadSubtitlesIcon />
                            </IconButton>
                        </Tooltip>
                    </Grid>
                    {canDownloadSubtitles && (
                        <Grid item>
                            <Tooltip title={t('action.downloadSubtitlesAsSrt')!}>
                                <IconButton onClick={onDownloadSubtitles}>
                                    <SaveAltIcon />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    )}
                    <Grid item>
                        <IconButton onClick={onShowMiningHistory}>
                            <Tooltip title={t('bar.miningHistory')!}>
                                <HistoryIcon />
                            </Tooltip>
                        </IconButton>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
    );
});

export default SidePanelTopControls;
