import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import {
    AsbplayerSettings,
    ExtensionToVideoCommand,
    GrantedActiveTabPermissionMessage,
    PopupToExtensionCommand,
    SettingsProvider,
    SettingsUpdatedMessage,
    createTheme,
} from '@project/common';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import Popup from './Popup';
import { useRequestingActiveTabPermission } from '../hooks/use-requesting-active-tab-permission';

interface Props {
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

export function PopupUi({ commands }: Props) {
    const settingsProvider = useMemo(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings?.themeType]);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    const handleSettingsChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            setSettings((old: any) => ({ ...old, [key]: value }));
            await settingsProvider.set({ [key]: value });
            const settingsUpdatedCommand: PopupToExtensionCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-popup',
                message: {
                    command: 'settings-updated',
                },
            };
            chrome.runtime.sendMessage(settingsUpdatedCommand);
        },
        []
    );

    const handleOpenExtensionShortcuts = useCallback(() => {
        chrome.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }, []);

    const handleOpenApp = useCallback(() => {
        chrome.tabs.create({ active: true, url: `chrome-extension://${chrome.runtime.id}/app-ui.html` });
    }, []);

    const handleOpenSidePanel = useCallback(async () => {
        // @ts-ignore
        chrome.sidePanel.open({ windowId: (await chrome.windows.getLastFocused()).id });
    }, []);

    const { requestingActiveTabPermission, tabRequestingActiveTabPermission } = useRequestingActiveTabPermission();

    useEffect(() => {
        if (!requestingActiveTabPermission || tabRequestingActiveTabPermission === undefined) {
            return;
        }

        const command: ExtensionToVideoCommand<GrantedActiveTabPermissionMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'granted-active-tab-permission',
            },
            src: tabRequestingActiveTabPermission.src,
        };
        chrome.tabs.sendMessage(tabRequestingActiveTabPermission.tabId, command);
        window.close();
    }, [requestingActiveTabPermission, tabRequestingActiveTabPermission]);

    if (!settings || !theme || requestingActiveTabPermission === undefined) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square>
                <Box p={2}>
                    <Popup
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
        </ThemeProvider>
    );
}
