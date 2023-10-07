import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { i18n, useI18nInitialized } from './i18n';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ThemeProvider, makeStyles, Theme } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/use-window-size';
import {
    Anki,
    AudioClip,
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
} from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from './Alert';
import { AnkiDialog, ImageDialog } from '@project/common/components';
import CssBaseline from '@material-ui/core/CssBaseline';
import DragOverlay from './DragOverlay';
import SubtitleReader from '../services/subtitle-reader';
import Bar from './Bar';
import ChromeExtension, { ExtensionMessage } from '../services/chrome-extension';
import CopyHistory, { CopyHistoryItem } from './CopyHistory';
import LandingPage from './LandingPage';
import Player, { AnkiDialogFinishedRequest, MediaSources } from './Player';
import SettingsDialog from './SettingsDialog';
import SettingsProvider from '@project/common/src/settings-provider';
import VideoPlayer, { SeekRequest } from './VideoPlayer';
import { Color } from '@material-ui/lab';
import { AnkiExportMode } from '@project/common';
import { DefaultKeyBinder } from '@project/common/key-binder';
import AppKeyBinder from '../services/app-key-binder';
import VideoChannel from '../services/video-channel';
import PlaybackPreferences from '../services/playback-preferences';
import CopyHistoryRepository from '../services/copy-history-repository';
import './i18n';
import { useTranslation } from 'react-i18next';
import LocalizedError from './localized-error';
import { useChromeExtension } from '../hooks/use-chrome-extension';
import FileRepository from '../services/file-repository';
import CachedLocalStorage from '../services/cached-local-storage';

const latestExtensionVersion = '0.28.0';
const extensionUrl = 'https://github.com/killergerbah/asbplayer/releases/latest';
const lastSubtitleFileId = 'last-subtitle-file';

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
    let subtitleFiles = [];
    let audioFile = undefined;
    let videoFile = undefined;

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
                if (audioFile) {
                    throw new LocalizedError('error.onlyOneAudioFile');
                }
                audioFile = f;
                break;
            default:
                throw new LocalizedError('error.unsupportedExtension', { extension });
        }
    }

    if (videoFile && audioFile) {
        throw new LocalizedError('error.bothAudioAndVideNotAllowed');
    }

    return { subtitleFiles: subtitleFiles, audioFile: audioFile, videoFile: videoFile };
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
    if (sources.audioFileUrl) {
        URL.revokeObjectURL(sources.audioFileUrl);
    }

    if (sources.videoFileUrl) {
        URL.revokeObjectURL(sources.videoFileUrl);
    }
}

