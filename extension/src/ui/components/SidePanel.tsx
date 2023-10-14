import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import {
    AsbplayerSettings,
    AudioModel,
    ImageModel,
    PostMineAction,
    SubtitleModel,
    VideoTabModel,
    createTheme,
} from '@project/common';
import { AppKeyBinder, ChromeExtension, MediaSources, useI18n } from '@project/common/app';
import { useCallback, useMemo, useState } from 'react';
import { Player } from '@project/common/app';
import { SubtitleReader } from '@project/common/app';
import { PlaybackPreferences } from '@project/common/app';
import { Color } from '@material-ui/lab';
import { v4 as uuidv4 } from 'uuid';
import { LocalizedError } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import Alert from '@project/common/app/src/components/Alert';
import { DefaultKeyBinder } from '@project/common/key-binder';
import Paper from '@material-ui/core/Paper';
import SidePanelHome from './SidePanelHome';

interface Props {
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    syncedTab?: VideoTabModel;
    sources: MediaSources;
}

export default function SidePanel({ settings, extension, syncedTab, sources }: Props) {
    const { t } = useTranslation();
    const theme = useMemo(() => createTheme(settings.themeType), [settings.themeType]);
    const playbackPreferences = useMemo(() => new PlaybackPreferences(settings), [settings]);
    const subtitleReader = useMemo(() => new SubtitleReader(), []);

    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<Color>();
    const keyBinder = useMemo(
        () => new AppKeyBinder(new DefaultKeyBinder(settings.keyBindSet), extension),
        [settings.keyBindSet, extension]
    );

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

    const handleCopy = useCallback(
        (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            audioFile: File | undefined,
            videoFile: File | undefined,
            subtitleFile: File | undefined,
            mediaTimestamp: number | undefined,
            audioTrack: string | undefined,
            filePlaybackRate: number | undefined,
            audio: AudioModel | undefined,
            image: ImageModel | undefined,
            url: string | undefined,
            postMineAction: PostMineAction | undefined,
            id: string | undefined
        ) => {
            if (subtitle && settings.copyToClipboardOnMine) {
                navigator.clipboard.writeText(subtitle.text);
            }

            // const newCopiedSubtitle = {
            //     ...subtitle,
            //     surroundingSubtitles: surroundingSubtitles,
            //     timestamp: Date.now(),
            //     id: id || uuidv4(),
            //     name: subtitleFile?.name ?? videoFile?.name ?? audioFile?.name ?? '',
            //     subtitleFileName: subtitleFile?.name,
            //     audioFile: audioFile,
            //     videoFile: videoFile,
            //     filePlaybackRate: filePlaybackRate,
            //     mediaTimestamp: mediaTimestamp,
            //     audioTrack: audioTrack,
            //     audio: audio,
            //     image: image,
            //     url: url,
            // };

            // if (subtitle) {
            //     setAlertSeverity('success');
            //     setAlert(
            //         subtitle.text === ''
            //             ? t('info.savedTimestamp', { timestamp: humanReadableTime(subtitle.start) })!
            //             : t('info.copiedSubtitle', { text: subtitle.text })!
            //     );
            //     setAlertOpen(true);
            // }

            // TODO: Figure out how to implement copy history that deals with ccase when neither app nor side panel is open
            // copyHistoryRepository.save(newCopiedSubtitle);
        },
        [settings]
    );

    const noOp = useCallback(() => {}, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    if (!i18nInitialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                {alert}
            </Alert>
            <Paper square style={{ width: '100%', height: '100%' }}>
                {sources.subtitleFiles.length === 0 ? (
                    <SidePanelHome extension={extension} />
                ) : (
                    <Player
                        hideControls={true}
                        forceCompressedMode={true}
                        subtitleReader={subtitleReader}
                        settings={settings}
                        playbackPreferences={playbackPreferences}
                        onCopy={handleCopy}
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
                        onTakeScreenshot={noOp}
                        tab={syncedTab}
                        availableTabs={extension.tabs ?? []}
                        sources={sources}
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
                )}
            </Paper>
        </ThemeProvider>
    );
}
