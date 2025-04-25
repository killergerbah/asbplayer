import {
    AsbPlayerToTabCommand,
    AsbPlayerToVideoCommandV2,
    Image,
    CopyHistoryItem,
    ExtensionToVideoCommand,
    LoadSubtitlesMessage,
    RequestSubtitlesMessage,
    ShowAnkiUiMessage,
    VideoTabModel,
    ExtensionToAsbPlayerCommand,
    CopySubtitleMessage,
    CardModel,
    RequestSubtitlesResponse,
    JumpToSubtitleMessage,
    DownloadImageMessage,
    DownloadAudioMessage,
} from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';
import { AudioClip } from '@project/common/audio-clip';
import { ChromeExtension, useCopyHistory } from '@project/common/app';
import { useI18n } from '../hooks/use-i18n';
import { SubtitleReader } from '@project/common/subtitle-reader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Player from '@project/common/app/components/Player';
import { PlaybackPreferences } from '@project/common/app';
import { AlertColor } from '@mui/material/Alert';
import Alert from '@project/common/app/components/Alert';
import { LocalizedError } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import SidePanelHome from './SidePanelHome';
import { DisplaySubtitleModel } from '@project/common/app/components/SubtitlePlayer';
import { useCurrentTabId } from '../hooks/use-current-tab-id';
import { timeDurationDisplay } from '@project/common/app/services/util';
import { useVideoElementCount } from '../hooks/use-video-element-count';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import CircularProgress from '@mui/material/CircularProgress';
import SidePanelBottomControls from './SidePanelBottomControls';
import SidePanelRecordingOverlay from './SidePanelRecordingOverlay';
import SidePanelTopControls from './SidePanelTopControls';
import CopyHistory from '@project/common/app/components/CopyHistory';
import CopyHistoryList from '@project/common/app/components/CopyHistoryList';
import { useAppKeyBinder } from '@project/common/app/hooks/use-app-key-binder';
import { download } from '@project/common/util';
import { MiningContext } from '@project/common/app/services/mining-context';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { mp3WorkerFactory } from '../../services/mp3-worker-factory';
import { pgsParserWorkerFactory } from '../../services/pgs-parser-worker-factory';

interface Props {
    settings: AsbplayerSettings;
    extension: ChromeExtension;
}

const sameVideoTab = (a: VideoTabModel, b: VideoTabModel) => {
    return a.id === b.id && a.src === b.src && a.synced === b.synced && a.syncedTimestamp === b.syncedTimestamp;
};

const emptyArray: VideoTabModel[] = [];
const miningContext = new MiningContext();

