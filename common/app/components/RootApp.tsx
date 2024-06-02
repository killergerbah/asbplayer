import { Fetcher } from '@project/common';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App from './App';
import { useChromeExtension } from '../hooks/use-chrome-extension';
import { AppSettingsStorage } from '../services/app-settings-storage';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
    settingsStorage: AppSettingsStorage;
}

const RootApp = ({ origin, logoUrl, settingsStorage, fetcher }: Props) => {
    const settingsProvider = useMemo(() => new SettingsProvider(settingsStorage), [settingsStorage]);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const extension = useChromeExtension({ sidePanel: false });

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async (settings: Partial<AsbplayerSettings>) => {
            setSettings((s) => ({ ...s!, ...settings }));

            await settingsProvider.set(settings);
        },
        [settingsProvider]
    );

    useEffect(() => {
        return settingsStorage.onSettingsUpdated(() => {
            settingsProvider.getAll().then(setSettings);
        });
    }, [extension, settingsProvider, settingsStorage]);

    if (settings === undefined) {
        return null;
    }

    return (
        <App
            origin={origin}
            logoUrl={logoUrl}
            settings={settings}
            extension={extension}
            fetcher={fetcher}
            onSettingsChanged={handleSettingsChanged}
        />
    );
};

export default RootApp;
