import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Route, Redirect, Switch, useLocation } from 'react-router-dom';
import { ThemeProvider, createMuiTheme, makeStyles } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/useWindowSize';
import { red } from '@material-ui/core/colors';
import { Anki, AudioClip, Image, humanReadableTime } from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from './Alert';
import AnkiDialog from './AnkiDialog';
import CssBaseline from '@material-ui/core/CssBaseline';
import DragOverlay from './DragOverlay';
import HelpDialog from './HelpDialog';
import ImageDialog from './ImageDialog';
import SubtitleReader from '../services/SubtitleReader';
import Bar from './Bar';
import ChromeExtension from '../services/ChromeExtension';
import CopyHistory from './CopyHistory';
import LandingPage from './LandingPage';
import Player from './Player';
import SettingsDialog from './SettingsDialog';
import SettingsProvider from '../services/SettingsProvider';
import VideoPlayer from './VideoPlayer';

const latestExtensionVersion = '0.17.0';
const extensionUrl = 'https://github.com/killergerbah/asbplayer/releases/latest';

const useContentStyles = makeStyles((theme) => ({
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

function extractSources(files) {
    let subtitleFiles = [];
    let audioFile = null;
    let videoFile = null;

    for (const f of files) {
        const extensionStartIndex = f.name.lastIndexOf('.');

        if (extensionStartIndex === -1) {
            throw new Error('Unable to determine extension of ' + f.name);
        }

        const extension = f.name.substring(extensionStartIndex + 1, f.name.length);
        switch (extension) {
            case 'ass':
            case 'srt':
            case 'vtt':
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

function audioClipFromItem(item, sliderContext, paddingStart, paddingEnd) {
    if (item.audio) {
        const start = item.audio.start ?? item.start;
        const end = item.audio.end ?? item.end;

        return AudioClip.fromBase64(
            item.subtitleFile.name,
            Math.max(0, start - (item.audio.paddingStart ?? 0)),
            end + (item.audio.paddingEnd ?? 0),
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
            item.audioFile || item.videoFile,
            Math.max(0, start - paddingStart),
            end + paddingEnd,
            item.audioTrack
        );
    }

    return null;
}

function imageFromItem(item, maxWidth, maxHeight) {
    if (item.image) {
        return Image.fromBase64(item.subtitleFile.name, item.start, item.image.base64, item.image.extension);
    }

    if (item.videoFile) {
        return Image.fromFile(item.videoFile, item.start, maxWidth, maxHeight);
    }

    return null;
}

function itemSourceString(item) {
    const source = item?.subtitleFile?.name ?? item?.audioFile?.name ?? item?.videoFile?.name;

    if (!source) {
        return null;
    }

    return `${source} (${humanReadableTime(item.start)})`;
}

function itemSliderContext(item) {
    if (!item) {
        return null;
    }

    return {
        subtitleStart: item.start,
        subtitleEnd: item.end,
        subtitles: item.surroundingSubtitles || [
            { start: item.start, end: item.end, text: item.text, track: item.track },
        ],
    };
}

function revokeUrls(sources) {
    if (sources.audioFileUrl) {
        URL.revokeObjectURL(sources.audioFileUrl);
    }

    if (sources.videoFileUrl) {
        URL.revokeObjectURL(sources.videoFileUrl);
    }
}

function Content(props) {
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
    const subtitleReader = useMemo(() => new SubtitleReader(), []);
    const settingsProvider = useMemo(() => new SettingsProvider(), []);
    const theme = useMemo(
        () =>
            createMuiTheme({
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
    const anki = useMemo(() => new Anki(settingsProvider), [settingsProvider]);
    const location = useLocation();
    const inVideoPlayer = location.pathname === '/video';
    const extension = useMemo(() => new ChromeExtension(!inVideoPlayer), [inVideoPlayer]);
    const videoFrameRef = useRef();
    const [width] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? 0.2 : 0.3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const copiedSubtitlesRef = useRef();
    copiedSubtitlesRef.current = copiedSubtitles;
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [alert, setAlert] = useState();
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertSeverity, setAlertSeverity] = useState();
    const [jumpToSubtitle, setJumpToSubtitle] = useState();
    const [sources, setSources] = useState({ subtitleFiles: [] });
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragEnterRef = useRef();
    const [fileName, setFileName] = useState();
    const [ankiDialogOpen, setAnkiDialogOpen] = useState(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState(false);
    const [ankiDialogItem, setAnkiDialogItem] = useState();
    const ankiDialogItemSliderContext = useMemo(
        () => ankiDialogItem && itemSliderContext(ankiDialogItem),
        [ankiDialogItem]
    );
    const ankiDialogAudioClip = useMemo(
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
    const ankiDialogImage = useMemo(
        () =>
            ankiDialogItem &&
            imageFromItem(ankiDialogItem, settingsProvider.maxImageWidth, settingsProvider.maxImageHeight),
        [ankiDialogItem, settingsProvider.maxImageWidth, settingsProvider.maxImageHeight]
    );
    const [ankiDialogRequestToVideo, setAnkiDialogRequestToVideo] = useState();
    const [ankiDialogRequested, setAnkiDialogRequested] = useState(false);
    const [ankiDialogFinishedRequest, setAnkiDialogFinishedRequest] = useState({ timestamp: 0, resume: false });
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [helpDialogOpen, setHelpDialogOpen] = useState(false);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [disableKeyEvents, setDisableKeyEvents] = useState(false);
    const [image, setImage] = useState();
    const [tab, setTab] = useState();
    const [availableTabs, setAvailableTabs] = useState([]);
    const fileInputRef = useRef();
    const { subtitleFiles } = sources;

    const handleCopy = useCallback(
        (
            subtitle,
            surroundingSubtitles,
            audioFile,
            videoFile,
            subtitleFile,
            audioTrack,
            audio,
            image,
            url,
            preventDuplicate,
            id
        ) => {
            if (subtitle) {
                navigator.clipboard.writeText(subtitle.text);
            }

            setCopiedSubtitles((copiedSubtitles) => {
                if (preventDuplicate && copiedSubtitles.length > 0) {
                    const last = copiedSubtitles[copiedSubtitles.length - 1];

                    if (
                        subtitle.start === last.start &&
                        subtitle.end === last.end &&
                        subtitle.text === last.text &&
                        subtitleFile.name === last.subtitleFile.name
                    ) {
                        return copiedSubtitles;
                    }
                }

                const newCopiedSubtitles = [];
                let updated = false;

                for (const copiedSubtitle of copiedSubtitles) {
                    if (id && copiedSubtitle.id === id) {
                        const newCopiedSubtitle = {
                            ...copiedSubtitle,
                            ...subtitle,
                            ...(surroundingSubtitles && { surroundingSubtitles: surroundingSubtitles }),
                            ...(subtitleFile && { subtitleFile: subtitleFile }),
                            ...(audioFile && { audioFile: audioFile }),
                            ...(videoFile && { videoFile: videoFile }),
                            ...(audioTrack && { audioTrack: audioTrack }),
                            ...(audio && { audio: audio }),
                            ...(image && { image: image }),
                            ...(url && { url: url }),
                        };
                        newCopiedSubtitles.push(newCopiedSubtitle);
                        updated = true;
                    } else {
                        newCopiedSubtitles.push(copiedSubtitle);
                    }
                }

                if (!updated) {
                    newCopiedSubtitles.push({
                        ...subtitle,
                        surroundingSubtitles: surroundingSubtitles,
                        timestamp: Date.now(),
                        id: id || uuidv4(),
                        name: fileName,
                        subtitleFile: subtitleFile,
                        audioFile: audioFile,
                        videoFile: videoFile,
                        audioTrack: audioTrack,
                        audio: audio,
                        image: image,
                        url: url,
                    });
                }

                return newCopiedSubtitles;
            });

            if (subtitle) {
                setAlertSeverity('success');
                setAlert(
                    subtitle.text === '' ? `Saved ${humanReadableTime(subtitle.start)}` : `Copied: "${subtitle.text}"`
                );
                setAlertOpen(true);
            }
        },
        [fileName]
    );

    const handleOpenCopyHistory = useCallback(() => setCopyHistoryOpen((copyHistoryOpen) => !copyHistoryOpen), []);
    const handleCloseCopyHistory = useCallback(() => setCopyHistoryOpen(false), []);
    const handleOpenSettings = useCallback(() => {
        setDisableKeyEvents(true);
        setSettingsDialogOpen(true);
    }, []);
    const handleOpenHelp = useCallback(() => setHelpDialogOpen(true), []);
    const handleCloseHelp = useCallback(() => setHelpDialogOpen(false), []);
    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const handleImageDialogClosed = useCallback(() => setImageDialogOpen(false), []);
    const handleCloseSettings = useCallback(
        (newSettings) => {
            settingsProvider.settings = newSettings;
            setSettingsDialogOpen(false);
            setDisableKeyEvents(false);
            extension.publishMessage({ command: 'subtitleSettings', value: settingsProvider.subtitleSettings });
            extension.publishMessage({ command: 'ankiSettings', value: settingsProvider.ankiSettings });
            extension.publishMessage({ command: 'miscSettings', value: settingsProvider.miscSettings });
        },
        [extension, settingsProvider]
    );

    const handleDeleteCopyHistoryItem = useCallback(
        (item) => {
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

    const handleError = useCallback((message) => {
        setAlertSeverity('error');
        setAlert(message);
        setAlertOpen(true);
    }, []);

    const handleUnloadAudio = useCallback(
        (audioFileUrl) => {
            if (audioFileUrl !== sources.audioFileUrl) {
                return;
            }

            setSources((previous) => {
                URL.revokeObjectURL(audioFileUrl);

                return {
                    subtitleFiles: previous.subtitleFiles,
                    audioFile: null,
                    audioFileUrl: null,
                    videoFile: previous.videoFile,
                    videoFileUrl: previous.videoFileUrl,
                };
            });
        },
        [sources]
    );

    const handleUnloadVideo = useCallback(
        (videoFileUrl) => {
            if (videoFileUrl !== sources.videoFileUrl) {
                return;
            }

            setSources((previous) => {
                URL.revokeObjectURL(videoFileUrl);

                return {
                    subtitleFiles: previous.subtitleFiles,
                    audioFile: previous.audioFile,
                    audioFileUrl: previous.audioFileUrl,
                    videoFile: null,
                    videoFileUrl: null,
                };
            });
        },
        [sources]
    );

    const handleClipAudio = useCallback(
        async (item) => {
            try {
                const clip = await audioClipFromItem(
                    item,
                    null,
                    settingsProvider.audioPaddingStart,
                    settingsProvider.audioPaddingEnd
                );

                if (settingsProvider.preferMp3) {
                    clip.toMp3().download();
                } else {
                    clip.download();
                }
            } catch (e) {
                console.error(e);
                handleError(e.message);
            }
        },
        [handleError, settingsProvider]
    );

    const handleDownloadImage = useCallback(
        async (item) => {
            try {
                await imageFromItem(item).download();
            } catch (e) {
                console.error(e);
                handleError(e.message);
            }
        },
        [handleError]
    );

    const handleSelectCopyHistoryItem = useCallback(
        (item) => {
            if (subtitleFiles.filter((f) => f.name === item.subtitleFile.name).length === 0) {
                handleError('Subtitle file ' + item.subtitleFile.name + ' is not open.');
                return;
            }

            setJumpToSubtitle({ text: item.text, originalStart: item.originalStart });
        },
        [subtitleFiles, handleError]
    );

    const handleAnki = useCallback((item) => {
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

    const handleAnkiDialogProceed = useCallback(
        async (text, definition, audioClip, image, word, source, url, customFieldValues, tags, mode) => {
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
                        setAlert('Export succeeded: ' + result);
                        setAlertOpen(true);
                    } else if (mode === 'updateLast') {
                        setAlertSeverity('success');
                        setAlert('Update succeeded: ' + result);
                        setAlertOpen(true);
                    }

                    setAnkiDialogOpen(false);

                    if (ankiDialogRequested) {
                        setAnkiDialogFinishedRequest({ timestamp: Date.now(), resume: true });
                        setAnkiDialogRequested(false);
                    }
                }
            } catch (e) {
                console.error(e);
                handleError(e.message);
            } finally {
                setAnkiDialogDisabled(false);
                setDisableKeyEvents(false);
            }
        },
        [anki, handleError, ankiDialogRequested]
    );

    const handleAnkiDialogRequest = useCallback((forwardToVideo) => {
        if (copiedSubtitlesRef.current.length === 0) {
            return;
        }

        const item = copiedSubtitlesRef.current[copiedSubtitlesRef.current.length - 1];
        setAnkiDialogItem(item);
        setAnkiDialogOpen(true);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(true);
        setAnkiDialogRequested(true);

        if (forwardToVideo) {
            setAnkiDialogRequestToVideo(Date.now());
        }
    }, []);

    const handleViewImage = useCallback((image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    useEffect(() => {
        function onTabs(tabs) {
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
                setTab(null);
                handleError('Lost connection with tab ' + tab.id + ' ' + tab.title);
            }
        }

        extension.subscribeTabs(onTabs);

        return () => extension.unsubscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError]);

    const handleTabSelected = useCallback((tab) => setTab(tab), []);

    const handleFiles = useCallback(
        (files) => {
            try {
                let { subtitleFiles, audioFile, videoFile } = extractSources(files);

                setSources((previous) => {
                    setLoading(true);

                    let videoFileUrl = null;
                    let audioFileUrl = null;

                    if (videoFile || audioFile) {
                        revokeUrls(previous);

                        if (videoFile) {
                            videoFileUrl = URL.createObjectURL(videoFile);
                        } else if (audioFile) {
                            audioFileUrl = URL.createObjectURL(audioFile);
                        }

                        setTab(null);
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
                handleError(e.message);
            }
        },
        [handleError]
    );

    useEffect(() => {
        async function onMessage(message) {
            if (message.data.command === 'sync' || message.data.command === 'syncv2') {
                const tabs = availableTabs.filter((t) => {
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
                let subtitleFiles;

                if (message.data.command === 'sync') {
                    subtitleFiles = [
                        new File(
                            [await (await fetch('data:text/plain;base64,' + message.data.subtitles.base64)).blob()],
                            message.data.subtitles.name
                        ),
                    ];
                } else if (message.data.command === 'syncv2') {
                    subtitleFiles = await Promise.all(
                        message.data.subtitles.map(
                            async (s) =>
                                new File([await (await fetch('data:text/plain;base64,' + s.base64)).blob()], s.name)
                        )
                    );
                }

                const subtitleFileName = subtitleFiles[0].name;
                setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                setSources({
                    subtitleFiles: subtitleFiles,
                    audioFile: null,
                    audioFileUrl: null,
                    videoFile: null,
                    videoFileUrl: null,
                });
                setTab(tab);
            }
        }

        extension.subscribe(onMessage);

        return () => extension.unsubscribe(onMessage);
    }, [extension, availableTabs]);

    const handleDrop = useCallback(
        (e) => {
            e.preventDefault();

            if (inVideoPlayer) {
                handleError('Video player cannot receive dropped files. Drop outside of the video frame instead.');
                return;
            }

            setDragging(false);
            dragEnterRef.current = null;

            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
                return;
            }

            handleFiles(e.dataTransfer.files);
        },
        [inVideoPlayer, handleError, handleFiles]
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleFiles(files);
        }
    }, [handleFiles]);

    const handleFileSelector = useCallback(() => fileInputRef.current?.click(), []);

    const handleDragEnter = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!inVideoPlayer) {
                dragEnterRef.current = e.target;
                setDragging(true);
            }
        },
        [inVideoPlayer]
    );

    const handleDragLeave = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!inVideoPlayer && dragEnterRef.current === e.target) {
                setDragging(false);
            }
        },
        [inVideoPlayer]
    );

    const handleSourcesLoaded = useCallback(() => setLoading(false), []);
    const nothingLoaded =
        (loading && !videoFrameRef.current) ||
        (sources.subtitleFiles.length === 0 && !sources.audioFile && !sources.videoFile);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
            >
                <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                    {alert}
                </Alert>
                <Switch>
                    <Route
                        exact
                        path="/"
                        render={() => {
                            const params = new URLSearchParams(window.location.search);
                            const videoFile = params.get('video');
                            const channel = params.get('channel');
                            const popOut = params.get('popout');

                            if (videoFile && channel) {
                                return (
                                    <Redirect
                                        to={
                                            '/video?video=' +
                                            encodeURIComponent(videoFile) +
                                            '&channel=' +
                                            channel +
                                            '&popout=' +
                                            popOut
                                        }
                                    />
                                );
                            }

                            return (
                                <div>
                                    <CopyHistory
                                        items={copiedSubtitles}
                                        open={copyHistoryOpen}
                                        drawerWidth={drawerWidth}
                                        onClose={handleCloseCopyHistory}
                                        onDelete={handleDeleteCopyHistoryItem}
                                        onClipAudio={handleClipAudio}
                                        onDownloadImage={handleDownloadImage}
                                        onSelect={handleSelectCopyHistoryItem}
                                        onAnki={handleAnki}
                                    />
                                    <AnkiDialog
                                        open={ankiDialogOpen}
                                        disabled={ankiDialogDisabled}
                                        text={ankiDialogItem?.text}
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
                                    />
                                    <ImageDialog
                                        open={imageDialogOpen}
                                        image={image}
                                        onClose={handleImageDialogClosed}
                                    />
                                    <SettingsDialog
                                        anki={anki}
                                        open={settingsDialogOpen}
                                        onClose={handleCloseSettings}
                                        settings={settingsProvider.settings}
                                    />
                                    <HelpDialog
                                        open={helpDialogOpen}
                                        extensionUrl={extensionUrl}
                                        onClose={handleCloseHelp}
                                    />
                                    <Bar
                                        title={fileName || 'asbplayer'}
                                        drawerWidth={drawerWidth}
                                        drawerOpen={copyHistoryOpen}
                                        onOpenCopyHistory={handleOpenCopyHistory}
                                        onOpenSettings={handleOpenSettings}
                                        onOpenHelp={handleOpenHelp}
                                        onFileSelector={handleFileSelector}
                                    />
                                    <input
                                        ref={fileInputRef}
                                        onChange={handleFileInputChange}
                                        type="file"
                                        accept=".srt,.ass,.vtt,.mp3,.m4a,.aac,.flac,.ogg,.wav,.opus,.mkv,.mp4,.avi"
                                        multiple
                                        hidden
                                    />
                                    <Content drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen}>
                                        {nothingLoaded && (
                                            <LandingPage
                                                latestExtensionVersion={latestExtensionVersion}
                                                extensionUrl={extensionUrl}
                                                extension={extension}
                                                loading={loading}
                                                dragging={dragging}
                                                onFileSelector={handleFileSelector}
                                            />
                                        )}
                                        <DragOverlay dragging={dragging} loading={loading} />
                                        <Player
                                            subtitleReader={subtitleReader}
                                            settingsProvider={settingsProvider}
                                            onCopy={handleCopy}
                                            onError={handleError}
                                            onUnloadAudio={handleUnloadAudio}
                                            onUnloadVideo={handleUnloadVideo}
                                            onLoaded={handleSourcesLoaded}
                                            onTabSelected={handleTabSelected}
                                            onAnkiDialogRequest={handleAnkiDialogRequest}
                                            tab={tab}
                                            availableTabs={availableTabs}
                                            sources={sources}
                                            jumpToSubtitle={jumpToSubtitle}
                                            videoFrameRef={videoFrameRef}
                                            extension={extension}
                                            drawerOpen={copyHistoryOpen}
                                            disableKeyEvents={disableKeyEvents}
                                            ankiDialogRequested={ankiDialogRequested}
                                            ankiDialogRequestToVideo={ankiDialogRequestToVideo}
                                            ankiDialogFinishedRequest={ankiDialogFinishedRequest}
                                        />
                                    </Content>
                                </div>
                            );
                        }}
                    />
                    <Route
                        exact
                        path="/video"
                        render={() => {
                            const params = new URLSearchParams(window.location.search);
                            const videoFile = params.get('video');
                            const channel = params.get('channel');
                            const popOut = params.get('popout') === 'true';

                            return (
                                <VideoPlayer
                                    settingsProvider={settingsProvider}
                                    videoFile={videoFile}
                                    popOut={popOut}
                                    channel={channel}
                                    onError={handleError}
                                />
                            );
                        }}
                    />
                </Switch>
            </div>
        </ThemeProvider>
    );
}

export default App;
