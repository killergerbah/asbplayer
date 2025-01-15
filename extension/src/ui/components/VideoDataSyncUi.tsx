import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import VideoDataSyncDialog from './VideoDataSyncDialog';
import Bridge from '../bridge';
import {
    ConfirmedVideoDataSubtitleTrack,
    Message,
    SerializedSubtitleFile,
    UpdateStateMessage,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
    VideoDataUiModel,
    VideoDataUiOpenReason,
    ActiveProfileMessage,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import { PaletteType } from '@material-ui/core';
import { bufferToBase64 } from '@project/common/base64';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@project/common/settings';

interface Props {
    bridge: Bridge;
}

const initialTrackIds = ['-', '-', '-'];

export default function VideoDataSyncUi({ bridge }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [suggestedName, setSuggestedName] = useState<string>('');
    const [showSubSelect, setShowSubSelect] = useState<boolean>(true);
    const [subtitles, setSubtitles] = useState<VideoDataSubtitleTrack[]>([
        { id: '-', language: '-', url: '-', label: t('extension.videoDataSync.emptySubtitleTrack'), extension: 'srt' },
    ]);
    const [selectedSubtitleTrackIds, setSelectedSubtitleTrackIds] = useState<string[]>(initialTrackIds);
    const [defaultCheckboxState, setDefaultCheckboxState] = useState<boolean>(false);
    const [openReason, setOpenReason] = useState<VideoDataUiOpenReason>(VideoDataUiOpenReason.userRequested);
    const [openedFromAsbplayerId, setOpenedFromAsbplayerId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [themeType, setThemeType] = useState<string>();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();

    const theme = useMemo(() => createTheme((themeType || 'dark') as PaletteType), [themeType]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'openSettings' });
    }, [bridge]);
    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.sendMessageFromServer({ command: 'cancel' });
    }, [bridge]);
    const handleConfirm = useCallback(
        (data: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => {
            setOpen(false);
            const message: VideoDataUiBridgeConfirmMessage = {
                command: 'confirm',
                data,
                shouldRememberTrackChoices,
                syncWithAsbplayerId: openedFromAsbplayerId.length > 0 ? openedFromAsbplayerId : undefined,
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge, openedFromAsbplayerId]
    );

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const model = (message as UpdateStateMessage).state as VideoDataUiModel;

            if (model.open !== undefined) {
                setOpen(model.open);
            }

            if (model.isLoading !== undefined) {
                setIsLoading(model.isLoading);
            }

            if (model.suggestedName !== undefined) {
                setSuggestedName(model.suggestedName);
            }

            if (model.showSubSelect !== undefined) {
                setShowSubSelect(model.showSubSelect);
            }

            if (model.subtitles !== undefined) {
                setSelectedSubtitleTrackIds(initialTrackIds);
                setSubtitles([
                    {
                        id: '-',
                        language: '-',
                        url: '-',
                        label: t('extension.videoDataSync.emptySubtitleTrack'),
                        extension: 'srt',
                    },
                    ...model.subtitles,
                ]);
            }

            if (model.selectedSubtitle !== undefined) {
                setSelectedSubtitleTrackIds(model.selectedSubtitle);
            }

            if (model.defaultCheckboxState !== undefined) {
                setDefaultCheckboxState(model.defaultCheckboxState);
            }

            if (model.error !== undefined) {
                setError(model.error);
            }

            if (model.openReason !== undefined) {
                setOpenReason(model.openReason);
            }

            if (model.openedFromAsbplayerId !== undefined) {
                setOpenedFromAsbplayerId(model.openedFromAsbplayerId);
            }

            if (model.settings !== undefined) {
                setThemeType(model.settings.themeType);
                setProfiles(model.settings.profiles);
                setActiveProfile(model.settings.activeProfile);
            }
        });
    }, [bridge, t]);

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
                bridge.sendMessageFromServer(message);
            } finally {
                setDisabled(false);
            }
        }
    }, [bridge]);

    const handleOpenFile = useCallback(() => fileInputRef.current?.click(), []);

    const handleSetActiveProfile = useCallback(
        (profile: string | undefined) => {
            const message: ActiveProfileMessage = { command: 'activeProfile', profile: profile };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <VideoDataSyncDialog
                open={open}
                disabled={disabled}
                isLoading={isLoading}
                suggestedName={suggestedName}
                showSubSelect={showSubSelect}
                subtitleTracks={subtitles}
                selectedSubtitleTrackIds={selectedSubtitleTrackIds}
                defaultCheckboxState={defaultCheckboxState}
                openReason={openReason}
                error={error}
                profiles={profiles}
                activeProfile={activeProfile}
                onCancel={handleCancel}
                onOpenFile={handleOpenFile}
                onOpenSettings={handleOpenSettings}
                onConfirm={handleConfirm}
                onSetActiveProfile={handleSetActiveProfile}
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
