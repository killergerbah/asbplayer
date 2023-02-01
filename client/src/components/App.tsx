import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Route, Navigate, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { ThemeProvider, createTheme, makeStyles, Theme } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/useWindowSize';
import { red } from '@material-ui/core/colors';
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
} from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from './Alert';
import { AnkiDialog, ImageDialog } from '@project/common/components';
import CssBaseline from '@material-ui/core/CssBaseline';
import DragOverlay from './DragOverlay';
import SubtitleReader from '../services/SubtitleReader';
import Bar from './Bar';
import ChromeExtension, { ExtensionMessage } from '../services/ChromeExtension';
import CopyHistory, { CopyHistoryItem } from './CopyHistory';
import LandingPage from './LandingPage';
import Player, { AnkiDialogFinishedRequest, MediaSources } from './Player';
import SettingsDialog from './SettingsDialog';
import SettingsProvider from '../services/SettingsProvider';
import VideoPlayer from './VideoPlayer';
import { Color } from '@material-ui/lab';
import { AnkiExportMode } from '@project/common';
import { DefaultKeyBinder } from '@project/common/src/KeyBinder';
import AppKeyBinder from '../services/AppKeyBinder';
import VideoChannel from '../services/VideoChannel';
import { ChromeExtensionProvider } from '../services/ChromeExtensionProvider';
import PlaybackPreferences from '../services/PlaybackPreferences';

const latestExtensionVersion = '0.25.0';
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
    let subtitleFiles = [];
    let audioFile = undefined;
    let videoFile = undefined;

    for (let i = 0; i < files.length; ++i) {
        const f = files[i];
        const extensionStartIndex = f.name.lastIndexOf('.');

        if (extensionStartIndex === -1) {
            throw new Error('Unable to determine extension of ' + f.name);
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
                    throw new Error('Cannot open two video files simultaneously');
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
                    throw new Error('Cannot open two audio files simultaneously');
                }
                audioFile = f;
                break;
            default:
                throw new Error('Unsupported extension ' + extension);
        }
    }

    if (videoFile && audioFile) {
        throw new Error('Cannot load both an audio and video file simultaneously');
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
            item.subtitleFile!.name,
            Math.max(0, start - (item.audio.paddingStart ?? 0)),
            end + (item.audio.paddingEnd ?? 0),
            item.audio.playbackRate ?? 1,
            item.audio.base64,
            item.audio.extension
        );
    }

    if (item.audioFile || item.videoFile) {
        let start;
        let end;

        if (sliderContext) {
            start = sliderContext.subtitleStart;
            end = sliderContext.subtitleEnd;
        } else {
            start = item.start;
            end = item.end;
        }

        return AudioClip.fromFile(
            (item.audioFile || item.videoFile)!,
            Math.max(0, start - paddingStart),
            end + paddingEnd,
            item.filePlaybackRate ?? 1,
            item.audioTrack
        );
    }

    return undefined;
}

function imageFromItem(item: CopyHistoryItem, maxWidth: number, maxHeight: number) {
    if (item.image) {
        return Image.fromBase64(item.subtitleFile!.name, item.start, item.image.base64, item.image.extension);
    }

    if (item.videoFile) {
        return Image.fromFile(item.videoFile, item.mediaTimestamp ?? item.start, maxWidth, maxHeight);
    }

    return undefined;
}

function itemSourceString(item: CopyHistoryItem | undefined) {
    if (!item) {
        return undefined;
    }

    const source = item.subtitleFile?.name ?? item.audioFile?.name ?? item.videoFile?.name;

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

interface NavigateToVideoProps {
    searchParams: URLSearchParams;
}

function NavigateToVideo({ searchParams }: NavigateToVideoProps) {
    const videoFile = searchParams.get('video')!;
    const channel = searchParams.get('channel')!;
    const popOut = searchParams.get('popout')!;

    return (
        <Navigate to={'/video?video=' + encodeURIComponent(videoFile) + '&channel=' + channel + '&popout=' + popOut} />
    );
}

interface RenderVideoProps {
    searchParams: URLSearchParams;
    settingsProvider: SettingsProvider;
    playbackPreferences: PlaybackPreferences;
    extension: ChromeExtension;
    ankiDialogFinishedRequest: AnkiDialogFinishedRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        timestamp: number
    ) => void;
    onError: (error: string) => void;
    onPlayModeChangedViaBind: (oldPlayMode: PlayMode, newPlayMode: PlayMode) => void;
}

