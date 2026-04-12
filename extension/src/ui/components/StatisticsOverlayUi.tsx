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
    ResizeStatisticsOverlayMessage,
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
    const [mediaId, setMediaId] = useState<string>();
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

    const overlayRef = useRef<HTMLDivElement | null>(null);
    const publishOverlaySize = () => {
        if (!overlayRef.current) {
            return;
        }
        const command: StatisticsOverlayToTabCommand<ResizeStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'resize-statistics-overlay',
                width: overlayRef.current.getBoundingClientRect().width,
                height: overlayRef.current.getBoundingClientRect().height,
            },
        };
        browser.runtime.sendMessage(command);
    };
    const resizeObserver = useMemo(() => {
        return new ResizeObserver(() => publishOverlaySize());
    }, []);

    const handleOverlayRef = useCallback(
        (elm: HTMLDivElement | null) => {
            if (!elm) {
                return;
            }

            if (overlayRef.current) {
                resizeObserver.unobserve(overlayRef.current);
            }
            overlayRef.current = elm;
            publishOverlaySize();
            resizeObserver.observe(elm);
        },
        [resizeObserver]
    );

    const thisTabId = useThisTabId();

    const handleReceivedSnapshot = useCallback(
        async (mediaId: string, trackIndex: number) => {
            if (thisTabId === undefined || settings === undefined) {
                return;
            }
            // Only open the overlay if the video element is on this tab
            const videoElement = (await uiTabRegistry.activeVideoElements()).find((v) => v.src === mediaId);
            if (thisTabId !== videoElement?.id) {
                return;
            }
            setMediaId(mediaId);
            if (settings.dictionaryTracks[trackIndex].dictionaryAutoGenerateStatistics) {
                const command: StatisticsOverlayToTabCommand<OpenStatisticsOverlayMessage> = {
                    sender: 'asbplayer-statistics-overlay-to-tab',
                    message: {
                        command: 'open-statistics-overlay',
                        mediaId,
                        force: false,
                    },
                };
                browser.runtime.sendMessage(command);
            }
        },
        [thisTabId, settings]
    );
    const handleCloseStatisticsOverlay = useCallback(() => {
        if (mediaId === undefined) {
            return;
        }
        const command: StatisticsOverlayToTabCommand<CloseStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'close-statistics-overlay',
                mediaId,
            },
        };
        browser.runtime.sendMessage(command);
    }, [mediaId]);
    const handleSentenceDetailsWereOpened = useCallback(() => {
        const command: StatisticsOverlayToTabCommand<FullscreenStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'fullscreen-statistics-overlay',
            },
        };
        browser.runtime.sendMessage(command);
    }, []);
    const handleSentenceDetailsWereClosed = useCallback(() => {
        const command: StatisticsOverlayToTabCommand<RestoreStatisticsOverlayMessage> = {
            sender: 'asbplayer-statistics-overlay-to-tab',
            message: {
                command: 'restore-statistics-overlay',
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
                    ref={handleOverlayRef}
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
