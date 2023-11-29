import { Fetcher } from '@project/common';
import { AsbplayerSettings, SettingsProvider, SettingsStorage } from '@project/common/settings';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, ExtensionMessage, useChromeExtension } from '@project/common/app';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
    settingsStorage: SettingsStorage;
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
        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'settings-updated') {
                settingsProvider.getAll().then(setSettings);
            }
        });
    }, [extension, settingsProvider]);

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