function RenderVideo({
    searchParams,
    settingsProvider,
    playbackPreferences,
    extension,
    ankiDialogFinishedRequest,
    onAnkiDialogRequest,
    onError,
    onPlayModeChangedViaBind,
}: RenderVideoProps) {
    const videoFile = searchParams.get('video')!;
    const channel = searchParams.get('channel')!;
    const popOut = searchParams.get('popout')! === 'true';

    return (
        <VideoPlayer
            settingsProvider={settingsProvider}
            playbackPreferences={playbackPreferences}
            extension={extension}
            videoFile={videoFile}
            popOut={popOut}
            channel={channel}
            ankiDialogFinishedRequest={ankiDialogFinishedRequest}
            onAnkiDialogRequest={onAnkiDialogRequest}
            onError={onError}
            onPlayModeChangedViaBind={onPlayModeChangedViaBind}
        />
    );
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

function App() {
    const subtitleReader = useMemo<SubtitleReader>(() => new SubtitleReader(), []);
    const settingsProvider = useMemo<SettingsProvider>(() => new SettingsProvider(), []);
    const playbackPreferences = useMemo<PlaybackPreferences>(
        () => new PlaybackPreferences(settingsProvider),
        [settingsProvider]
    );
    const theme = useMemo<Theme>(
        () =>
            createTheme({
                palette: {
                    primary: {
                        main: '#49007a',
                    },
                    secondary: {
                        main: '#ff1f62',
                    },
                    error: {
                        main: red.A400,
                    },
                    type: settingsProvider.themeType,
                },
            }),
        [settingsProvider.themeType]
    );
    const anki = useMemo<Anki>(() => new Anki(settingsProvider), [settingsProvider]);
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const inVideoPlayer = location.pathname === '/video' || searchParams.get('video') !== null;
    const extensionProvider = useMemo(() => new ChromeExtensionProvider(), []);
    const [extension, setExtension] = useState<ChromeExtension>(extensionProvider.extension);
    const [videoFullscreen, setVideoFullscreen] = useState<boolean>(false);
    useEffect(() => extensionProvider.onChromeExtension(setExtension), [extensionProvider]);
    const keyBinder = useMemo<AppKeyBinder>(
        () => new AppKeyBinder(new DefaultKeyBinder(settingsProvider.keyBindSet), extension),
        [settingsProvider.keyBindSet, extension]
    );
    const videoFrameRef = useRef<HTMLIFrameElement>(null);
    const videoChannelRef = useRef<VideoChannel>(null);
    const [width] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? 0.2 : 0.3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
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
    const [loading, setLoading] = useState<boolean>(false);
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
    const [availableTabs, setAvailableTabs] = useState<VideoTabModel[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ankiDialogRequestedRef = useRef<boolean>(false);
    ankiDialogRequestedRef.current = ankiDialogRequested;
    const { subtitleFiles } = sources;

    const handleError = useCallback((message: string) => {
        setAlertSeverity('error');
        setAlert(message);
        setAlertOpen(true);
    }, []);

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
                        setAlert('Exported card: ' + result);
                        setAlertOpen(true);
                    } else if (mode === 'updateLast') {
                        setAlertSeverity('success');
                        setAlert('Updated card: ' + result);
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
                console.error(e);
                if (e instanceof Error) {
                    handleError(e.message);
                } else {
                    handleError(String(e));
                }
            } finally {
                setAnkiDialogDisabled(false);
                setDisableKeyEvents(false);
            }
        },
        [anki, handleError]
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
            preventDuplicate: boolean | undefined,
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
                name: fileName!,
                subtitleFile: subtitleFile,
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
                if (preventDuplicate && copiedSubtitles.length > 0) {
                    const last = copiedSubtitles[copiedSubtitles.length - 1];

                    if (
                        subtitle.start === last.start &&
                        subtitle.end === last.end &&
                        subtitle.text === last.text &&
                        subtitleFile?.name === last.subtitleFile?.name
                    ) {
                        if (mediaTimestamp !== undefined && mediaTimestamp !== last.mediaTimestamp) {
                            const newCopiedSubtitles = [...copiedSubtitles];
                            newCopiedSubtitles[newCopiedSubtitles.length - 1] = newCopiedSubtitle;
                            return newCopiedSubtitles;
                        }

                        return copiedSubtitles;
                    }
                }

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
                        subtitle.text,
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
                    subtitle.text === '' ? `Saved ${humanReadableTime(subtitle.start)}` : `Copied: "${subtitle.text}"`
                );
                setAlertOpen(true);
            }
        },
        [fileName, settingsProvider, handleAnkiDialogProceed, handleAnkiDialogRequest]
    );

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
            setSettingsDialogOpen(false);
            setSettingsDialogScrollToId(undefined);

            // ATM only the Anki dialog may appear under the settings dialog,
            // so it's the only one we need to check to re-enable key events
            setDisableKeyEvents(ankiDialogOpen);

            videoChannelRef.current?.subtitleSettings(settingsProvider.subtitleSettings);
            videoChannelRef.current?.ankiSettings(settingsProvider.ankiSettings);
            videoChannelRef.current?.miscSettings(settingsProvider.miscSettings);
        },
        [settingsProvider, ankiDialogOpen]
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
        },
        [copiedSubtitles]
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
                console.error(e);
                if (e instanceof Error) {
                    handleError(e.message);
                } else {
                    handleError(String(e));
                }
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
                if (e instanceof Error) {
                    handleError(e.message);
                } else {
                    handleError(String(e));
                }
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
            if (!subtitleFiles.find((f) => f.name === item.subtitleFile?.name)) {
                handleError('Subtitle file ' + item.subtitleFile?.name + ' is not open.');
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
        [subtitleFiles, handleError]
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

        if (!subtitleFiles.find((f) => f.name === ankiDialogItem.subtitleFile?.name)) {
            handleError('Subtitle file ' + ankiDialogItem.subtitleFile?.name + ' is not open.');
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
        setJumpToSubtitle(subtitle);

        handleAnkiDialogCancel();
    }, [ankiDialogItem, subtitleFiles, handleAnkiDialogCancel, handleError]);

    const handleViewImage = useCallback((image: Image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    useEffect(() => {
        function onTabs(tabs: VideoTabModel[]) {
            if (tabs.length !== availableTabs.length) {
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
                handleError('Lost connection with tab ' + tab!.id + ' ' + tab!.title);
            }
        }

        return extension.subscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError]);

    const handleTabSelected = useCallback((tab: VideoTabModel) => setTab(tab), []);

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            try {
                let { subtitleFiles, audioFile, videoFile } = extractSources(files);

                setSources((previous) => {
                    setLoading(true);

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

                    return sources;
                });

                if (subtitleFiles.length > 0) {
                    const subtitleFileName = subtitleFiles[0].name;
                    setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                }
            } catch (e) {
                console.error(e);
                if (e instanceof Error) {
                    handleError(e.message);
                } else {
                    handleError(String(e));
                }
            }
        },
        [handleError]
    );

    const handleDirectory = useCallback(
        async (items: DataTransferItemList) => {
            if (items.length !== 1) {
                handleError('Cannot load more than one directory at a time');
                return;
            }

            const fileSystemEntry = items[0].webkitGetAsEntry();

            if (!fileSystemEntry || !fileSystemEntry.isDirectory) {
                handleError('Failed to load directory');
                return;
            }

            const fileSystemDirectoryEntry = fileSystemEntry as FileSystemDirectoryEntry;

            try {
                const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
                    fileSystemDirectoryEntry.createReader().readEntries(resolve, reject)
                );

                if (entries.find((e) => e.isDirectory)) {
                    handleError('Cannot load a directory with subdirectories');
                    return;
                }

                const filePromises = entries.map(
                    (e) => new Promise<File>((resolve, reject) => (e as FileSystemFileEntry).file(resolve, reject))
                );
                const files: File[] = [];

                for (const f of filePromises) {
                    files.push(await f);
                }

                handleFiles(files);
            } catch (e) {
                console.error(e);
                if (e instanceof Error) {
                    handleError(e.message);
                } else {
                    handleError(String(e));
                }
            }
        },
        [handleError, handleFiles]
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

                const subtitleFileName = subtitleFiles[0].name;
                setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                setSources({
                    subtitleFiles: subtitleFiles,
                    flattenSubtitleFiles: flatten,
                    audioFile: undefined,
                    audioFileUrl: undefined,
                    videoFile: undefined,
                    videoFileUrl: undefined,
                });
                setTab(tab);
            } else if (message.data.command === 'edit-keyboard-shortcuts') {
                setSettingsDialogOpen(true);
                setSettingsDialogScrollToId('keyboard-shortcuts');
            }
        }

        const unsubscribe = extension.subscribe(onMessage);
        extension.startHeartbeat(false);
        return unsubscribe;
    }, [extension, inVideoPlayer]);

    const handleAutoPauseModeChangedViaBind = useCallback((oldPlayMode: PlayMode, newPlayMode: PlayMode) => {
        switch (newPlayMode) {
            case PlayMode.autoPause:
                setAlert('Auto-pause: On');
                break;
            case PlayMode.condensed:
                setAlert('Condensed playback: On');
                break;
            case PlayMode.normal:
                if (oldPlayMode === PlayMode.autoPause) {
                    setAlert('Auto-pause: Off');
                } else if (oldPlayMode === PlayMode.condensed) {
                    setAlert('Condensed playback: Off');
                }
                break;
        }

        setAlertSeverity('info');
        setAlertOpen(true);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();

            if (inVideoPlayer) {
                handleError('Video player cannot receive dropped files. Drop outside of the video frame instead.');
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
                handleFiles(e.dataTransfer.files);
            }
        },
        [inVideoPlayer, handleError, handleFiles, handleDirectory, ankiDialogOpen]
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleFiles(files);
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

    const handleSourcesLoaded = useCallback(() => setLoading(false), []);

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

    if (location.pathname === '/' && searchParams.get('video')) {
        return <NavigateToVideo searchParams={searchParams} />;
    }

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
                <Routes>
                    <Route
                        path="/video"
                        element={
                            <>
                                <RenderVideo
                                    searchParams={searchParams}
                                    settingsProvider={settingsProvider}
                                    playbackPreferences={playbackPreferences}
                                    extension={extension}
                                    ankiDialogFinishedRequest={ankiDialogFinishedRequest}
                                    onAnkiDialogRequest={handleAnkiDialogRequestFromVideoPlayer}
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
                                    onRewind={handleAnkiDialogRewind}
                                    onProceed={handleAnkiDialogProceed}
                                    onViewImage={handleViewImage}
                                />
                                <ImageDialog open={imageDialogOpen} image={image} onClose={handleImageDialogClosed} />
                            </>
                        }
                    />
                    <Route
                        path="/"
                        element={
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
                                    onRewind={handleAnkiDialogRewind}
                                    onProceed={handleAnkiDialogProceed}
                                    onViewImage={handleViewImage}
                                    onOpenSettings={handleOpenSettings}
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
                                    <Player
                                        subtitleReader={subtitleReader}
                                        settingsProvider={settingsProvider}
                                        playbackPreferences={playbackPreferences}
                                        onCopy={handleCopy}
                                        onError={handleError}
                                        onUnloadAudio={handleUnloadAudio}
                                        onUnloadVideo={handleUnloadVideo}
                                        onLoaded={handleSourcesLoaded}
                                        onTabSelected={handleTabSelected}
                                        onAnkiDialogRequest={handleAnkiDialogRequest}
                                        onAppBarToggle={handleAppBarToggle}
                                        onFullscreenToggle={handleFullscreenToggle}
                                        onHideSubtitlePlayer={handleHideSubtitlePlayer}
                                        onVideoPopOut={handleVideoPopOut}
                                        onPlayModeChangedViaBind={handleAutoPauseModeChangedViaBind}
                                        tab={tab}
                                        availableTabs={availableTabs}
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
                                    />
                                </Content>
                            </div>
                        }
                    />
                </Routes>
            </div>
        </ThemeProvider>
    );
}

export default App;
