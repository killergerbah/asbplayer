import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import {
    ExtensionToVideoCommand,
    GrantedActiveTabPermissionMessage,
    PopupToExtensionCommand,
    SettingsUpdatedMessage,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import Popup from './Popup';
import { useRequestingActiveTabPermission } from '../hooks/use-requesting-active-tab-permission';
import { isMobile } from 'react-device-detect';
import Link from '@material-ui/core/Link';

interface Props {
    commands: any;
}

export function PopupUi({ commands }: Props) {
    const settingsProvider = useMemo(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async (changed: Partial<AsbplayerSettings>) => {
            setSettings((old: any) => ({ ...old, ...changed }));
            await settingsProvider.set(changed);
            const settingsUpdatedCommand: PopupToExtensionCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-popup',
                message: {
                    command: 'settings-updated',
                },
            };
            chrome.runtime.sendMessage(settingsUpdatedCommand);
        },
        [settingsProvider]
    );

    const handleOpenExtensionShortcuts = useCallback(() => {
        chrome.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }, []);

    const handleOpenApp = useCallback(async () => {
        if (settings?.streamingAppUrl) {
            chrome.tabs.create({ active: true, url: settings.streamingAppUrl });
        }
    }, [settings]);

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

    const version = chrome.runtime.getManifest().version;

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square elevation={0} style={{ width: isMobile ? '100%' : 600 }}>
                <Box>
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
                    <Link
                        target="_blank"
                        rel="noreferrer"
                        href={`https://github.com/killergerbah/asbplayer/releases/tag/v${version}`}
                        variant="caption"
                        align="right"
                        color="textSecondary"
                        underline="always"
                    >
                        {`v${version}`}
                    </Link>
                </Box>
            </Paper>
        </ThemeProvider>
    );
}
