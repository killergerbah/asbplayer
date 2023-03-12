import { CssBaseline, Grid, IconButton, ThemeProvider } from '@material-ui/core';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import React, { useCallback, useMemo } from 'react';
import Bridge from '../Bridge';
import { createTheme } from './theme';

interface Props {
    bridge: Bridge;
}

export default function VideoOverlayUi({ bridge }: Props) {
    const theme = useMemo(() => createTheme('dark'), []);
    const handleSubtitlesButton = useCallback(() => {
        bridge.sendServerMessage({ command: 'subtitles' });
    }, [bridge]);
    const handleAnkiButton = useCallback(() => {
        bridge.sendServerMessage({ command: 'anki' });
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Grid container direction="column" spacing={2}>
                <Grid item>
                    <IconButton onClick={handleSubtitlesButton}>
                        <SubtitlesIcon />
                    </IconButton>
                </Grid>
                <Grid item>
                    <IconButton onClick={handleAnkiButton}>
                        <NoteAddIcon />
                    </IconButton>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}
