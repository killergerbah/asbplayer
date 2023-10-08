import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import Bridge from '../bridge';
import { Anki, AsbplayerSettings, chromeCommandBindsToKeyBinds, createTheme } from '@project/common';
import { LatestExtensionInfo, newVersionAvailable } from '../../services/version-checker';
import { SettingsForm } from '@project/common/components';

interface Props {
    bridge: Bridge;
    currentSettings: AsbplayerSettings;
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

export interface OpenUpdateUrlMessage {
    command: 'open-update-url';
    url: string;
}

export interface EditVideoKeyboardShorcutsMessage {
    command: 'edit-video-keyboard-shortcuts';
}

export function PopupUi({ bridge, currentSettings, commands }: Props) {
    const [settings, setSettings] = useState(currentSettings);
    const [latestVersionInfo, setLatestVersionInfo] = useState<LatestExtensionInfo>();
    const theme = useMemo(() => createTheme(currentSettings.themeType), [currentSettings.themeType]);

    useEffect(() => {
        const checkLatestVersion = async () => {
            const [newVersion, latestVersionInfo] = await newVersionAvailable();

            if (newVersion) {
                setLatestVersionInfo(latestVersionInfo);
            }
        };

        checkLatestVersion();
    }, []);

    function handleSettingsChanged<K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) {
        setSettings((old: any) => ({ ...old, [key]: value }));
        const message: SettingsChangedMessage<K> = { command: 'settings-changed', key, value };
        bridge.sendServerMessage(message);
    }

    const handleSettingsChangedCallback = useCallback(handleSettingsChanged, []);

    const handleOpenExtensionShortcuts = useCallback(() => {
        const message: OpenExtensionShortcutsMessage = { command: 'open-extension-shortcuts' };
        bridge.sendServerMessage(message);
    }, [bridge]);

    const handleOpenUpdateUrl = useCallback(
        (url: string) => {
            const message: OpenUpdateUrlMessage = { command: 'open-update-url', url };
            bridge.sendServerMessage(message);
        },
        [bridge]
    );

    const handleVideoKeyboardShortcutClicked = useCallback(() => {
        const message: EditVideoKeyboardShorcutsMessage = { command: 'edit-video-keyboard-shortcuts' };
        bridge.sendServerMessage(message);
    }, [bridge]);

    const anki = useMemo(() => new Anki(currentSettings, bridge), [currentSettings, bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SettingsForm
                open
                insideExtension
                anki={anki}
                chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                settings={settings}
                onClose={() => {}}
                onSettingsChanged={handleSettingsChangedCallback}
                onOpenChromeExtensionShortcuts={handleOpenExtensionShortcuts}
                // latestVersionInfo={latestVersionInfo}
                // onOpenUpdateUrl={handleOpenUpdateUrl}
                // onVideoKeyboardShortcutClicked={handleVideoKeyboardShortcutClicked}
            />
        </ThemeProvider>
    );
}
