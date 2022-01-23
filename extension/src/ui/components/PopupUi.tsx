import React, { useCallback, useMemo, useState } from 'react';
import { CssBaseline } from '@material-ui/core';
import { createTheme } from './theme';
import { ThemeProvider } from '@material-ui/core/styles';
import PopupForm from './PopupForm';
import Bridge from '../Bridge';

interface Props {
    bridge: Bridge,
    currentSettings: any,
    commands: any,
}

export default function PopupUi({ bridge, currentSettings, commands }: Props) {
    const [settings, setSettings] = useState(currentSettings);
    const theme = useMemo(() => createTheme(currentSettings.lastThemeType || 'dark'), [currentSettings.lastThemeType]);

    const handleSettingsChanged = useCallback(
        (key, value) => {
            setSettings((old) => {
                const settings = Object.assign({}, old);
                settings[key] = value;
                return settings;
            });
            bridge.finished({ command: 'settings-changed', key, value });
        },
        [bridge]
    );

    const handleOpenExtensionShortcuts = useCallback(() => {
        bridge.finished({ command: 'open-extension-shortcuts' });
    }, [bridge]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <PopupForm
                commands={commands}
                settings={settings}
                onSettingsChanged={handleSettingsChanged}
                onOpenExtensionShortcuts={handleOpenExtensionShortcuts}
            />
        </ThemeProvider>
    );
}
