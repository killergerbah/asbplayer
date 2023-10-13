import { AsbplayerSettings, SettingsProvider, SettingsStorage } from '@project/common';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, useChromeExtension } from '@project/common/app';
import { i18n } from '@project/common/app/src/components/i18n';

interface Props {
    settingsStorage: SettingsStorage;
}

const RootApp = ({ settingsStorage }: Props) => {
    const settingsProvider = useMemo(() => new SettingsProvider(settingsStorage), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const extension = useChromeExtension({ sidePanel: false });

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            setSettings((s) => ({ ...s!, [key]: value }));
            if (key === 'language' && i18n.language !== value) {
                i18n.changeLanguage(value as string);
            }

            await settingsProvider.set({ [key]: value });

            if (extension.installed) {
                extension.notifySettingsUpdated();
            }
        },
        [settingsProvider, extension]
    );

    if (settings === undefined) {
        return null;
    }

    return <App settings={settings} extension={extension} onSettingsChanged={handleSettingsChanged} />;
};

export default RootApp;
