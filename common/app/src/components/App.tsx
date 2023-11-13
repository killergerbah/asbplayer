import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import { useWindowSize } from '../hooks/use-window-size';
import {
    Image,
    humanReadableTime,
    AnkiDialogSliderContext,
    SubtitleModel,
    VideoTabModel,
    LegacyPlayerSyncMessage,
    PlayerSyncMessage,
    AudioModel,
    ImageModel,
    AsbplayerSettings,
    PostMineAction,
    PlayMode,
    download,
    extractText,
    createTheme,
    CopyHistoryItem,
    Fetcher,
} from '@project/common';
import { AudioClip } from '@project/common/audio-clip';
import { Anki, AnkiExportMode } from '@project/common/anki';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from './Alert';
import { AnkiDialog, ImageDialog } from '@project/common/components';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';
import DragOverlay from './DragOverlay';
import Bar from './Bar';
import ChromeExtension, { ExtensionMessage } from '../services/chrome-extension';
import CopyHistory from './CopyHistory';
import LandingPage from './LandingPage';
import Player, { AnkiDialogFinishedRequest, MediaSources } from './Player';
import SettingsDialog from './SettingsDialog';
import VideoPlayer, { SeekRequest } from './VideoPlayer';
import { Color } from '@material-ui/lab';
import { DefaultKeyBinder } from '@project/common/key-binder';
import AppKeyBinder from '../services/app-key-binder';
import VideoChannel from '../services/video-channel';
import PlaybackPreferences from '../services/playback-preferences';
import { useTranslation } from 'react-i18next';
import LocalizedError from './localized-error';
import { DisplaySubtitleModel } from './SubtitlePlayer';
import { useCopyHistory } from '../hooks/use-copy-history';
import { useI18n } from '../../../hooks';

const latestExtensionVersion = '0.28.0';
const extensionUrl = 'https://github.com/killergerbah/asbplayer/releases/latest';

const useContentStyles = makeStyles<Theme, ContentProps>((theme) => ({
    content: {
        flexGrow: 1,
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        marginRight: 0,
    },
    contentShift: ({ drawerWidth }) => ({
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: drawerWidth,
    }),
}));

function extractSources(files: FileList | File[]): MediaSources {
    let subtitleFiles: File[] = [];
    let audioFile: File | undefined = undefined;
    let videoFile: File | undefined = undefined;

    for (let i = 0; i < files.length; ++i) {
        const f = files[i];
        const extensionStartIndex = f.name.lastIndexOf('.');

        if (extensionStartIndex === -1) {
            throw new LocalizedError('error.unknownExtension', { fileName: f.name });
        }

        const extension = f.name.substring(extensionStartIndex + 1, f.name.length);
        switch (extension) {
            case 'ass':
            case 'srt':
            case 'vtt':
            case 'nfvtt':
            case 'sup':
            case 'ytxml':
            case 'dfxp':
            case 'ttml2':
                subtitleFiles.push(f);
                break;
            case 'mkv':
            case 'mp4':
            case 'avi':
                if (videoFile) {
                    throw new LocalizedError('error.onlyOneVideoFile');
                }
                videoFile = f;
                break;
            case 'mp3':
            case 'm4a':
            case 'aac':
            case 'flac':
            case 'ogg':
            case 'wav':
            case 'opus':
                if (videoFile) {
                    throw new LocalizedError('error.onlyOneAudioFile');
                }
                videoFile = f;
                break;
            default:
                throw new LocalizedError('error.unsupportedExtension', { extension });
        }
    }

    if (videoFile && audioFile) {
        throw new LocalizedError('error.bothAudioAndVideNotAllowed');
    }

    return { subtitleFiles: subtitleFiles, videoFile: videoFile };
}

function audioClipFromItem(
    item: CopyHistoryItem,
    sliderContext: AnkiDialogSliderContext | undefined,
    paddingStart: number,
    paddingEnd: number
) {
    if (item.audio) {
        const start = item.audio.start ?? item.start;
        const end = item.audio.end ?? item.end;

        return AudioClip.fromBase64(
            item.subtitleFileName!,
            Math.max(0, start - (item.audio.paddingStart ?? 0)),
            end + (item.audio.paddingEnd ?? 0),
            item.audio.playbackRate ?? 1,
            item.audio.base64,
            item.audio.extension
        );
    }

    const calculateInterval = () => {
        let start;
        let end;

        if (sliderContext) {
            start = sliderContext.subtitleStart;
            end = sliderContext.subtitleEnd;
        } else {
            start = item.start;
            end = item.end;
        }

        return [start, end];
    };

    if (item.audioFile || item.videoFile) {
        const [start, end] = calculateInterval();
        return AudioClip.fromFile(
            (item.audioFile || item.videoFile)!,
            Math.max(0, start - paddingStart),
            end + paddingEnd,
            item.filePlaybackRate ?? 1,
            item.audioTrack
        );
    }

    if (item.audioFileName || item.videoFileName) {
        const [start, end] = calculateInterval();
        return AudioClip.fromMissingFile((item.audioFileName || item.videoFileName)!, start, end);
    }

    return undefined;
}

