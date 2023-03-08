import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createTheme } from './theme';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import Bridge from '../Bridge';
import { PaletteType, ThemeProvider } from '@material-ui/core';
import { VideoSelectModeConfirmMessage } from '@project/common';

interface Props {
    bridge: Bridge;
}

export default function VideoSelectModeUi({ bridge }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [themeType, setThemeType] = useState<string>('dark');
    const [doNotShowDialogAgain, setDoNotShowDialogAgain] = useState<boolean>(true);
    const theme = useMemo(() => createTheme(themeType as PaletteType), [themeType]);

    useEffect(() => {
        return bridge.onStateUpdated((state) => {
            if (state.open !== undefined) {
                setOpen(state.open);
            }

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }
        });
    }, [bridge]);

    const handleShowDialogAgainToggled = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDoNotShowDialogAgain(event.target.checked);
    };

    const handleConfirm = useCallback(() => {
        const message: VideoSelectModeConfirmMessage = {
            command: 'confirm',
            doNotShowDialogAgain: doNotShowDialogAgain,
        };

        bridge.sendServerMessage(message);
        setOpen(false);
    }, [bridge, doNotShowDialogAgain]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Dialog open={open}>
                <DialogTitle>Multiple Video Elements Detected</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Multiple video elements detected on screen. Click on a video element to sync it with asbplayer.
                    </DialogContentText>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox checked={doNotShowDialogAgain} onChange={handleShowDialogAgainToggled} />
                            }
                            label="Don't show this dialog again."
                        />
                    </FormGroup>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleConfirm}>OK</Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
}
