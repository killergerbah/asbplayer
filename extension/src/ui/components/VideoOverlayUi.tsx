import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Bridge from '../Bridge';
import { createTheme } from './theme';

interface Props {
    bridge: Bridge;
}

export default function VideoOverlayUi({ bridge }: Props) {
    const theme = useMemo(() => createTheme('dark'), []);
    const [showAnkiButton, setShowAnkiButton] = useState<boolean>(false);
    const handleSubtitlesButton = useCallback(() => {
        bridge.sendServerMessage({ command: 'subtitles' });
    }, [bridge]);
    const handleAnkiButton = useCallback(() => {
        bridge.sendServerMessage({ command: 'anki' });
    }, [bridge]);
    useEffect(() => {
        return bridge.onStateUpdated(({ showAnkiButton }) => {
            setShowAnkiButton(showAnkiButton);
        });
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Fade in={true} timeout={150}>
                <Grid container direction="column" spacing={1}>
                    <Grid item>
                        <IconButton onClick={handleSubtitlesButton}>
                            <SubtitlesIcon />
                        </IconButton>
                    </Grid>
                    {showAnkiButton && (
                        <Grid item>
                            <IconButton onClick={handleAnkiButton}>
                                <NoteAddIcon />
                            </IconButton>
                        </Grid>
                    )}
                </Grid>
            </Fade>
        </ThemeProvider>
    );
}
