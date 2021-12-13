import CssBaseline from '@material-ui/core/CssBaseline';
import Snackbar from '@material-ui/core/Snackbar';
import { ThemeProvider } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import SubtitleSyncDialog from './SubtitleSyncDialog';
import { createTheme } from './theme';

export default function SubtitleSyncUi({ bridge }) {
    const [open, setOpen] = useState(false);
    const [tracks, setTracks] = useState([]);
    const [selected, setSelected] = useState('');
    const [alertSeverity, setAlertSeverity] = useState();
    const [alertOpen, setAlertOpen] = useState(false);
    const [alert, setAlert] = useState();
    const [themeType, setThemeType] = useState('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);
    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.finished({ command: 'cancel' });
    }, [bridge]);
    const handleClosedAlert = useCallback(() => {
        setAlertOpen(false);
        bridge.finished({ command: 'alert' });
    }, [bridge]);
    const handleConfirm = useCallback(
        (track) => {
            setOpen(false);
            bridge.finished({ command: 'select', track });
        },
        [bridge]
    );

    useEffect(() => {
        bridge.onStateUpdated((state) => {
            if (Object.prototype.hasOwnProperty.call(state, 'open')) {
                setOpen(state.open);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'tracks')) {
                setTracks(state.tracks);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'selected')) {
                setSelected(state.selected);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'severity')) {
                setAlertSeverity(state.severity);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'alertOpen')) {
                setAlertOpen(state.alertOpen);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'alert')) {
                setAlert(state.alert);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'themeType')) {
                setThemeType(state.themeType);
            }
        });
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Snackbar
                anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
                open={alertOpen}
                autoHideDuration={5000}
                onClose={() => handleClosedAlert()}
            >
                <Alert severity={alertSeverity} onClose={() => handleClosedAlert()}>
                    {alert}
                </Alert>
            </Snackbar>
            <SubtitleSyncDialog
                open={open}
                tracks={tracks}
                initial={selected}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
            />
        </ThemeProvider>
    );
}
