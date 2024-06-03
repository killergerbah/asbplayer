import { Command, SettingsUpdatedMessage } from '@project/common';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsProfileContext } from '@project/common/hooks/use-settings-profile-context';

export const useSettings = () => {
    const settingsProvider = useMemo<SettingsProvider>(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const refreshSettings = useCallback(() => settingsProvider.getAll().then(setSettings), [settingsProvider]);

    useEffect(() => {
        refreshSettings();
    }, [refreshSettings]);

    useEffect(() => {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.command === 'settings-updated') {
                settingsProvider.getAll().then(setSettings);
            }
        });
    }, [settingsProvider]);

    const onSettingsChanged = useCallback(
        (settings: Partial<AsbplayerSettings>) => {
            setSettings((s) => ({ ...s!, ...settings }));

            settingsProvider.set(settings).then(() => {
                const command: Command<SettingsUpdatedMessage> = {
                    sender: 'asbplayer-settings',
                    message: {
                        command: 'settings-updated',
                    },
                };
                chrome.runtime.sendMessage(command);
            });
        },
        [settingsProvider]
    );

    const profileContext = useSettingsProfileContext({ settingsProvider, onProfileChanged: refreshSettings });
    return { settings, onSettingsChanged, profileContext };
};
