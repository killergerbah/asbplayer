import { AsbplayerSettings, SettingsProvider, SettingsStorage } from '@project/common';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from '@project/common/app';
import { i18n } from '@project/common/app/src/components/i18n';

interface Props {
    settingsStorage: SettingsStorage;
}

const RootApp = ({ settingsStorage }: Props) => {
    const settingsProvider = useMemo(() => new SettingsProvider(settingsStorage), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();

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
        },
        [settingsProvider]
    );

    if (settings === undefined) {
        return null;
    }

    return <App settings={settings} onSettingsChanged={handleSettingsChanged} />;
};

export default RootApp;
