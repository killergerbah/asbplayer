import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { createTheme } from './theme';
import VideoDataSyncDialog from './VideoDataSyncDialog';
import Bridge from '../Bridge';
import { VideoDataSubtitleTrack } from '@project/common';
import { PaletteType } from '@material-ui/core';

interface Props {
    bridge: Bridge;
}

export default function VideoDataSyncUi({ bridge }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [suggestedName, setSuggestedName] = useState<string>('');
    const [showSubSelect, setShowSubSelect] = useState<boolean>(true);
    const [subtitles, setSubtitles] = useState<VideoDataSubtitleTrack[]>([{ language: '', url: '-', label: 'None' }]);
    const [selectedSubtitle, setSelectedSubtitle] = useState<string>('-');
    const [error, setError] = useState<string>('');
    const [themeType, setThemeType] = useState<string>();

    const theme = useMemo(() => createTheme((themeType || 'dark') as PaletteType), [themeType]);

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

            if (Object.prototype.hasOwnProperty.call(state, 'themeType')) {
                setThemeType(state.themeType);
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
