import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { ExtensionMessage } from '@project/common/app';
import { useChromeExtension } from '@project/common/app/hooks/use-chrome-extension';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { createTheme } from '@project/common/theme';
import { useI18n } from '../hooks/use-i18n';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import { useEffect, useMemo } from 'react';
import StatisticsOverlay from '@project/common/components/StatisticsOverlay';
import {
    CloseStatisticsOverlayMessage,
    CurrentTabMessage,
    FullscreenStatisticsOverlayMessage,
    OpenStatisticsMessage,
    OpenStatisticsOverlayMessage,
    RestoreStatisticsOverlayMessage,
    StatisticsOverlayCommand,
    StatisticsOverlayToTabCommand,
    TabToExtensionCommand,
} from '@project/common';
import Box from '@mui/material/Box';
import { uiTabRegistry } from '../hooks/use-has-subtitles';

const dictionaryProvider = new DictionaryProvider(new ExtensionDictionaryStorage());
const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const useThisTabId = () => {
    const [tabId, setTabId] = useState<number>();
    useEffect(() => {
        const command: StatisticsOverlayCommand<CurrentTabMessage> = {
            sender: 'asbplayer-statistics-overlay',
            message: {
                command: 'current-tab',
            },
        };
        browser.runtime.sendMessage(command).then(setTabId);
    }, []);
    return tabId;
};

const StatisticsOverlayUi = () => {
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);
    const extension = useChromeExtension({ component: 'statisticsPopup' });

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    useEffect(() => {
        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'settings-updated') {
                settingsProvider.getAll().then(setSettings);
            }
        });
    }, [extension]);

    const handleOpenStatistics = useCallback(() => {
        const command: TabToExtensionCommand<OpenStatisticsMessage> = {
            sender: 'asbplayer-video-tab',
            message: {
                command: 'open-statistics',
            },
        };
        browser.runtime.sendMessage(command);
    }, []);

    const thisTabId = useThisTabId();

    const handleReceivedSnapshot = useCallback(
        async (mediaId: string) => {
            if (thisTabId === undefined) {
                return;
            }
            // Only open the overlay if the video element is on this tab
            const videoElement = (await uiTabRegistry.activeVideoElements()).find((v) => v.src === mediaId);
            if (thisTabId !== videoElement?.id) {
                return;
            }
            const command: StatisticsOverlayToTabCommand<OpenStatisticsOverlayMessage> = {
                sender: 'asbplayer-statistics-overlay-to-tab',
                message: {
                    command: 'open',
                },
            };
            browser.runtime.sendMessage(command);
        },
        [thisTabId]
    );
    const handleCloseStatisticsOverlay = useCallback(() => {
        const command: StatisticsOverlayToTabCommand<CloseStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'close',
            },
        };
        browser.runtime.sendMessage(command);
    }, []);
    const handleSentenceDetailsWereOpened = useCallback(() => {
        const command: StatisticsOverlayToTabCommand<FullscreenStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'fullscreen',
            },
        };
        browser.runtime.sendMessage(command);
    }, []);
    const handleSentenceDetailsWereClosed = useCallback(() => {
        const command: StatisticsOverlayToTabCommand<RestoreStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'restore',
            },
        };
        browser.runtime.sendMessage(command);
    }, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings?.language ?? 'en' });

    if (!settings || theme === undefined || !i18nInitialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    position: 'absolute',
                    bottom: 0,
                }}
            >
                <StatisticsOverlay
                    open
                    dictionaryProvider={dictionaryProvider}
                    onOpenStatistics={handleOpenStatistics}
                    onReceivedSnapshot={handleReceivedSnapshot}
                    onClose={handleCloseStatisticsOverlay}
                    onSentenceDetailsWereOpened={handleSentenceDetailsWereOpened}
                    onSentenceDetailsWereClosed={handleSentenceDetailsWereClosed}
                    sx={{ bottom: 1 }}
                />
            </Box>
        </ThemeProvider>
    );
};

export default StatisticsOverlayUi;