interface RenderVideoProps {
    searchParams: URLSearchParams;
    settingsProvider: SettingsProvider;
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

function App({ sidePanel }: { sidePanel: boolean }) {
    const { t } = useTranslation();
    const settingsProvider = useMemo<SettingsProvider>(() => new SettingsProvider(new CachedLocalStorage()), []);
    const subtitleReader = useMemo<SubtitleReader>(() => {
        let regex: RegExp | undefined;

        try {
            regex =
                settingsProvider.subtitleRegexFilter.trim() === ''
                    ? undefined
                    : new RegExp(settingsProvider.subtitleRegexFilter, 'g');
        } catch (e) {
            regex = undefined;
        }

        if (regex !== undefined) {
            return new SubtitleReader({ regex, replacement: settingsProvider.subtitleRegexFilterTextReplacement });
        }

        return new SubtitleReader();
    }, [settingsProvider.subtitleRegexFilter, settingsProvider.subtitleRegexFilterTextReplacement]);
    const playbackPreferences = useMemo<PlaybackPreferences>(
        () => new PlaybackPreferences(settingsProvider),
        [settingsProvider]
    );
    const theme = useMemo<Theme>(() => createTheme(settingsProvider.themeType), [settingsProvider.themeType]);
    const anki = useMemo<Anki>(() => new Anki(settingsProvider), [settingsProvider]);
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const inVideoPlayer = searchParams.get('video') !== null;
    const extension = useChromeExtension(sidePanel);
    const [videoFullscreen, setVideoFullscreen] = useState<boolean>(false);
    const keyBinder = useMemo<AppKeyBinder>(
        () => new AppKeyBinder(new DefaultKeyBinder(settingsProvider.keyBindSet), extension),
        [settingsProvider.keyBindSet, extension]
    );
    const videoFrameRef = useRef<HTMLIFrameElement>(null);
    const videoChannelRef = useRef<VideoChannel>(null);
    const [videoPlayerSeekRequest, setVideoPlayerSeekRequest] = useState<SeekRequest>();
    const [width] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? 0.2 : 0.3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
    const copyHistoryRepository = useMemo(
        () => new CopyHistoryRepository(settingsProvider.miningHistoryStorageLimit),
        [settingsProvider]
    );
    const fileRepository = useMemo(() => new FileRepository(), []);
    useEffect(() => {
        copyHistoryRepository.limit = settingsProvider.miningHistoryStorageLimit;
    }, [copyHistoryRepository, settingsProvider.miningHistoryStorageLimit]);
    const [copiedSubtitles, setCopiedSubtitles] = useState<CopyHistoryItem[]>([]);
    const copiedSubtitlesRef = useRef<CopyHistoryItem[]>([]);
    copiedSubtitlesRef.current = copiedSubtitles;
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
                settingsProvider.audioPaddingStart,
                settingsProvider.audioPaddingEnd
            ),
        [
            ankiDialogItem,
            ankiDialogItemSliderContext,
            settingsProvider.audioPaddingStart,
            settingsProvider.audioPaddingEnd,
        ]
    );
    const ankiDialogImage = useMemo<Image | undefined>(
        () =>
            ankiDialogItem &&
            imageFromItem(ankiDialogItem, settingsProvider.maxImageWidth, settingsProvider.maxImageHeight),
        [ankiDialogItem, settingsProvider.maxImageWidth, settingsProvider.maxImageHeight]
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
        if (!ankiDialogItem && copiedSubtitlesRef.current!.length === 0) {
            return;
        }

        const item = ankiDialogItem ?? copiedSubtitlesRef.current[copiedSubtitlesRef.current.length - 1];
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
            if (sources.videoFile === undefined || copiedSubtitles.length === 0) {
                return;
            }

            const lastCopyHistoryItem = copiedSubtitles[copiedSubtitles.length - 1];
            const newCopyHistoryItem = {
                ...lastCopyHistoryItem,
                id: uuidv4(),
                image: undefined,
                videoFile: sources.videoFile,
                mediaTimestamp,
            };

            setCopiedSubtitles((copiedSubtitles) => [...copiedSubtitles, newCopyHistoryItem]);
            copyHistoryRepository.save(newCopyHistoryItem);
            handleAnkiDialogRequest(newCopyHistoryItem);
        },
        [sources.videoFile, copiedSubtitles, handleAnkiDialogRequest, copyHistoryRepository]
    );

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
            if (subtitle && settingsProvider.copyToClipboardOnMine) {
                navigator.clipboard.writeText(subtitle.text);
            }

            const newCopiedSubtitle = {
                ...subtitle,
                surroundingSubtitles: surroundingSubtitles,
                timestamp: Date.now(),
                id: id || uuidv4(),
                name: fileName ?? subtitleFile?.name ?? videoFile?.name ?? audioFile?.name ?? '',
                subtitleFileName: subtitleFile?.name,
                audioFile: audioFile,
                videoFile: videoFile,
                filePlaybackRate: filePlaybackRate,
                mediaTimestamp: mediaTimestamp,
                audioTrack: audioTrack,
                audio: audio,
                image: image,
                url: url,
            };

            setCopiedSubtitles((copiedSubtitles) => {
                // Note: we are not dealing with the case where an item with the given ID is already in the list
                return [...copiedSubtitles, newCopiedSubtitle];
            });

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
                        settingsProvider.audioPaddingStart,
                        settingsProvider.audioPaddingEnd
                    );

                    if (audioClip && settingsProvider.preferMp3) {
                        audioClip = audioClip.toMp3();
                    }

                    handleAnkiDialogProceed(
                        extractText(subtitle, surroundingSubtitles),
                        '',
                        audioClip,
                        imageFromItem(
                            newCopiedSubtitle,
                            settingsProvider.maxImageWidth,
                            settingsProvider.maxImageHeight
                        ),
                        '',
                        itemSourceString(newCopiedSubtitle) ?? '',
                        '',
                        {},
                        settingsProvider.tags,
                        'updateLast'
                    );
                    break;
                default:
                    throw new Error('Unknown post mine action: ' + postMineAction);
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

            copyHistoryRepository.save(newCopiedSubtitle);
        },
        [fileName, settingsProvider, copyHistoryRepository, handleAnkiDialogProceed, handleAnkiDialogRequest, t]
    );

    useEffect(() => {
        if (inVideoPlayer) {
            return;
        }

        (async () => {
            setCopiedSubtitles(await copyHistoryRepository.fetch(settingsProvider.miningHistoryStorageLimit));
        })();
    }, [inVideoPlayer, copyHistoryRepository, settingsProvider]);

    const handleOpenCopyHistory = useCallback(() => {
        setCopyHistoryOpen((copyHistoryOpen) => !copyHistoryOpen);
        setVideoFullscreen(false);
    }, []);
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
    const handleCloseSettings = useCallback(
        (newSettings: AsbplayerSettings) => {
            settingsProvider.settings = newSettings;

            if (i18n.language !== settingsProvider.language) {
                i18n.changeLanguage(settingsProvider.language);
            }

            setSettingsDialogOpen(false);
            setSettingsDialogScrollToId(undefined);

            // ATM only the Anki dialog may appear under the settings dialog,
            // so it's the only one we need to check to re-enable key events
            setDisableKeyEvents(ankiDialogOpen);

            videoChannelRef.current?.subtitleSettings(settingsProvider.subtitleSettings);
            videoChannelRef.current?.ankiSettings(settingsProvider.ankiSettings);
            videoChannelRef.current?.miscSettings(settingsProvider.miscSettings);
            extension.publishSharedGlobalSettings(settingsProvider.miscSettings);
        },
        [settingsProvider, ankiDialogOpen, extension]
    );

    const handleDeleteCopyHistoryItem = useCallback(
        (item: CopyHistoryItem) => {
            const newCopiedSubtitles = [];

            for (let subtitle of copiedSubtitles) {
                if (item.id !== subtitle.id) {
                    newCopiedSubtitles.push(subtitle);
                }
            }

            setCopiedSubtitles(newCopiedSubtitles);
            copyHistoryRepository.delete(item.id);
        },
        [copiedSubtitles, copyHistoryRepository]
    );

    const handleUnloadAudio = useCallback(
        (audioFileUrl: string) => {
            if (audioFileUrl !== sources.audioFileUrl) {
                return;
            }

            setSources((previous) => {
                URL.revokeObjectURL(audioFileUrl);

                return {
                    subtitleFiles: previous.subtitleFiles,
                    audioFile: undefined,
                    audioFileUrl: undefined,
                    videoFile: previous.videoFile,
                    videoFileUrl: previous.videoFileUrl,
                };
            });
        },
        [sources]
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
                    audioFile: previous.audioFile,
                    audioFileUrl: previous.audioFileUrl,
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
                    settingsProvider.audioPaddingStart,
                    settingsProvider.audioPaddingEnd
                );

                if (settingsProvider.preferMp3) {
                    clip!.toMp3().download();
                } else {
                    clip!.download();
                }
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, settingsProvider]
    );

    const handleDownloadImage = useCallback(
        async (item: CopyHistoryItem) => {
            try {
                (await imageFromItem(
                    item,
                    settingsProvider.maxImageWidth,
                    settingsProvider.maxImageHeight
                ))!.download();
            } catch (e) {
                console.error(e);
                handleError(e);
            }
        },
        [handleError, settingsProvider]
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
                playbackPreferences.lastSyncedTab = undefined;
                handleError(t('error.lostTabConnection', { tabName: tab!.id + ' ' + tab!.title }));
            }
        }

        return extension.subscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError, playbackPreferences, t]);

    const handleTabSelected = useCallback(
        (tab: VideoTabModel) => {
            setTab(tab);
            playbackPreferences.lastSyncedTab = tab;
        },
        [playbackPreferences]
    );

    const handleFiles = useCallback(
        ({
            files,
            flattenSubtitleFiles,
            skipPersistingSubtitleFiles,
        }: {
            files: FileList | File[];
            flattenSubtitleFiles?: boolean;
            skipPersistingSubtitleFiles?: boolean;
        }) => {
            try {
                let { subtitleFiles, audioFile, videoFile } = extractSources(files);

                setSources((previous) => {
                    let videoFileUrl = undefined;
                    let audioFileUrl = undefined;

                    if (videoFile || audioFile) {
                        revokeUrls(previous);

                        if (videoFile) {
                            videoFileUrl = URL.createObjectURL(videoFile);
                        } else if (audioFile) {
                            audioFileUrl = URL.createObjectURL(audioFile);
                        }

                        setTab(undefined);
                        playbackPreferences.lastSyncedTab = undefined;
                    } else {
                        videoFile = previous.videoFile;
                        videoFileUrl = previous.videoFileUrl;
                        audioFile = previous.audioFile;
                        audioFileUrl = previous.audioFileUrl;
                    }

                    const sources = {
                        subtitleFiles: subtitleFiles.length === 0 ? previous.subtitleFiles : subtitleFiles,
                        audioFile: audioFile,
                        audioFileUrl: audioFileUrl,
                        videoFile: videoFile,
                        videoFileUrl: videoFileUrl,
                    };

                    const sourcesToList = (s: MediaSources) =>
                        [...s.subtitleFiles, s.videoFile, s.audioFile].filter((f) => f !== undefined) as File[];

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

                    if (!skipPersistingSubtitleFiles) {
                        fileRepository.save(lastSubtitleFileId, subtitleFiles, { flattenSubtitleFiles });
                    }
                }
            } catch (e) {
                console.error(e);
                handleError(e);
            }
        },
        [handleError, fileRepository, playbackPreferences]
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
            extension.startHeartbeat(true);
            return undefined;
        }

        async function onMessage(message: ExtensionMessage) {
            if (message.data.command === 'sync' || message.data.command === 'syncv2') {
                const tabs = extension.tabs.filter((t) => {
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
                playbackPreferences.lastSyncedTab = tab;
            } else if (message.data.command === 'edit-keyboard-shortcuts') {
                setSettingsDialogOpen(true);
                setSettingsDialogScrollToId('keyboard-shortcuts');
            } else if (message.data.command === 'open-asbplayer-settings') {
                setSettingsDialogOpen(true);
            }
        }

        const unsubscribe = extension.subscribe(onMessage);
        extension.startHeartbeat(false);
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

    const [autoSyncEffectRan, setAutoSyncEffectRan] = useState<boolean>(false);

    useEffect(() => {
        if (autoSyncEffectRan) {
            return;
        }

        try {
            const lastSyncedTab = playbackPreferences.lastSyncedTab;

            if (lastSyncedTab === undefined || availableTabs === undefined) {
                return;
            }

            const canAutoSync =
                availableTabs.find((t) => t.id === lastSyncedTab.id && t.src === lastSyncedTab.src) !== undefined;

            if (!canAutoSync) {
                return;
            }

            const loadLastSubtitleFiles = async () => {
                if (!inVideoPlayer) {
                    const lastSubtitleFiles = await fileRepository.fetch(lastSubtitleFileId);

                    if (loadLastSubtitleFiles !== undefined) {
                        handleFiles({
                            files: lastSubtitleFiles.files,
                            flattenSubtitleFiles: lastSubtitleFiles.metadata?.flattenSubtitleFiles ?? false,
                            skipPersistingSubtitleFiles: true,
                        });
                        setTab(lastSyncedTab);
                    }
                }
            };

            loadLastSubtitleFiles();
        } finally {
            if (availableTabs !== undefined) {
                setAutoSyncEffectRan(true);
            }
        }
    }, [fileRepository, inVideoPlayer, handleFiles, tab, playbackPreferences, availableTabs, autoSyncEffectRan]);

    const handleCopyToClipboard = useCallback((blob: Blob) => {
        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(console.error);
    }, []);

    const { i18nInitialized } = useI18nInitialized();

    if (!i18nInitialized) {
        return null;
    }

    const loading = loadingSources.length !== 0;
    const nothingLoaded =
        (loading && !videoFrameRef.current) ||
        (sources.subtitleFiles.length === 0 && !sources.audioFile && !sources.videoFile);
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
                            settingsProvider={settingsProvider}
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
                            customFields={settingsProvider.customAnkiFields}
                            anki={anki}
                            settingsProvider={settingsProvider}
                            onCancel={handleAnkiDialogCancel}
                            onProceed={handleAnkiDialogProceed}
                            onViewImage={handleViewImage}
                            onCopyToClipboard={handleCopyToClipboard}
                        />
                        <ImageDialog open={imageDialogOpen} image={image} onClose={handleImageDialogClosed} />
                    </>
                ) : (
                    <div>
                        <CopyHistory
                            items={copiedSubtitles}
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
                            customFields={settingsProvider.customAnkiFields}
                            anki={anki}
                            settingsProvider={settingsProvider}
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
                            onClose={handleCloseSettings}
                            settings={settingsProvider.settings}
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
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
                                <DragOverlay dragging={dragging} appBarHidden={appBarHidden} loading={loading} />
                            </div>
                            <Player
                                subtitleReader={subtitleReader}
                                settingsProvider={settingsProvider}
                                playbackPreferences={playbackPreferences}
                                onCopy={handleCopy}
                                onError={handleError}
                                onUnloadAudio={handleUnloadAudio}
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
                    </div>
                )}
            </div>
        </ThemeProvider>
    );
}

export default App;
