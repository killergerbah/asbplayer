import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import Bridge from '../bridge';
import { AsbplayerSettings, SettingsProvider, createTheme } from '@project/common';
import { Box, Paper, Typography } from '@material-ui/core';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import Popup from './Popup';
import { useRequestingActiveTabPermission } from '../hooks/use-requesting-active-tab-permission';
import ActiveTabPermissionObtainedNotification from './ActiveTabPermissionObainedNotification';

interface Props {
    bridge: Bridge;
    commands: any;
}

export interface SettingsChangedMessage<K extends keyof AsbplayerSettings> {
    command: 'settings-changed';
    key: K;
    value: AsbplayerSettings[K];
}

export interface OpenExtensionShortcutsMessage {
    command: 'open-extension-shortcuts';
}

export interface OpenAppMessage {
    command: 'open-app';
}

export interface OpenSidePanelMessage {
    command: 'open-side-panel';
}

export function PopupUi({ bridge, commands }: Props) {
    const settingsProvider = useMemo(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings?.themeType]);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    const handleSettingsChanged = useCallback(
        <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            setSettings((old: any) => ({ ...old, [key]: value }));
            const message: SettingsChangedMessage<K> = { command: 'settings-changed', key, value };
            bridge.sendServerMessage(message);
        },
        []
    );

    const handleOpenExtensionShortcuts = useCallback(() => {
        const message: OpenExtensionShortcutsMessage = { command: 'open-extension-shortcuts' };
        bridge.sendServerMessage(message);
    }, [bridge]);

    const handleOpenApp = useCallback(() => {
        const message: OpenAppMessage = { command: 'open-app' };
        bridge.sendServerMessage(message);
    }, []);

    const handleOpenSidePanel = useCallback(() => {
        const message: OpenSidePanelMessage = { command: 'open-side-panel' };
        bridge.sendServerMessage(message);
    }, []);

    const requestingActiveTabPermission = useRequestingActiveTabPermission();

    if (!settings || !theme || requestingActiveTabPermission === undefined) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            {requestingActiveTabPermission ? (
                <Paper square>
                    <Box p={2}>
                        <ActiveTabPermissionObtainedNotification />
                    </Box>
                </Paper>
            ) : (
                <Paper square>
                    <Box p={2}>
                        <Popup
                            bridge={bridge}
                            commands={commands}
                            settings={settings}
                            onSettingsChanged={handleSettingsChanged}
                            onOpenApp={handleOpenApp}
                            onOpenSidePanel={handleOpenSidePanel}
                            onOpenExtensionShortcuts={handleOpenExtensionShortcuts}
                        />
                    </Box>
                    <Box p={0.5} textAlign="right">
                        <Typography variant="caption" align="right" color="textSecondary">
                            {`v${chrome.runtime.getManifest().version}`}
                        </Typography>
                    </Box>
                </Paper>
            )}
        </ThemeProvider>
    );
}
