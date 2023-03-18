import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createTheme } from './theme';
import VideoDataSyncDialog from './VideoDataSyncDialog';
import Bridge from '../Bridge';
import {
    ConfirmedVideoDataSubtitleTrack,
    SerializedSubtitleFile,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
} from '@project/common';
import { PaletteType } from '@material-ui/core';
import { bufferToBase64 } from '../../services/Base64';

interface Props {
    bridge: Bridge;
}

export default function VideoDataSyncUi({ bridge }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [suggestedName, setSuggestedName] = useState<string>('');
    const [showSubSelect, setShowSubSelect] = useState<boolean>(true);
    const [subtitles, setSubtitles] = useState<VideoDataSubtitleTrack[]>([
        { language: '', url: '-', label: 'Empty', extension: 'srt' },
    ]);
    const [selectedSubtitle, setSelectedSubtitle] = useState<string>('-');
    const [openedFromMiningCommand, setOpenedFromMiningCommand] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [themeType, setThemeType] = useState<string>();

    const theme = useMemo(() => createTheme((themeType || 'dark') as PaletteType), [themeType]);

    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.sendServerMessage({ command: 'cancel' });
    }, [bridge]);
    const handleConfirm = useCallback(
        (data: ConfirmedVideoDataSubtitleTrack) => {
            setOpen(false);
            const message: VideoDataUiBridgeConfirmMessage = { command: 'confirm', data };
            bridge.sendServerMessage(message);
        },
        [bridge]
    );

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

            if (Object.prototype.hasOwnProperty.call(state, 'openedFromMiningCommand')) {
                setOpenedFromMiningCommand(state.openedFromMiningCommand);
            }
        });
    }, [bridge]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileInputChange = useCallback(async () => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            try {
                setDisabled(true);
                const subtitles: SerializedSubtitleFile[] = [];

                for (let i = 0; i < files.length; ++i) {
                    const f = files[i];
                    const base64 = await bufferToBase64(await f.arrayBuffer());

                    subtitles.push({
                        name: f.name,
                        base64: base64,
                    });
                }

                setOpen(false);
                const message: VideoDataUiBridgeOpenFileMessage = { command: 'openFile', subtitles };
                bridge.sendServerMessage(message);
            } finally {
                setDisabled(false);
            }
        }
    }, [bridge]);

    const handleOpenFile = useCallback(() => fileInputRef.current?.click(), []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <VideoDataSyncDialog
                open={open}
                disabled={disabled}
                isLoading={isLoading}
                suggestedName={suggestedName}
                showSubSelect={showSubSelect}
                subtitles={subtitles}
                selectedSubtitle={selectedSubtitle}
                openedFromMiningCommand={openedFromMiningCommand}
                error={error}
                onCancel={handleCancel}
                onOpenFile={handleOpenFile}
                onConfirm={handleConfirm}
            />
            <input
                ref={fileInputRef}
                onChange={handleFileInputChange}
                type="file"
                accept=".srt,.ass,.vtt,.sup,.dfxp,.ttml2"
                multiple
                hidden
            />
        </ThemeProvider>
    );
}
