import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import PopupForm from './PopupForm';
import Bridge from '../bridge';
import { ExtensionSettings, createTheme } from '@project/common';
import { LatestExtensionInfo, newVersionAvailable } from '../../services/version-checker';

interface Props {
    bridge: Bridge;
    currentSettings: ExtensionSettings;
    commands: any;
}

export interface SettingsChangedMessage<K extends keyof ExtensionSettings> {
    command: 'settings-changed';
    key: K;
    value: ExtensionSettings[K];
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
    const theme = useMemo(() => createTheme(currentSettings.lastThemeType || 'dark'), [currentSettings.lastThemeType]);

    useEffect(() => {
        const checkLatestVersion = async () => {
            const [newVersion, latestVersionInfo] = await newVersionAvailable();

            if (newVersion) {
                setLatestVersionInfo(latestVersionInfo);
            }
        };

        checkLatestVersion();
    }, []);

    function handleSettingsChanged<K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) {
        setSettings((old: any) => {
            const settings = Object.assign({}, old);
            settings[key] = value;
            return settings;
        });
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

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <PopupForm
                commands={commands}
                settings={settings}
                latestVersionInfo={latestVersionInfo}
                onSettingsChanged={handleSettingsChangedCallback}
                onOpenExtensionShortcuts={handleOpenExtensionShortcuts}
                onOpenUpdateUrl={handleOpenUpdateUrl}
                onVideoKeyboardShortcutClicked={handleVideoKeyboardShortcutClicked}
            />
        </ThemeProvider>
    );
}