function imageFromItem(item: CopyHistoryItem, maxWidth: number, maxHeight: number) {
    if (item.image) {
        return Image.fromBase64(item.subtitleFileName!, item.start, item.image.base64, item.image.extension);
    }

    if (item.videoFile) {
        return Image.fromFile(item.videoFile, item.mediaTimestamp ?? item.start, maxWidth, maxHeight);
    }

    if (item.videoFileName) {
        return Image.fromMissingFile(item.videoFileName, item.mediaTimestamp ?? item.start);
    }

    return undefined;
}

function itemSourceString(item: CopyHistoryItem | undefined) {
    if (!item) {
        return undefined;
    }

    const source = item.subtitleFileName ?? item.audioFile?.name ?? item.videoFile?.name;

    if (!source) {
        return undefined;
    }

    return `${source} (${humanReadableTime(item.start)})`;
}

function itemSliderContext(item: CopyHistoryItem) {
    if (!item) {
        return undefined;
    }

    return {
        subtitleStart: item.start,
        subtitleEnd: item.end,
        subtitles: item.surroundingSubtitles || [
            { start: item.start, end: item.end, text: item.text, track: item.track },
        ],
    };
}

function revokeUrls(sources: MediaSources) {
    if (sources.videoFileUrl) {
        URL.revokeObjectURL(sources.videoFileUrl);
    }
}

interface RenderVideoProps {
    searchParams: URLSearchParams;
    settings: AsbplayerSettings;
    playbackPreferences: PlaybackPreferences;
    extension: ChromeExtension;
    ankiDialogFinishedRequest: AnkiDialogFinishedRequest;
    ankiDialogOpen: boolean;
    seekRequest?: SeekRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        timestamp: number
    ) => void;
    onAnkiDialogRewind: () => void;
    onError: (error: string) => void;
    onPlayModeChangedViaBind: (oldPlayMode: PlayMode, newPlayMode: PlayMode) => void;
}

function RenderVideo({ searchParams, ...props }: RenderVideoProps) {
    const videoFile = searchParams.get('video')!;
    const channel = searchParams.get('channel')!;
    const popOut = searchParams.get('popout')! === 'true';

    return <VideoPlayer videoFile={videoFile} channel={channel} popOut={popOut} {...props} />;
}

interface ContentProps {
    drawerOpen: boolean;
    drawerWidth: number;
    children: React.ReactNode[];
}

function Content(props: ContentProps) {
    const classes = useContentStyles(props);

    return (
        <main
            className={clsx(classes.content, {
                [classes.contentShift]: props.drawerOpen,
            })}
        >
            {props.children}
        </main>
    );
}

interface Props {
    origin: string;
    logoUrl: string;
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    fetcher: Fetcher;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
}

