import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import { Fade } from '@material-ui/core';
import { ForwardedRef, useEffect, useState } from 'react';
import React from 'react';

interface Props {
    show: boolean;
    onLoadSubtitles: () => void;
    onShowMiningHistory: () => void;
}

const SidePanelTopControls = React.forwardRef(
    ({ show, onLoadSubtitles, onShowMiningHistory }: Props, ref: ForwardedRef<HTMLDivElement>) => {
        const [forceShow, setForceShow] = useState<boolean>(true);

        useEffect(() => {
            const timeoutId = setTimeout(() => setForceShow(false), 1000);
            return () => clearTimeout(timeoutId);
        }, []);

        return (
            <Fade in={show || forceShow}>
                {/* Box type is missing ref support */}
                {/* @ts-ignore */}
                <Box ref={ref} style={{ position: 'absolute', top: 0, right: 0 }}>
                    <Grid container direction="column">
                        <Grid item>
                            <IconButton onClick={onLoadSubtitles}>
                                <SubtitlesIcon />
                            </IconButton>
                        </Grid>
                        <Grid item>
                            <IconButton onClick={onShowMiningHistory}>
                                <ListIcon />
                            </IconButton>
                        </Grid>
                    </Grid>
                </Box>
            </Fade>
        );
    }
);

export default SidePanelTopControls;
