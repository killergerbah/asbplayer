import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Fade from '@material-ui/core/Fade';
import { ForwardedRef, useEffect, useState } from 'react';
import React from 'react';
import { Tooltip } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

interface Props {
    show: boolean;
    onLoadSubtitles: () => void;
    onShowMiningHistory: () => void;
}

const SidePanelTopControls = React.forwardRef(function SidePanelTopControls(
    { show, onLoadSubtitles, onShowMiningHistory }: Props,
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
                                <SubtitlesIcon />
                            </IconButton>
                        </Tooltip>
                    </Grid>
                    <Grid item>
                        <IconButton onClick={onShowMiningHistory}>
                            <Tooltip title={t('bar.miningHistory')!}>
                                <ListIcon />
                            </Tooltip>
                        </IconButton>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
    );
});

export default SidePanelTopControls;