function App({ origin, logoUrl, settings, extension, fetcher, onSettingsChanged }: Props) {
    const { t } = useTranslation();
    const subtitleReader = useMemo<SubtitleReader>(() => {
        return new SubtitleReader({
            regexFilter: settings.subtitleRegexFilter,
            regexFilterTextReplacement: settings.subtitleRegexFilterTextReplacement,
        });
    }, [settings.subtitleRegexFilter, settings.subtitleRegexFilterTextReplacement]);
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>([]);
    const playbackPreferences = useMemo<PlaybackPreferences>(
        () => new PlaybackPreferences(settings, extension),
        [settings, extension]
    );
    const theme = useMemo<Theme>(() => createTheme(settings.themeType), [settings.themeType]);
    const anki = useMemo<Anki>(() => new Anki(settings, fetcher), [settings, fetcher]);
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const inVideoPlayer = useMemo(() => searchParams.get('video') !== null, [searchParams]);
    const [videoFullscreen, setVideoFullscreen] = useState<boolean>(false);
    const keyBinder = useMemo<AppKeyBinder>(
        () => new AppKeyBinder(new DefaultKeyBinder(settings.keyBindSet), extension),
        [settings.keyBindSet, extension]
    );
    const videoFrameRef = useRef<HTMLIFrameElement>(null);
    const videoChannelRef = useRef<VideoChannel>(null);
    const [videoPlayerSeekRequest, setVideoPlayerSeekRequest] = useState<SeekRequest>();
    const [width] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? 0.2 : 0.3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
    const { copyHistoryItems, refreshCopyHistory, deleteCopyHistoryItem, saveCopyHistoryItem } = useCopyHistory(
        settings.miningHistoryStorageLimit
    );
    const copyHistoryItemsRef = useRef<CopyHistoryItem[]>([]);
    copyHistoryItemsRef.current = copyHistoryItems;
    const [copyHistoryOpen, setCopyHistoryOpen] = useState<boolean>(false);
    const [theaterMode, setTheaterMode] = useState<boolean>(playbackPreferences.theaterMode);
    const [hideSubtitlePlayer, setHideSubtitlePlayer] = useState<boolean>(false);
    const [videoPopOut, setVideoPopOut] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<Color>();
    const [jumpToSubtitle, setJumpToSubtitle] = useState<SubtitleModel>();
    const [rewindSubtitle, setRewindSubtitle] = useState<SubtitleModel>();
    const [sources, setSources] = useState<MediaSources>({ subtitleFiles: [] });
    const [loadingSources, setLoadingSources] = useState<File[]>([]);
    const [dragging, setDragging] = useState<boolean>(false);
    const dragEnterRef = useRef<Element | null>(null);
    const [fileName, setFileName] = useState<string>();
    const [ankiDialogOpen, setAnkiDialogOpen] = useState<boolean>(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState<boolean>(false);
    const [ankiDialogItem, setAnkiDialogItem] = useState<CopyHistoryItem>();
    const ankiDialogItemSliderContext = useMemo<AnkiDialogSliderContext | undefined>(
        () => ankiDialogItem && itemSliderContext(ankiDialogItem),
        [ankiDialogItem]
    );
    const ankiDialogAudioClip = useMemo<AudioClip | undefined>(
        () =>
            ankiDialogItem &&
            audioClipFromItem(
                ankiDialogItem,
                ankiDialogItemSliderContext,
                settings.audioPaddingStart,
                settings.audioPaddingEnd
            ),
        [ankiDialogItem, ankiDialogItemSliderContext, settings.audioPaddingStart, settings.audioPaddingEnd]
    );
    const ankiDialogImage = useMemo<Image | undefined>(
        () => ankiDialogItem && imageFromItem(ankiDialogItem, settings.maxImageWidth, settings.maxImageHeight),
        [ankiDialogItem, settings.maxImageWidth, settings.maxImageHeight]
    );
    const [ankiDialogRequested, setAnkiDialogRequested] = useState<boolean>(false);
    const [ankiDialogFinishedRequest, setAnkiDialogFinishedRequest] = useState<AnkiDialogFinishedRequest>({
        timestamp: 0,
        resume: false,
    });
    const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
    const [settingsDialogScrollToId, setSettingsDialogScrollToId] = useState<string>();
    const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false);
    const [disableKeyEvents, setDisableKeyEvents] = useState<boolean>(false);
    const [image, setImage] = useState<Image>();
    const [tab, setTab] = useState<VideoTabModel>();
    const [availableTabs, setAvailableTabs] = useState<VideoTabModel[]>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ankiDialogRequestedRef = useRef<boolean>(false);
    ankiDialogRequestedRef.current = ankiDialogRequested;
    const { subtitleFiles } = sources;

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

    const handleAnkiDialogRequest = useCallback((ankiDialogItem?: CopyHistoryItem) => {
        if (!ankiDialogItem && copyHistoryItemsRef.current!.length === 0) {
            return;
        }

        const item = ankiDialogItem ?? copyHistoryItemsRef.current[copyHistoryItemsRef.current.length - 1];
        setAnkiDialogItem(item);
        setAnkiDialogOpen(true);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(true);
        setAnkiDialogRequested(true);
    }, []);

    const handleAnkiDialogRequestFromVideoPlayer = useCallback(
        async (
            videoFileUrl: string,
            videoFileName: string,
            selectedAudioTrack: string | undefined,
            playbackRate: number,
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            timestamp: number
        ) => {
            const item = {
                ...subtitle,
                surroundingSubtitles: surroundingSubtitles,
                timestamp: Date.now(),
                id: uuidv4(),
                name: videoFileName,
                mediaTimestamp: timestamp,
                videoFile: await fetch(videoFileUrl)
                    .then((r) => r.blob())
                    .then((blobFile) => new File([blobFile], videoFileName)),
                selectedAudioTrack: selectedAudioTrack,
                filePlaybackRate: playbackRate,
            };
            handleAnkiDialogRequest(item);
        },
        [handleAnkiDialogRequest]
    );

    const handleAnkiDialogProceed = useCallback(
        async (
            text: string,
            definition: string,
            audioClip: AudioClip | undefined,
            image: Image | undefined,
            word: string,
            source: string,
            url: string,
            customFieldValues: { [key: string]: string },
            tags: string[],
            mode: AnkiExportMode
        ) => {
            setAnkiDialogDisabled(true);

            try {
                const result = await anki.export(
                    text,
                    definition,
                    audioClip,
                    image,
                    word,
                    source,
                    url,
                    customFieldValues,
                    tags,
                    mode
                );

                if (mode !== 'gui') {
                    if (mode === 'default') {
                        setAlertSeverity('success');
                        setAlert(t('info.exportedCard', { result })!);
                        setAlertOpen(true);
                    } else if (mode === 'updateLast') {
                        setAlertSeverity('success');
                        setAlert(t('info.updatedCard', { result })!);
                        setAlertOpen(true);
                    }

                    setAnkiDialogOpen(false);

                    // We need the ref to avoid causing a state change that would re-init Player
                    // It's a future task to make the Player init hook depend on less state
                    if (ankiDialogRequestedRef.current) {
                        setAnkiDialogFinishedRequest({ timestamp: Date.now(), resume: true });
                        setAnkiDialogRequested(false);
                    }
                }
            } catch (e) {
                handleError(e);
            } finally {
                setAnkiDialogDisabled(false);
                setDisableKeyEvents(false);
            }
        },
        [anki, handleError, t]
    );

    const handleTakeScreenshot = useCallback(
        (mediaTimestamp: number) => {
            if (sources.videoFile === undefined || copyHistoryItems.length === 0) {
                return;
            }

            const lastCopyHistoryItem = copyHistoryItems[copyHistoryItems.length - 1];
            const newCopyHistoryItem = {
                ...lastCopyHistoryItem,
                id: uuidv4(),
                image: undefined,
                videoFile: sources.videoFile,
                mediaTimestamp,
            };

            saveCopyHistoryItem(newCopyHistoryItem);
            handleAnkiDialogRequest(newCopyHistoryItem);
        },
        [sources.videoFile, copyHistoryItems, handleAnkiDialogRequest, saveCopyHistoryItem]
    );

    const handleCopy = useCallback(
        async (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
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

            if (extension.supportsAppIntegration) {
                extension.publishCard({
                    id,
                    subtitle,
                    surroundingSubtitles,
                    subtitleFileName: subtitleFile?.name ?? videoFile?.name ?? '',
                    url,
                    image,
                    audio,
                    mediaTimestamp: mediaTimestamp ?? 0,
                });
            } else {
                const newCopiedSubtitle = {
                    ...subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    timestamp: Date.now(),
                    id: id || uuidv4(),
                    name: fileName ?? subtitleFile?.name ?? videoFile?.name ?? '',
                    subtitleFileName: subtitleFile?.name,
                    videoFile: videoFile,
                    filePlaybackRate: filePlaybackRate,
                    mediaTimestamp: mediaTimestamp,
                    audioTrack: audioTrack,
                    audio: audio,
                    image: image,
                    url: url,
                };

                saveCopyHistoryItem(newCopiedSubtitle);

                switch (postMineAction ?? PostMineAction.none) {
                    case PostMineAction.none:
                        break;
                    case PostMineAction.showAnkiDialog:
                        handleAnkiDialogRequest(newCopiedSubtitle);
                        break;
                    case PostMineAction.updateLastCard:
                        // FIXME: We should really rename the functions below because we're actually skipping the Anki dialog in this case
                        setAnkiDialogRequested(true);
                        let audioClip = audioClipFromItem(
                            newCopiedSubtitle,
                            undefined,
                            settings.audioPaddingStart,
                            settings.audioPaddingEnd
                        );

                        if (audioClip && settings.preferMp3) {
                            audioClip = audioClip.toMp3();
                        }

                        handleAnkiDialogProceed(
                            extractText(subtitle, surroundingSubtitles),
                            '',
                            audioClip,
                            imageFromItem(newCopiedSubtitle, settings.maxImageWidth, settings.maxImageHeight),
                            '',
                            itemSourceString(newCopiedSubtitle) ?? '',
                            '',
                            {},
                            settings.tags,
                            'updateLast'
                        );
                        break;
                    default:
                        throw new Error('Unknown post mine action: ' + postMineAction);
                }
            }

            if (subtitle) {
                setAlertSeverity('success');
                setAlert(
                    subtitle.text === ''
                        ? t('info.savedTimestamp', { timestamp: humanReadableTime(subtitle.start) })!
                        : t('info.copiedSubtitle', { text: subtitle.text })!
                );
                setAlertOpen(true);
            }
        },
        [fileName, settings, extension, saveCopyHistoryItem, handleAnkiDialogProceed, handleAnkiDialogRequest, t]
    );

    const handleOpenCopyHistory = useCallback(async () => {
        if (extension.supportsAppIntegration) {
            extension.toggleSidePanel();
        } else {
            await refreshCopyHistory();
            setCopyHistoryOpen((copyHistoryOpen) => !copyHistoryOpen);
            setVideoFullscreen(false);
        }
    }, [extension, refreshCopyHistory]);
    const handleCloseCopyHistory = useCallback(() => setCopyHistoryOpen(false), []);
    const handleAppBarToggle = useCallback(() => {
        const newValue = !playbackPreferences.theaterMode;
        playbackPreferences.theaterMode = newValue;
        setTheaterMode(newValue);
        setVideoFullscreen(false);
    }, [playbackPreferences]);
    const handleFullscreenToggle = useCallback(() => {
        setVideoFullscreen((fullscreen) => !fullscreen);
    }, []);
    useEffect(() => {
        if (videoFullscreen) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }, [videoFullscreen]);
    useEffect(() => {
        const listener = () => {
            if (!document.fullscreenElement) {
                setVideoFullscreen(false);
            }
        };
        document.addEventListener('fullscreenchange', listener);
        return () => document.removeEventListener('fullscreenchange', listener);
    }, []);
    const handleHideSubtitlePlayer = useCallback(() => {
        setHideSubtitlePlayer((hidden) => !hidden);
    }, []);
    const handleVideoPopOut = useCallback(() => {
        setVideoPopOut((videoPopOut) => !videoPopOut);
        setHideSubtitlePlayer(false);
    }, []);
    const handleOpenSettings = useCallback(() => {
        setDisableKeyEvents(true);
        setSettingsDialogOpen(true);
    }, []);
    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const handleImageDialogClosed = useCallback(() => setImageDialogOpen(false), []);
    const handleCloseSettings = useCallback(() => {
        setSettingsDialogOpen(false);
        setSettingsDialogScrollToId(undefined);

        // ATM only the Anki dialog may appear under the settings dialog,
        // so it's the only one we need to check to re-enable key events
        setDisableKeyEvents(ankiDialogOpen);
        videoChannelRef.current?.subtitleSettings(settings);
        videoChannelRef.current?.ankiSettings(settings);
        videoChannelRef.current?.miscSettings(settings);
    }, [settings, ankiDialogOpen, extension]);

    const handleDeleteCopyHistoryItem = useCallback(
        (item: CopyHistoryItem) => {
            deleteCopyHistoryItem(item);
        },
        [deleteCopyHistoryItem]
    );

    const handleUnloadVideo = useCallback(
        (videoFileUrl: string) => {
            if (videoFileUrl !== sources.videoFileUrl) {
                return;
            }

            setSources((previous) => {
                URL.revokeObjectURL(videoFileUrl);

                return {
                    subtitleFiles: previous.subtitleFiles,
                    videoFile: undefined,
                    videoFileUrl: undefined,
                };
            });
            setVideoFullscreen(false);
        },
        [sources]
    );

    const handleClipAudio = useCallback(
        async (item: CopyHistoryItem) => {
            try {
                const clip = await audioClipFromItem(
                    item,
                    undefined,
                    settings.audioPaddingStart,
                    settings.audioPaddingEnd
                );

                if (settings.preferMp3) {
                    clip!.toMp3().download();
                } else {
                    clip!.download();
                }
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, settings]
    );

    const handleDownloadImage = useCallback(
        async (item: CopyHistoryItem) => {
            try {
                (await imageFromItem(item, settings.maxImageWidth, settings.maxImageHeight))!.download();
            } catch (e) {
                console.error(e);
                handleError(e);
            }
        },
        [handleError, settings]
    );

    const handleDownloadCopyHistorySectionAsSrt = useCallback(
        (name: string, items: CopyHistoryItem[]) => {
            const deduplicated: SubtitleModel[] = [];

            for (const item of items) {
                if (
                    deduplicated.find((i) => i.start === item.start && i.end === item.end && i.text === item.text) ===
                    undefined
                ) {
                    deduplicated.push(item);
                }
            }

            download(
                new Blob([subtitleReader.subtitlesToSrt(deduplicated)], { type: 'text/plain' }),
                `${name}_MiningHistory_${new Date().toISOString()}.srt`
            );
        },
        [subtitleReader]
    );

    const handleSelectCopyHistoryItem = useCallback(
        (item: CopyHistoryItem) => {
            if (!subtitleFiles.find((f) => f.name === item.subtitleFileName)) {
                handleError(t('error.subtitleFileNotOpen', { fileName: item.subtitleFileName }));
                return;
            }

            setJumpToSubtitle({
                text: item.text,
                start: item.start,
                end: item.end,
                originalStart: item.originalStart,
                originalEnd: item.originalEnd,
                track: item.track,
            });
        },
        [subtitleFiles, handleError, t]
    );

    const handleAnki = useCallback((item: CopyHistoryItem) => {
        setAnkiDialogItem(item);
        setAnkiDialogOpen(true);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(true);
    }, []);

    const handleAnkiDialogCancel = useCallback(() => {
        setAnkiDialogOpen(false);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(false);

        if (ankiDialogRequested) {
            setAnkiDialogFinishedRequest({ timestamp: Date.now(), resume: true });
            setAnkiDialogRequested(false);
        }
    }, [ankiDialogRequested]);

    const handleAnkiDialogRewind = useCallback(() => {
        if (!ankiDialogItem) {
            return;
        }

        if (!subtitleFiles.find((f) => f.name === ankiDialogItem.subtitleFileName)) {
            handleError(t('error.subtitleFileNotOpen', { fileName: ankiDialogItem.subtitleFileName }));
            return;
        }

        const subtitle = {
            text: ankiDialogItem.text,
            start: ankiDialogItem.start,
            end: ankiDialogItem.end,
            originalStart: ankiDialogItem.originalStart,
            originalEnd: ankiDialogItem.originalEnd,
            track: ankiDialogItem.track,
        };
        setRewindSubtitle(subtitle);
        handleAnkiDialogCancel();
    }, [ankiDialogItem, subtitleFiles, handleAnkiDialogCancel, handleError, t]);

    const handleAnkiDialogRewindFromVideoPlayer = useCallback(() => {
        if (!ankiDialogItem) {
            return;
        }

        const subtitle = {
            text: ankiDialogItem.text,
            start: ankiDialogItem.start,
            end: ankiDialogItem.end,
            originalStart: ankiDialogItem.originalStart,
            originalEnd: ankiDialogItem.originalEnd,
            track: ankiDialogItem.track,
        };
        setVideoPlayerSeekRequest({ timestamp: subtitle.start });
        handleAnkiDialogCancel();
    }, [ankiDialogItem, handleAnkiDialogCancel]);

    const handleViewImage = useCallback((image: Image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    useEffect(() => {
        function onTabs(tabs: VideoTabModel[]) {
            if (availableTabs === undefined || tabs.length !== availableTabs.length) {
                setAvailableTabs(tabs);
            } else {
                let update = false;

                for (let i = 0; i < availableTabs.length; ++i) {
                    const t1 = availableTabs[i];
                    const t2 = tabs[i];
                    if (t1.id !== t2.id || t1.title !== t2.title || t1.src !== t2.src) {
                        update = true;
                        break;
                    }
                }

                if (update) {
                    setAvailableTabs(tabs);
                }
            }

            let selectedTabMissing = tab && tabs.filter((t) => t.id === tab.id && t.src === tab.src).length === 0;

            if (selectedTabMissing) {
                setTab(undefined);
                handleError(t('error.lostTabConnection', { tabName: tab!.id + ' ' + tab!.title }));
            }
        }

        return extension.subscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError, t]);

    const handleTabSelected = useCallback((tab: VideoTabModel) => {
        setTab(tab);
    }, []);

    const handleFiles = useCallback(
        ({ files, flattenSubtitleFiles }: { files: FileList | File[]; flattenSubtitleFiles?: boolean }) => {
            try {
                let { subtitleFiles, videoFile } = extractSources(files);

                setSources((previous) => {
                    let videoFileUrl: string | undefined = undefined;

                    if (videoFile) {
                        revokeUrls(previous);

                        if (videoFile) {
                            videoFileUrl = URL.createObjectURL(videoFile);
                        }

                        setTab(undefined);
                    } else {
                        videoFile = previous.videoFile;
                        videoFileUrl = previous.videoFileUrl;
                    }

                    const sources = {
                        subtitleFiles: subtitleFiles.length === 0 ? previous.subtitleFiles : subtitleFiles,
                        videoFile: videoFile,
                        videoFileUrl: videoFileUrl,
                        flattenSubtitleFiles,
                    };

                    const sourcesToList = (s: MediaSources) =>
                        [...s.subtitleFiles, s.videoFile].filter((f) => f !== undefined) as File[];

                    const previousLoadingSources = sourcesToList(previous);
                    const loadingSources = sourcesToList(sources).filter((f) => {
                        for (const previousLoadingSource of previousLoadingSources) {
                            if (f === previousLoadingSource) {
                                return false;
                            }
                        }

                        return true;
                    });
                    setLoadingSources(loadingSources);
                    return sources;
                });

                if (subtitleFiles.length > 0) {
                    const subtitleFileName = subtitleFiles[0].name;
                    setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                }
            } catch (e) {
                console.error(e);
                handleError(e);
            }
        },
        [handleError, playbackPreferences]
    );

    const handleDirectory = useCallback(
        async (items: DataTransferItemList) => {
            if (items.length !== 1) {
                handleError(t('error.onlyOneDirectoryAllowed'));
                return;
            }

            const fileSystemEntry = items[0].webkitGetAsEntry();

            if (!fileSystemEntry || !fileSystemEntry.isDirectory) {
                handleError(t('error.failedToLoadDirectory'));
                return;
            }

            const fileSystemDirectoryEntry = fileSystemEntry as FileSystemDirectoryEntry;

            try {
                const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
                    fileSystemDirectoryEntry.createReader().readEntries(resolve, reject)
                );

                if (entries.find((e) => e.isDirectory)) {
                    handleError(t('error.subdirectoriesNotAllowed'));
                    return;
                }

                const filePromises = entries.map(
                    (e) => new Promise<File>((resolve, reject) => (e as FileSystemFileEntry).file(resolve, reject))
                );
                const files: File[] = [];

                for (const f of filePromises) {
                    files.push(await f);
                }

                handleFiles({ files });
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, handleFiles, t]
    );

    useEffect(() => {
        if (inVideoPlayer) {
            extension.startHeartbeat({ fromVideoPlayer: true });
            return undefined;
        }

        async function onMessage(message: ExtensionMessage) {
            if (message.data.command === 'sync' || message.data.command === 'syncv2') {
                const tabs = (extension.tabs ?? []).filter((t) => {
                    if (t.id !== message.tabId) {
                        return false;
                    }

                    return !message.src || t.src === message.src;
                });

                if (tabs.length === 0) {
                    if (message.src) {
                        console.error(
                            'Received sync request but the requesting tab ID ' +
                                message.tabId +
                                ' with src ' +
                                message.src +
                                ' was not found'
                        );
                    } else {
                        console.error(
                            'Received sync request but the requesting tab ID ' + message.tabId + ' was not found'
                        );
                    }

                    return;
                }

                const tab = tabs[0];
                let subtitleFiles: File[];
                let flatten = false;

                if (message.data.command === 'sync') {
                    const syncMessage = message.data as LegacyPlayerSyncMessage;
                    subtitleFiles = [
                        new File(
                            [await (await fetch('data:text/plain;base64,' + syncMessage.subtitles.base64)).blob()],
                            syncMessage.subtitles.name
                        ),
                    ];
                } else if (message.data.command === 'syncv2') {
                    const syncMessage = message.data as PlayerSyncMessage;
                    subtitleFiles = await Promise.all(
                        syncMessage.subtitles.map(
                            async (s) =>
                                new File([await (await fetch('data:text/plain;base64,' + s.base64)).blob()], s.name)
                        )
                    );
                    flatten = syncMessage.flatten ?? false;
                } else {
                    console.error('Unknown message ' + message.data.command);
                    return;
                }

                handleFiles({ files: subtitleFiles, flattenSubtitleFiles: flatten });
                setTab(tab);
            } else if (message.data.command === 'edit-keyboard-shortcuts') {
                setSettingsDialogOpen(true);
                setSettingsDialogScrollToId('keyboard-shortcuts');
            } else if (message.data.command === 'open-asbplayer-settings') {
                setSettingsDialogOpen(true);
            }
        }

        const unsubscribe = extension.subscribe(onMessage);
        extension.startHeartbeat({ fromVideoPlayer: false });
        return unsubscribe;
    }, [extension, playbackPreferences, inVideoPlayer, handleFiles]);

    const handleAutoPauseModeChangedViaBind = useCallback(
        (oldPlayMode: PlayMode, newPlayMode: PlayMode) => {
            switch (newPlayMode) {
                case PlayMode.autoPause:
                    setAlert(t('info.enabledAutoPause')!);
                    break;
                case PlayMode.condensed:
                    setAlert(t('info.enabledCondensedPlayback')!);
                    break;
                case PlayMode.normal:
                    if (oldPlayMode === PlayMode.autoPause) {
                        setAlert(t('info.disabledAutoPause')!);
                    } else if (oldPlayMode === PlayMode.condensed) {
                        setAlert(t('info.disabledCondensedPlayback')!);
                    }
                    break;
            }

            setAlertSeverity('info');
            setAlertOpen(true);
        },
        [t]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();

            if (inVideoPlayer) {
                handleError(t('error.videoPlayerDragAndDropNotAllowed'));
                return;
            }

            setDragging(false);
            dragEnterRef.current = null;

            function allDirectories(items: DataTransferItemList) {
                for (let i = 0; i < items.length; ++i) {
                    if (!items[i].webkitGetAsEntry()?.isDirectory) {
                        return false;
                    }
                }

                return true;
            }

            if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && allDirectories(e.dataTransfer.items)) {
                handleDirectory(e.dataTransfer.items);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles({ files: e.dataTransfer.files });
            }
        },
        [inVideoPlayer, handleError, handleFiles, handleDirectory, ankiDialogOpen, t]
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleFiles({ files });
        }
    }, [handleFiles]);

    const handleFileSelector = useCallback(() => fileInputRef.current?.click(), []);

    const handleDownloadSubtitleFilesAsSrt = useCallback(async () => {
        if (sources.subtitleFiles === undefined) {
            return;
        }

        const nonSupSubtitleFiles = sources.subtitleFiles.filter((f) => !f.name.endsWith('.sup'));

        if (nonSupSubtitleFiles.length === 0) {
            return;
        }

        download(
            new Blob([await subtitleReader.filesToSrt(nonSupSubtitleFiles)], {
                type: 'text/plain',
            }),
            `${fileName}.srt`
        );
    }, [fileName, sources.subtitleFiles, subtitleReader]);

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();
        },
        [ankiDialogOpen]
    );

    const handleDragEnter = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (!inVideoPlayer) {
                dragEnterRef.current = e.target as Element;
                setDragging(true);
            }
        },
        [inVideoPlayer, ankiDialogOpen]
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.nativeEvent.preventDefault();
            e.nativeEvent.stopPropagation();

            if (!inVideoPlayer && dragEnterRef.current === e.target) {
                setDragging(false);
            }
        },
        [inVideoPlayer]
    );

    const handleFilesLoaded = useCallback((loadedFiles: File[]) => {
        setLoadingSources((loadingFiles) =>
            loadingFiles?.filter((loadingFile) => {
                for (const loadedFile of loadedFiles) {
                    if (loadedFile === loadingFile) {
                        return false;
                    }
                }

                return true;
            })
        );
    }, []);

    useEffect(() => {
        var view = searchParams.get('view');
        if (view === 'settings') {
            setSettingsDialogOpen(true);

            if (location.hash && location.hash.startsWith('#')) {
                const id = location.hash.substring(1, location.hash.length);
                setSettingsDialogScrollToId(id);
            }
        }
    }, [searchParams, location]);

    useEffect(() => {
        if (alertOpen && alert && alertSeverity) {
            videoChannelRef.current?.alert(alert, alertSeverity);
        }
    }, [alert, alertSeverity, alertOpen]);

    const handleCopyToClipboard = useCallback((blob: Blob) => {
        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(console.error);
    }, []);

    useEffect(() => {
        return keyBinder.bindToggleSidePanel(
            () => {
                handleOpenCopyHistory();
            },
            () => ankiDialogOpen,
            false
        );
    }, [handleOpenCopyHistory, ankiDialogOpen]);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    if (!i18nInitialized) {
        return null;
    }

    const loading = loadingSources.length !== 0;
    const nothingLoaded =
        (loading && !videoFrameRef.current) || (sources.subtitleFiles.length === 0 && !sources.videoFile);
    const appBarHidden = sources.videoFile !== undefined && ((theaterMode && !videoPopOut) || videoFullscreen);
    const effectiveCopyHistoryOpen = copyHistoryOpen && !videoFullscreen;

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
            >
                <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                    {alert}
                </Alert>
                {inVideoPlayer ? (
                    <>
                        <RenderVideo
                            searchParams={searchParams}
                            settings={settings}
                            playbackPreferences={playbackPreferences}
                            extension={extension}
                            ankiDialogFinishedRequest={ankiDialogFinishedRequest}
                            ankiDialogOpen={ankiDialogOpen}
                            seekRequest={videoPlayerSeekRequest}
                            onAnkiDialogRequest={handleAnkiDialogRequestFromVideoPlayer}
                            onAnkiDialogRewind={handleAnkiDialogRewindFromVideoPlayer}
                            onError={handleError}
                            onPlayModeChangedViaBind={handleAutoPauseModeChangedViaBind}
                        />
                        <AnkiDialog
                            open={ankiDialogOpen}
                            disabled={ankiDialogDisabled}
                            audioClip={ankiDialogAudioClip}
                            image={ankiDialogImage}
                            source={itemSourceString(ankiDialogItem)}
                            url={ankiDialogItem?.url}
                            sliderContext={ankiDialogItemSliderContext}
                            customFields={settings.customAnkiFields}
                            anki={anki}
                            settingsProvider={settings}
                            onCancel={handleAnkiDialogCancel}
                            onProceed={handleAnkiDialogProceed}
                            onViewImage={handleViewImage}
                            onCopyToClipboard={handleCopyToClipboard}
                        />
                        <ImageDialog open={imageDialogOpen} image={image} onClose={handleImageDialogClosed} />
                    </>
                ) : (
                    <Paper>
                        <CopyHistory
                            items={copyHistoryItems}
                            open={effectiveCopyHistoryOpen}
                            drawerWidth={drawerWidth}
                            onClose={handleCloseCopyHistory}
                            onDelete={handleDeleteCopyHistoryItem}
                            onClipAudio={handleClipAudio}
                            onDownloadImage={handleDownloadImage}
                            onDownloadSectionAsSrt={handleDownloadCopyHistorySectionAsSrt}
                            onSelect={handleSelectCopyHistoryItem}
                            onAnki={handleAnki}
                        />
                        <AnkiDialog
                            open={ankiDialogOpen}
                            disabled={ankiDialogDisabled}
                            audioClip={ankiDialogAudioClip}
                            image={ankiDialogImage}
                            source={itemSourceString(ankiDialogItem)}
                            url={ankiDialogItem?.url}
                            sliderContext={ankiDialogItemSliderContext}
                            customFields={settings.customAnkiFields}
                            anki={anki}
                            settingsProvider={settings}
                            onCancel={handleAnkiDialogCancel}
                            onProceed={handleAnkiDialogProceed}
                            onViewImage={handleViewImage}
                            onOpenSettings={handleOpenSettings}
                            onCopyToClipboard={handleCopyToClipboard}
                        />
                        <ImageDialog open={imageDialogOpen} image={image} onClose={handleImageDialogClosed} />
                        <SettingsDialog
                            anki={anki}
                            extension={extension}
                            open={settingsDialogOpen}
                            onSettingsChanged={onSettingsChanged}
                            onClose={handleCloseSettings}
                            settings={settings}
                            scrollToId={settingsDialogScrollToId}
                        />
                        <Bar
                            title={fileName || 'asbplayer'}
                            drawerWidth={drawerWidth}
                            drawerOpen={effectiveCopyHistoryOpen}
                            hidden={appBarHidden}
                            subtitleFiles={sources.subtitleFiles}
                            onOpenCopyHistory={handleOpenCopyHistory}
                            onDownloadSubtitleFilesAsSrt={handleDownloadSubtitleFilesAsSrt}
                            onOpenSettings={handleOpenSettings}
                            onFileSelector={handleFileSelector}
                        />
                        <input
                            ref={fileInputRef}
                            onChange={handleFileInputChange}
                            type="file"
                            accept=".srt,.ass,.vtt,.sup,.mp3,.m4a,.aac,.flac,.ogg,.wav,.opus,.mkv,.mp4,.avi"
                            multiple
                            hidden
                        />
                        <Content drawerWidth={drawerWidth} drawerOpen={effectiveCopyHistoryOpen}>
                            <Paper style={{ width: '100%', height: '100%', position: 'relative' }}>
                                {nothingLoaded && (
                                    <LandingPage
                                        latestExtensionVersion={latestExtensionVersion}
                                        extensionUrl={extensionUrl}
                                        extension={extension}
                                        loading={loading}
                                        dragging={dragging}
                                        appBarHidden={appBarHidden}
                                        onFileSelector={handleFileSelector}
                                    />
                                )}
                                <DragOverlay
                                    dragging={dragging}
                                    appBarHidden={appBarHidden}
                                    logoUrl={logoUrl}
                                    loading={loading}
                                />
                            </Paper>
                            <Player
                                origin={origin}
                                subtitleReader={subtitleReader}
                                subtitles={subtitles}
                                settings={settings}
                                playbackPreferences={playbackPreferences}
                                onCopy={handleCopy}
                                onError={handleError}
                                onUnloadVideo={handleUnloadVideo}
                                onLoaded={handleFilesLoaded}
                                onTabSelected={handleTabSelected}
                                onAnkiDialogRequest={handleAnkiDialogRequest}
                                onAnkiDialogRewind={handleAnkiDialogRewind}
                                onAppBarToggle={handleAppBarToggle}
                                onFullscreenToggle={handleFullscreenToggle}
                                onHideSubtitlePlayer={handleHideSubtitlePlayer}
                                onVideoPopOut={handleVideoPopOut}
                                onPlayModeChangedViaBind={handleAutoPauseModeChangedViaBind}
                                onSubtitles={setSubtitles}
                                onTakeScreenshot={handleTakeScreenshot}
                                tab={tab}
                                availableTabs={availableTabs ?? []}
                                sources={sources}
                                jumpToSubtitle={jumpToSubtitle}
                                rewindSubtitle={rewindSubtitle}
                                videoFrameRef={videoFrameRef}
                                videoChannelRef={videoChannelRef}
                                extension={extension}
                                drawerOpen={effectiveCopyHistoryOpen}
                                appBarHidden={appBarHidden}
                                copyButtonEnabled={tab === undefined}
                                videoFullscreen={videoFullscreen}
                                hideSubtitlePlayer={hideSubtitlePlayer || videoFullscreen}
                                videoPopOut={videoPopOut}
                                disableKeyEvents={disableKeyEvents}
                                ankiDialogRequested={ankiDialogRequested}
                                ankiDialogFinishedRequest={ankiDialogFinishedRequest}
                                keyBinder={keyBinder}
                                ankiDialogOpen={ankiDialogOpen}
                            />
                        </Content>
                    </Paper>
                )}
            </div>
        </ThemeProvider>
    );
}

export default App;
