import { useEffect, useState } from 'react';
import TabRegistry from '@/services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
export const uiTabRegistry = new TabRegistry(settingsProvider);

export const useHasSubtitles = () => {
    const [hasSubtitles, setHasSubtitles] = useState(false);

    useEffect(() => {
        let mounted = true;
        const update = async () => {
            try {
                const videoElements = await uiTabRegistry.activeVideoElements();
                const anySynced = videoElements.some((videoElement) => videoElement.synced);
                if (anySynced && mounted) {
                    setHasSubtitles(true);
                    return;
                }

                const asbplayerId = await uiTabRegistry.findAsbplayer({
                    filter: (asbplayer) => asbplayer.loadedSubtitles ?? false,
                    allowTabCreation: false,
                });
                if (asbplayerId && mounted) setHasSubtitles(true);
            } catch (e) {
                // Swallow errors - best effort
            }
        };
        void update();
        return () => {
            mounted = false;
        };
    }, []);

    return hasSubtitles;
};
