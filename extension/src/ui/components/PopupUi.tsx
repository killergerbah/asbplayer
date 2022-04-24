import React, { useCallback, useMemo, useState } from 'react';
import { CssBaseline } from '@material-ui/core';
import { createTheme } from './theme';
import { ThemeProvider } from '@material-ui/core/styles';
import PopupForm from './PopupForm';
import Bridge from '../Bridge';
import { ExtensionSettings } from '@project/common';

interface Props {
    bridge: Bridge;
    currentSettings: any;
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

export function PopupUi({ bridge, currentSettings, commands }: Props) {
    const [settings, setSettings] = useState(currentSettings);
    const theme = useMemo(() => createTheme(currentSettings.lastThemeType || 'dark'), [currentSettings.lastThemeType]);

    function handleSettingsChanged<K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) {
        setSettings((old: any) => {
            const settings = Object.assign({}, old);
            settings[key] = value;
            return settings;
        });
        const message: SettingsChangedMessage<K> = { command: 'settings-changed', key, value };
        bridge.finished(message);
    }

    const handleSettingsChangedCallback = useCallback(handleSettingsChanged, []);

    const handleOpenExtensionShortcuts = useCallback(() => {
        const message: OpenExtensionShortcutsMessage = { command: 'open-extension-shortcuts' };
        bridge.finished(message);
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <PopupForm
                commands={commands}
                settings={settings}
                onSettingsChanged={handleSettingsChangedCallback}
                onOpenExtensionShortcuts={handleOpenExtensionShortcuts}
            />
        </ThemeProvider>
    );
}
