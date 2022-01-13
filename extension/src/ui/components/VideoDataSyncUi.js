import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { createTheme } from './theme';
import VideoDataSyncDialog from './VideoDataSyncDialaog';

export default function VideoDataSyncUi({ bridge }) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [suggestedName, setSuggestedName] = useState('');
    const [showSubSelect, setShowSubSelect] = useState(true);
    const [subtitles, setSubtitles] = useState([{ language: '', url: '-', label: 'Off' }]);
    const [selectedSubtitle, setSelectedSubtitle] = useState('-');
    const [error, setError] = useState('');

    const theme = useMemo(() => createTheme('dark'));

    const handleCancel = useCallback(() => {
        closeDialog();
        bridge.finished({ command: 'cancel' });
    }, [bridge]);
    const handleConfirm = useCallback(
        (data) => {
            closeDialog();
            bridge.finished({ command: 'confirm', data });
        },
        [bridge]
    );

    function closeDialog() {
        setOpen(false);
        setSuggestedName('');
        setSelectedSubtitle('-');
        setError('');
    }

    useEffect(() => {
        bridge.onStateUpdated((state) => {
            if (Object.prototype.hasOwnProperty.call(state, 'open')) {
                setOpen(state.open);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'isLoading')) {
                setIsLoading(state.isLoading);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'suggestedName')) {
                setSuggestedName(state.suggestedName);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'showSubSelect')) {
                setShowSubSelect(state.showSubSelect);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'subtitles')) {
                setSubtitles(state.subtitles);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'selectedSubtitle')) {
                setSelectedSubtitle(state.selectedSubtitle);
            }

            if (Object.prototype.hasOwnProperty.call(state, 'error')) {
                setError(state.error);
            }
        });
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <VideoDataSyncDialog
                open={open}
                isLoading={isLoading}
                suggestedName={suggestedName}
                showSubSelect={showSubSelect}
                subtitles={subtitles}
                selectedSubtitle={selectedSubtitle}
                error={error}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
            />
        </ThemeProvider>
    );
}