export default function SidePanel({ settings, extension }: Props) {
    const { t } = useTranslation();
    const playbackPreferences = useMemo(() => new PlaybackPreferences(settings, extension), [settings, extension]);
    const subtitleReader = useMemo(
        () =>
            new SubtitleReader({
                regexFilter: settings.subtitleRegexFilter,
                regexFilterTextReplacement: settings.subtitleRegexFilterTextReplacement,
                subtitleHtml: settings.subtitleHtml,
                pgsParserWorkerFactory,
            }),
        [settings]
    );
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>();
    const [subtitleFileNames, setSubtitleFileNames] = useState<string[]>();
    const [canDownloadSubtitles, setCanDownloadSubtitles] = useState<boolean>(true);
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>();
    const [initializing, setInitializing] = useState<boolean>(true);
    const [syncedVideoTab, setSyncedVideoElement] = useState<VideoTabModel>();
    const [recordingAudio, setRecordingAudio] = useState<boolean>(false);
    const [viewingAsbplayer, setViewingAsbplayer] = useState<boolean>(false);

    const keyBinder = useAppKeyBinder(settings.keyBindSet, extension);
    const currentTabId = useCurrentTabId();
    const videoElementCount = useVideoElementCount({ extension, currentTabId });

    useEffect(() => {
        extension.loadedSubtitles = subtitles !== undefined && subtitles.length > 0;
        extension.startHeartbeat();
    }, [extension, subtitles]);

    useEffect(() => {
        setCanDownloadSubtitles(subtitles?.some((s) => s.text !== '') ?? false);
    }, [subtitles]);

    useEffect(() => {
        if (currentTabId === undefined) {
            return;
        }

        return extension.subscribeTabs(async (tabs) => {
            const currentVideoTabs = tabs.filter((t) => t.id === currentTabId);

            if (currentVideoTabs.length > 0) {
                let lastSyncedVideoTab: VideoTabModel | undefined;

                for (const t of currentVideoTabs) {
                    if (!t.synced) {
                        continue;
                    }

                    if (lastSyncedVideoTab === undefined || t.syncedTimestamp! > lastSyncedVideoTab.syncedTimestamp!) {
                        lastSyncedVideoTab = t;
                    }
                }

                if (
                    lastSyncedVideoTab !== undefined &&
                    (syncedVideoTab === undefined || !sameVideoTab(lastSyncedVideoTab, syncedVideoTab))
                ) {
                    const message: ExtensionToVideoCommand<RequestSubtitlesMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'request-subtitles',
                        },
                        src: lastSyncedVideoTab.src,
                    };
                    const response = (await browser.tabs.sendMessage(lastSyncedVideoTab.id, message)) as
                        | RequestSubtitlesResponse
                        | undefined;

                    if (response !== undefined) {
                        const subs = response.subtitles;
                        const length = subs.length > 0 ? subs[subs.length - 1].end : 0;
                        setSyncedVideoElement(lastSyncedVideoTab);
                        setSubtitles(
                            subs.map((s, index) => ({
                                ...s,
                                index,
                                displayTime: timeDurationDisplay(s.start, length),
                            }))
                        );
                        setSubtitleFileNames(response.subtitleFileNames);
                    }
                }
            }

            setInitializing(false);
        });
    }, [extension, subtitles, initializing, currentTabId, syncedVideoTab]);

    useEffect(() => {
        return extension.subscribe((message) => {
            if (message.data.command === 'close-side-panel') {
                window.close();
            }
        });
    }, [extension]);

    useEffect(() => {
        if (currentTabId === undefined || syncedVideoTab === undefined) {
            return;
        }

        return extension.subscribeTabs((tabs) => {
            const tabStillExists =
                tabs.find((t) => t.id === syncedVideoTab.id && t.src === syncedVideoTab.src && t.synced) !== undefined;

            if (!tabStillExists) {
                setSubtitles(undefined);
                setSyncedVideoElement(undefined);
            }
        });
    }, [extension, currentTabId, syncedVideoTab]);

    useEffect(() => {
        if (currentTabId === undefined) {
            setViewingAsbplayer(false);
            return;
        }

        return extension.subscribeTabs(() => {
            const asbplayer = extension.asbplayers?.find((a) => a.tabId === currentTabId);
            setViewingAsbplayer(asbplayer !== undefined);
        });
    }, [currentTabId, extension]);

    useEffect(() => {
        return extension.subscribe((message) => {
            if (message.data.command === 'recording-started') {
                setRecordingAudio(true);
            } else if (message.data.command === 'recording-finished') {
                setRecordingAudio(false);
            }
        });
    }, [extension]);

    useEffect(() => {
        return keyBinder.bindToggleSidePanel(
            () => window.close(),
            () => false
        );
    }, [keyBinder]);

    const handleError = useCallback(
        (message: any) => {
            console.error(message);

            setAlertSeverity('error');

            if (message instanceof LocalizedError) {
                setAlert(t(message.locKey, message.locParams) ?? '<failed to localize error>');
            } else if (message instanceof Error) {
                setAlert(message.message);
            } else if (typeof message === 'string') {
                setAlert(message);
            } else {
                setAlert(String(message));
            }

            setAlertOpen(true);
        },
        [t]
    );

    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);

    const handleMineSubtitle = useCallback(() => {
        if (syncedVideoTab === undefined) {
            return;
        }

        const message: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'copy-subtitle', postMineAction: settings.clickToMineDefaultAction },
            tabId: syncedVideoTab.id,
            src: syncedVideoTab.src,
        };
        browser.runtime.sendMessage(message);
    }, [syncedVideoTab, settings.clickToMineDefaultAction]);

    const handleLoadSubtitles = useCallback(() => {
        if (currentTabId === undefined) {
            return;
        }

        const message: AsbPlayerToTabCommand<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: currentTabId,
        };
        browser.runtime.sendMessage(message);
    }, [currentTabId]);

    const handleDownloadSubtitles = useCallback(() => {
        if (subtitles) {
            const fileName =
                subtitleFileNames !== undefined && subtitleFileNames.length > 0
                    ? `${subtitleFileNames[0]}.srt`
                    : 'subtitles.srt';
            download(new Blob([subtitleReader.subtitlesToSrt(subtitles)], { type: 'text/plain' }), fileName);
        }
    }, [subtitles, subtitleFileNames, subtitleReader]);

    const topControlsRef = useRef<HTMLDivElement>(null);
    const [showTopControls, setShowTopControls] = useState<boolean>(false);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const bounds = topControlsRef.current?.getBoundingClientRect();

            if (!bounds) {
                return;
            }
            const xDistance = Math.min(
                Math.abs(e.clientX - bounds.left),
                Math.abs(e.clientX - bounds.left - bounds.width)
            );
            const yDistance = Math.min(
                Math.abs(e.clientY - bounds.top),
                Math.abs(e.clientY - bounds.top - bounds.height)
            );

            if (!showTopControls && xDistance < 100 && yDistance < 100) {
                setShowTopControls(true);
            } else if (showTopControls && (xDistance >= 100 || yDistance >= 100)) {
                setShowTopControls(false);
            }
        },
        [showTopControls]
    );

    const copyHistoryRepository = useMemo(
        () => new IndexedDBCopyHistoryRepository(settings.miningHistoryStorageLimit),
        [settings.miningHistoryStorageLimit]
    );
    const { copyHistoryItems, refreshCopyHistory, deleteCopyHistoryItem, deleteAllCopyHistoryItems } = useCopyHistory(
        settings.miningHistoryStorageLimit,
        copyHistoryRepository
    );
    useEffect(() => {
        if (viewingAsbplayer) {
            refreshCopyHistory();
        }
    }, [refreshCopyHistory, viewingAsbplayer]);
    const [showCopyHistory, setShowCopyHistory] = useState<boolean>(false);
    const handleShowCopyHistory = useCallback(async () => {
        await refreshCopyHistory();
        setShowCopyHistory(true);
    }, [refreshCopyHistory]);
    const handleCloseCopyHistory = useCallback(() => setShowCopyHistory(false), []);
    const handleClipAudio = useCallback(
        async (item: CopyHistoryItem) => {
            if (viewingAsbplayer) {
                if (currentTabId) {
                    const downloadAudioCommand: ExtensionToAsbPlayerCommand<DownloadAudioMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'download-audio',
                            ...item,
                        },
                    };
                    browser.tabs.sendMessage(currentTabId, downloadAudioCommand);
                }
            } else {
                const clip = AudioClip.fromCard(item, settings.audioPaddingStart, settings.audioPaddingEnd, false);

                if (clip) {
                    if (settings.preferMp3) {
                        const worker = await mp3WorkerFactory();
                        clip.toMp3(() => worker).download();
                    } else {
                        clip.download();
                    }
                }
            }
        },
        [settings, currentTabId, viewingAsbplayer]
    );
    const handleDownloadImage = useCallback(
        (item: CopyHistoryItem) => {
            if (viewingAsbplayer) {
                if (currentTabId) {
                    const downloadImageCommand: ExtensionToAsbPlayerCommand<DownloadImageMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'download-image',
                            ...item,
                        },
                    };
                    browser.tabs.sendMessage(currentTabId, downloadImageCommand);
                }
            } else {
                const image = Image.fromCard(item, settings.maxImageWidth, settings.maxImageHeight);

                if (image) {
                    image.download();
                }
            }
        },
        [settings, currentTabId, viewingAsbplayer]
    );
    const handleJumpToSubtitle = useCallback(
        (card: CardModel) => {
            if (!currentTabId || !viewingAsbplayer) {
                return;
            }

            const asbplayerCommand: ExtensionToAsbPlayerCommand<JumpToSubtitleMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'jump-to-subtitle',
                    subtitle: card.subtitle,
                    subtitleFileName: card.subtitleFileName,
                },
            };
            browser.tabs.sendMessage(currentTabId, asbplayerCommand);
        },
        [currentTabId, viewingAsbplayer]
    );
    const handleAnki = useCallback(
        (copyHistoryItem: CopyHistoryItem) => {
            if (currentTabId === undefined) {
                return;
            }

            const message: ShowAnkiUiMessage = {
                ...copyHistoryItem,
                command: 'show-anki-ui',
            };
            const videoCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-video',
                message,
            };
            const asbplayerCommand: ExtensionToAsbPlayerCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-player',
                message,
            };
            browser.tabs.sendMessage(currentTabId, videoCommand);
            browser.tabs.sendMessage(currentTabId, asbplayerCommand);
        },
        [currentTabId]
    );

    const recordingAudioRef = useRef(recordingAudio);
    recordingAudioRef.current = recordingAudio;

    const handleMineFromSubtitlePlayer = useCallback(
        (card: CardModel) => {
            if (syncedVideoTab === undefined) {
                return;
            }

            if (recordingAudioRef.current || currentTabId !== syncedVideoTab.id) {
                return;
            }

            const message: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
                sender: 'asbplayerv2',
                message: {
                    command: 'copy-subtitle',
                    subtitle: card.subtitle,
                    surroundingSubtitles: card.surroundingSubtitles,
                    postMineAction: settings.clickToMineDefaultAction,
                },
                tabId: syncedVideoTab.id,
                src: syncedVideoTab.src,
            };
            browser.runtime.sendMessage(message);
        },
        [syncedVideoTab, settings.clickToMineDefaultAction, currentTabId]
    );
    const noOp = useCallback(() => {}, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    if (!i18nInitialized) {
        return null;
    }

    if (initializing || currentTabId === undefined || videoElementCount === undefined) {
        return (
            <CenteredGridContainer>
                <CenteredGridItem>
                    <CircularProgress color="primary" />
                </CenteredGridItem>
            </CenteredGridContainer>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%' }} onMouseMove={handleMouseMove}>
            <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                {alert}
            </Alert>
            {viewingAsbplayer ? (
                <CopyHistoryList
                    open={true}
                    items={copyHistoryItems}
                    forceShowDownloadOptions={true}
                    onClose={handleCloseCopyHistory}
                    onDelete={deleteCopyHistoryItem}
                    onDeleteAll={deleteAllCopyHistoryItems}
                    onAnki={handleAnki}
                    onClipAudio={handleClipAudio}
                    onDownloadImage={handleDownloadImage}
                    onSelect={handleJumpToSubtitle}
                />
            ) : (
                <>
                    <CopyHistory
                        open={showCopyHistory}
                        items={copyHistoryItems}
                        onClose={handleCloseCopyHistory}
                        onDelete={deleteCopyHistoryItem}
                        onDeleteAll={deleteAllCopyHistoryItems}
                        onAnki={handleAnki}
                        onClipAudio={handleClipAudio}
                        onDownloadImage={handleDownloadImage}
                    />
                    {subtitles === undefined ? (
                        <SidePanelHome
                            extension={extension}
                            videoElementCount={videoElementCount}
                            onLoadSubtitles={handleLoadSubtitles}
                            onShowMiningHistory={handleShowCopyHistory}
                        />
                    ) : (
                        <>
                            <SidePanelRecordingOverlay show={recordingAudio} />
                            <Player
                                origin={browser.runtime.getURL('/sidepanel.html')}
                                subtitles={subtitles}
                                hideControls={true}
                                showCopyButton={true}
                                forceCompressedMode={true}
                                subtitleReader={subtitleReader}
                                settings={settings}
                                playbackPreferences={playbackPreferences}
                                onCopy={handleMineFromSubtitlePlayer}
                                onError={handleError}
                                onUnloadVideo={noOp}
                                onLoaded={noOp}
                                onTabSelected={noOp}
                                onAnkiDialogRequest={noOp}
                                onAnkiDialogRewind={noOp}
                                onAppBarToggle={noOp}
                                onHideSubtitlePlayer={noOp}
                                onVideoPopOut={noOp}
                                onPlayModeChangedViaBind={noOp}
                                onSubtitles={setSubtitles}
                                tab={syncedVideoTab}
                                availableTabs={emptyArray}
                                extension={extension}
                                drawerOpen={false}
                                appBarHidden={true}
                                videoFullscreen={false}
                                hideSubtitlePlayer={false}
                                videoPopOut={false}
                                disableKeyEvents={false}
                                miningContext={miningContext}
                                keyBinder={keyBinder}
                            />
                            <SidePanelTopControls
                                ref={topControlsRef}
                                show={showTopControls}
                                onLoadSubtitles={handleLoadSubtitles}
                                canDownloadSubtitles={canDownloadSubtitles}
                                onDownloadSubtitles={handleDownloadSubtitles}
                                onShowMiningHistory={handleShowCopyHistory}
                            />
                            <SidePanelBottomControls
                                disabled={currentTabId !== syncedVideoTab?.id}
                                onMineSubtitle={handleMineSubtitle}
                                postMineAction={settings.clickToMineDefaultAction}
                                emptySubtitleTrack={subtitles.length === 0}
                                audioRecordingEnabled={settings.streamingRecordMedia}
                                recordingAudio={recordingAudio}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
