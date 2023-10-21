import {
    AsbPlayerToVideoCommandV2,
    AsbplayerSettings,
    ExtensionToVideoCommand,
    MineSubtitleMessage,
    RequestSubtitlesMessage,
    SubtitleModel,
    VideoTabModel,
} from '@project/common';
import { AppKeyBinder, ChromeExtension, useI18n } from '@project/common/app';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Player } from '@project/common/app';
import { SubtitleReader } from '@project/common/app';
import { PlaybackPreferences } from '@project/common/app';
import { Color } from '@material-ui/lab';
import { LocalizedError } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import Alert from '@project/common/app/src/components/Alert';
import { DefaultKeyBinder } from '@project/common/key-binder';
import SidePanelHome from './SidePanelHome';
import { DisplaySubtitleModel } from '@project/common/app/src/components/SubtitlePlayer';
import { useCurrentTabId } from '../hooks/use-current-tab-id';
import { timeDurationDisplay } from '@project/common/app/src/services/util';
import { useVideoElementCount } from '../hooks/use-video-element-count';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import CircularProgress from '@material-ui/core/CircularProgress';
import SidePanelControls from './SidePanelControls';
import SidePanelRecordingOverlay from './SidePanelRecordingOverlay';

interface Props {
    settings: AsbplayerSettings;
    extension: ChromeExtension;
}

const sameVideoTab = (a: VideoTabModel, b: VideoTabModel) => {
    return a.id === b.id && a.src === b.src && a.synced === b.synced && a.syncedTimestamp === b.syncedTimestamp;
};

export default function SidePanel({ settings, extension }: Props) {
    const { t } = useTranslation();
    const playbackPreferences = useMemo(() => new PlaybackPreferences(settings), [settings]);
    const subtitleReader = useMemo(
        () =>
            new SubtitleReader({
                regexFilter: settings.subtitleRegexFilter,
                regexFilterTextReplacement: settings.subtitleRegexFilterTextReplacement,
            }),
        [settings]
    );
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>();
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<Color>();
    const [initializing, setInitializing] = useState<boolean>(true);
    const [syncedVideoTab, setSyncedVideoElement] = useState<VideoTabModel>();
    const [recordingAudio, setRecordingAudio] = useState<boolean>(false);

    const keyBinder = useMemo(
        () => new AppKeyBinder(new DefaultKeyBinder(settings.keyBindSet), extension),
        [settings.keyBindSet, extension]
    );
    const currentTabId = useCurrentTabId();
    const videoElementCount = useVideoElementCount({ extension, currentTabId });

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
                    const subs = (await chrome.tabs.sendMessage(lastSyncedVideoTab.id, message)) as
                        | SubtitleModel[]
                        | undefined;

                    if (subs !== undefined) {
                        const length = subs.length > 0 ? subs[subs.length - 1].end : 0;
                        setSyncedVideoElement(lastSyncedVideoTab);
                        setSubtitles(
                            subs.map((s, index) => ({ ...s, index, displayTime: timeDurationDisplay(s.start, length) }))
                        );
                    }
                }
            }

            setInitializing(false);
        });
    }, [extension, subtitles, initializing, currentTabId, syncedVideoTab]);

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
        return extension.subscribe((message) => {
            if (message.data.command === 'recording-started') {
                setRecordingAudio(true);
            } else if (message.data.command === 'recording-finished') {
                setRecordingAudio(false);
            }
        });
    }, [extension]);

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

        const message: AsbPlayerToVideoCommandV2<MineSubtitleMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'mine-subtitle' },
            tabId: syncedVideoTab.id,
            src: syncedVideoTab.src,
        };
        chrome.runtime.sendMessage(message);
    }, [syncedVideoTab]);

    const noOp = useCallback(() => {}, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    if (!i18nInitialized) {
        return null;
    }

    if (initializing || currentTabId === undefined || videoElementCount === undefined) {
        return (
            <CenteredGridContainer>
                <CenteredGridItem>
                    <CircularProgress color="secondary" />
                </CenteredGridItem>
            </CenteredGridContainer>
        );
    }

    return (
        <>
            <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                {alert}
            </Alert>
            {subtitles === undefined ? (
                <SidePanelHome
                    currentTabId={currentTabId}
                    extension={extension}
                    videoElementCount={videoElementCount}
                />
            ) : (
                <>
                    <SidePanelRecordingOverlay show={recordingAudio} />
                    <Player
                        origin={`chrome-extension://${chrome.runtime.id}/side-panel.html`}
                        subtitles={subtitles}
                        hideControls={true}
                        forceCompressedMode={true}
                        subtitleReader={subtitleReader}
                        settings={settings}
                        playbackPreferences={playbackPreferences}
                        onCopy={noOp}
                        onError={handleError}
                        onUnloadAudio={noOp}
                        onUnloadVideo={noOp}
                        onLoaded={noOp}
                        onTabSelected={noOp}
                        onAnkiDialogRequest={noOp}
                        onAnkiDialogRewind={noOp}
                        onAppBarToggle={noOp}
                        onFullscreenToggle={noOp}
                        onHideSubtitlePlayer={noOp}
                        onVideoPopOut={noOp}
                        onPlayModeChangedViaBind={noOp}
                        onSubtitles={setSubtitles}
                        onTakeScreenshot={noOp}
                        tab={syncedVideoTab}
                        availableTabs={extension.tabs ?? []}
                        extension={extension}
                        drawerOpen={false}
                        appBarHidden={true}
                        videoFullscreen={false}
                        hideSubtitlePlayer={false}
                        videoPopOut={false}
                        disableKeyEvents={false}
                        ankiDialogRequested={false}
                        keyBinder={keyBinder}
                        ankiDialogOpen={false}
                    />
                    <SidePanelControls
                        disabled={currentTabId !== syncedVideoTab?.id}
                        onMineSubtitle={handleMineSubtitle}
                        postMineAction={settings.streamingSidePanelDefaultPostMineAction}
                        emptySubtitleTrack={subtitles.length === 0}
                        audioRecordingEnabled={settings.streamingRecordMedia}
                        recordingAudio={recordingAudio}
                    />
                </>
            )}
        </>
    );
}
