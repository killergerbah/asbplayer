import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createTheme } from './theme';
import { ThemeProvider } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import CssBaseline from '@material-ui/core/CssBaseline';
import VideoNameDialog from './VideoNameDialog';

export default function VideoNameUi({bridge}) {
    const [open, setOpen] = useState(false);
    const [themeType, setThemeType] = useState('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);
    useEffect(() => {
        bridge.onStateUpdated((state) => {
            setOpen(state.open);
        });
    }, [bridge]);
    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.finished({command: 'cancel'})
    }, [bridge]);
    const handleNameSet = useCallback((name) => {
        console.error(name);
        setOpen(false);
        bridge.finished({command: 'name', name: name});
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <VideoNameDialog
                open={open}
                onCancel={handleCancel}
                onNameSet={handleNameSet}
            />
        </ThemeProvider>
    );
}