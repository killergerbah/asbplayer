import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createTheme } from './theme';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { PaletteType, ThemeProvider } from '@material-ui/core';
import Bridge from '../Bridge';
import { VideoSelectModeCancelMessage, VideoSelectModeConfirmMessage } from '@project/common';

interface Props {
    bridge: Bridge;
}

export interface VideoElement {
    src: string;
    imageDataUrl: string;
}

export default function VideoSelectUi({ bridge }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [themeType, setThemeType] = useState<string>('dark');
    const [videoElements, setVideoElements] = useState<VideoElement[]>([]);
    const [selectedVideoElementSrc, setSelectedVideoElementSrc] = useState<string>('');
    const theme = useMemo(() => createTheme(themeType as PaletteType), [themeType]);

    useEffect(() => {
        return bridge.onStateUpdated((state) => {
            if (state.open !== undefined) {
                setOpen(state.open);
            }

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }

            if (state.videoElements !== undefined) {
                setVideoElements(state.videoElements);
                setSelectedVideoElementSrc('');
            }
        });
    }, [bridge]);

    const handleConfirm = useCallback(() => {
        const message: VideoSelectModeConfirmMessage = {
            command: 'confirm',
            selectedVideoElementSrc,
        };

        bridge.sendServerMessage(message);
        setOpen(false);
    }, [bridge, selectedVideoElementSrc]);

    const handleCancel = useCallback(() => {
        const message: VideoSelectModeCancelMessage = {
            command: 'cancel',
        };
        bridge.sendServerMessage(message);
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Dialog open={open}>
                <DialogTitle>Multiple Video Elements Detected</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Multiple video elements detected on screen. Select a video element to sync it with asbplayer.
                    </DialogContentText>
                    <Grid container direction="column" spacing={2}>
                        <Grid item style={{ maxWidth: '100%' }}>
                            <TextField
                                select
                                fullWidth
                                color="secondary"
                                variant="filled"
                                label="Video Element"
                                value={selectedVideoElementSrc}
                                onChange={(e) => setSelectedVideoElementSrc(e.target.value)}
                            >
                                {videoElements.map((v) => (
                                    <MenuItem value={v.src} key={v.src}>
                                        <img style={{ maxWidth: 20, marginRight: 12 }} src={v.imageDataUrl} />
                                        {v.src}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item style={{ maxWidth: '100%' }}>
                            {selectedVideoElementSrc !== '' && (
                                <img
                                    style={{ width: '100%' }}
                                    src={videoElements.find((v) => v.src === selectedVideoElementSrc)!.imageDataUrl}
                                />
                            )}
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleConfirm}>OK</Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
}
