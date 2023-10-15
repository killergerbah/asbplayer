import { AsbplayerSettings, SettingsProvider, SettingsStorage } from '@project/common';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, ExtensionMessage, useChromeExtension } from '@project/common/app';
import { i18n } from '@project/common/app/src/components/i18n';

interface Props {
    origin: string;
    settingsStorage: SettingsStorage;
}

const RootApp = ({ origin, settingsStorage }: Props) => {
    const settingsProvider = useMemo(() => new SettingsProvider(settingsStorage), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const extension = useChromeExtension({ sidePanel: false });

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            setSettings((s) => ({ ...s!, [key]: value }));

            await settingsProvider.set({ [key]: value });

            if (extension.installed) {
                extension.notifySettingsUpdated();
            }
        },
        [settingsProvider, extension]
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

    return <App origin={origin} settings={settings} extension={extension} onSettingsChanged={handleSettingsChanged} />;
};

export default RootApp;
