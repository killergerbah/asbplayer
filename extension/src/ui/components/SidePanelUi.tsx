import React, { useEffect, useMemo, useState } from 'react';
import SidePanel from './SidePanel';
import { AsbplayerSettings, SettingsProvider, createTheme } from '@project/common';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { ExtensionMessage, useChromeExtension } from '@project/common/app';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const SidePanelUi = () => {
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const extension = useChromeExtension({ sidePanel: true });
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    useEffect(() => {
        extension.startHeartbeat({ fromVideoPlayer: false });
    }, [extension]);

    useEffect(() => {
        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'settings-updated') {
                settingsProvider.getAll().then(setSettings);
            }
        });
    }, [extension]);

    if (!settings || theme === undefined) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square style={{ width: '100%', height: '100%' }}>
                <SidePanel settings={settings} extension={extension} />
            </Paper>
        </ThemeProvider>
    );
};

export default SidePanelUi;
