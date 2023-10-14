import { useCallback, useEffect, useMemo, useState } from 'react';
import SidePanel from './SidePanel';
import { AsbplayerSettings, PlayerSyncMessage, SettingsProvider, VideoTabModel } from '@project/common';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { ExtensionMessage, FileRepository, MediaSources, useChromeExtension } from '@project/common/app';
import { SidePanelStorage } from '../../services/side-panel-storage';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const SidePanelUi = () => {
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const [syncedTab, setSyncedTab] = useState<VideoTabModel>();
    const [sources, setSources] = useState<MediaSources>({ subtitleFiles: [] });
    const extension = useChromeExtension({ sidePanel: true });
    const [autoSyncEffectRan, setAutoSyncEffectRan] = useState<boolean>(false);
    const sidePanelStorage = useMemo(() => new SidePanelStorage(), []);
    const fileRepository = useMemo(() => new FileRepository(), []);

    const handleFiles = useCallback(({ subtitleFiles, flatten }: { subtitleFiles: File[]; flatten: boolean }) => {
        setSources({ subtitleFiles, flattenSubtitleFiles: flatten });
    }, []);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    useEffect(() => {
        async function onMessage(message: ExtensionMessage) {
            if (message.data.command !== 'syncv2' || message.tabId === undefined || message.src === undefined) {
                return;
            }

            const tabModel = extension.tabs?.find((t) => t.id === message.tabId);

            if (tabModel === undefined) {
                return;
            }

            const syncMessage = message.data as PlayerSyncMessage;
            const subtitleFiles: File[] = await Promise.all(
                syncMessage.subtitles.map(
                    async (s) => new File([await (await fetch('data:text/plain;base64,' + s.base64)).blob()], s.name)
                )
            );
            const flatten = syncMessage.flatten ?? false;
            setSyncedTab(tabModel);
            handleFiles({ subtitleFiles, flatten });
            // TODO persist files
            // TODO when new chrome session is detected, prune files
        }

        const unsubscribe = extension.subscribe(onMessage);
        extension.startHeartbeat({ fromVideoPlayer: false });
        return unsubscribe;
    }, [extension, handleFiles]);

    useEffect(() => {
        if (!syncedTab) {
            return;
        }

        const listener = (tabs: VideoTabModel[]) => {
            const srcIsDead = tabs.find((t) => t.id === syncedTab.id && t.src === syncedTab.src) === undefined;

            if (srcIsDead) {
                setSyncedTab(undefined);
            }
        };
        return extension.subscribeTabs(listener);
    }, [extension, syncedTab]);

    useEffect(() => {
        const autoSyncEffect = async () => {
            if (autoSyncEffectRan) {
                return;
            }

            try {
                if (extension.tabs === undefined || syncedTab) {
                    return;
                }

                const lastSyncedTab = await sidePanelStorage.getLastSyncedTab();

                const canAutoSync =
                    lastSyncedTab &&
                    extension.tabs.find((t) => t.id === lastSyncedTab.id && t.src === lastSyncedTab.src) !== undefined;

                if (!canAutoSync) {
                    return;
                }

                const loadLastSubtitleFiles = async () => {
                    const fileId = await sidePanelStorage.getFileIdForTabAndSrc(lastSyncedTab.id, lastSyncedTab.src);

                    if (fileId !== undefined) {
                        const lastSubtitleFiles = await fileRepository.fetch(fileId);

                        if (lastSubtitleFiles !== undefined) {
                            handleFiles({
                                subtitleFiles: lastSubtitleFiles.files,
                                flatten: lastSubtitleFiles.metadata.flatten,
                            });
                        }
                    }
                };

                loadLastSubtitleFiles();
            } finally {
                if (extension.tabs !== undefined) {
                    setAutoSyncEffectRan(true);
                }
            }
        };

        autoSyncEffect();
    }, [fileRepository, handleFiles, extension, sidePanelStorage, autoSyncEffectRan]);

    if (!settings) {
        return null;
    }

    return <SidePanel settings={settings} extension={extension} sources={sources} syncedTab={syncedTab} />;
};

export default SidePanelUi;
