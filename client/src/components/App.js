import React, { useCallback, useState, useMemo, useRef } from 'react';
import { Route, Redirect, Switch, useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/useWindowSize';
import clsx from 'clsx';
import Alert from './Alert.js';
import Anki from '../services/Anki.js';
import AnkiDialog from './AnkiDialog.js';
import AudioClip from '../services/AudioClip';
import DragOverlay from './DragOverlay.js';
import HelpDialog from './HelpDialog.js';
import ImageDialog from './ImageDialog.js';
import SubtitleReader from '../services/SubtitleReader.js';
import Bar from './Bar.js';
import ChromeExtension from '../services/ChromeExtension.js';
import CopyHistory from './CopyHistory.js';
import Image from '../services/Image';
import LandingPage from './LandingPage.js';
import Player from './Player.js';
import SettingsDialog from './SettingsDialog.js';
import SettingsProvider from '../services/SettingsProvider.js';
import VideoPlayer from './VideoPlayer.js';

const latestExtensionVersion = "0.7.0";
const extensionUrl = "https://github.com/killergerbah/asbplayer/releases/latest";

const useContentStyles = makeStyles((theme) => ({
    content: {
        flexGrow: 1,
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        marginRight: 0
    },
    contentShift: ({drawerWidth}) => ({
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: drawerWidth
    }),
}));

function extractSources(files) {
    let subtitleFile = null;
    let audioFile = null;
    let videoFile = null;

    for (const f of files) {
        const extensionStartIndex = f.name.lastIndexOf(".");

        if (extensionStartIndex === -1) {
            throw new Error('Unable to determine extension of ' + f.name);
        }

        const extension = f.name.substring(extensionStartIndex + 1, f.name.length);
        switch (extension) {
            case "ass":
            case "srt":
            case "vtt":
                if (subtitleFile) {
                    throw new Error('Cannot open two subtitle files simultaneously');
                }
                subtitleFile = f;
                break;
            case "mkv":
                if (videoFile) {
                    throw new Error('Cannot open two video files simultaneously');
                }
                videoFile = f;
                break;
            case "mp3":
            case "m4a":
                if (audioFile) {
                    throw new Error('Cannot open two audio files simultaneously');
                }
                audioFile = f;
                break;
            default:
                throw new Error("Unsupported extension " + extension);
        }
    }

    if (videoFile && audioFile) {
        throw new Error("Cannot load both an audio and video file simultaneously");
    }

    return {subtitleFile: subtitleFile, audioFile: audioFile, videoFile: videoFile}
}

function audioClipFromItem(item, offset) {
    if (item.audio) {
        return AudioClip.fromBase64(
            item.subtitleFile,
            item.start,
            item.end,
            item.audio.base64,
            item.audio.extension
        );
    }

    if (item.audioFile || item.videoFile) {
        return AudioClip.fromFile(
            item.audioFile || item.videoFile,
            item.originalStart + offset,
            item.originalEnd + offset,
            item.audioTrack
        );
    }

    return null;
}

function imageFromItem(item, offset) {
    if (item.image) {
        return Image.fromBase64(
            item.subtitleFile,
            item.start,
            item.image.base64,
            item.image.extension
        );
    }

    if (item.videoFile) {
        return Image.fromFile(
            item.videoFile,
            item.originalStart + offset
        );
    }

    return null;
}

function Content(props) {
    const classes = useContentStyles(props);

    return (
        <main
            className={clsx(classes.content, {
                [classes.contentShift]: props.drawerOpen,
            })}>
        {props.children}
        </main>
    );
}

function App() {
    const subtitleReader = useMemo(() => new SubtitleReader(), []);
    const settingsProvider = useMemo(() => new SettingsProvider(), []);
    const anki = useMemo(() => new Anki(settingsProvider), [settingsProvider]);
    const extension = useMemo(() => new ChromeExtension(), []);
    const location = useLocation();
    const videoFrameRef = useRef();
    const inVideoPlayer = location.pathname === '/video';
    const [width, ] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? .2 : .3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [alert, setAlert] = useState();
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertSeverity, setAlertSeverity] = useState();
    const [jumpToSubtitle, setJumpToSubtitle] = useState();
    const [sources, setSources] = useState({});
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragEnterRef = useRef();
    const [fileName, setFileName] = useState();
    const [ankiDialogOpen, setAnkiDialogOpen] = useState(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState(false);
    const [ankiDialogItem, setAnkiDialogItem] = useState();
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [helpDialogOpen, setHelpDialogOpen] = useState(false);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [disableKeyEvents, setDisableKeyEvents] = useState(false);
    const [image, setImage] = useState();
    const offsetRef = useRef();
    const fileInputRef = useRef();
    const { subtitleFile } = sources;

    const handleCopy = useCallback((subtitle, audioFile, videoFile, subtitleFile, audioTrack, audio, image) => {
        setCopiedSubtitles(copiedSubtitles => [...copiedSubtitles, {
            ...subtitle,
            timestamp: Date.now(),
            name: fileName,
            subtitleFile: subtitleFile,
            audioFile: audioFile,
            videoFile: videoFile,
            audioTrack: audioTrack,
            audio: audio,
            image: image
        }]);
        setAlertSeverity("success");
        setAlert("Copied " + subtitle.text);
        setAlertOpen(true);
    }, [fileName]);

    const handleOpenCopyHistory = useCallback(() => setCopyHistoryOpen(copyHistoryOpen => !copyHistoryOpen), []);
    const handleCloseCopyHistory = useCallback(() => setCopyHistoryOpen(false), []);
    const handleOpenSettings = useCallback(() => setSettingsDialogOpen(true), []);
    const handleOpenHelp = useCallback(() => setHelpDialogOpen(true), []);
    const handleCloseHelp = useCallback(() => setHelpDialogOpen(false), []);
    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const handleImageDialogClosed = useCallback(() => setImageDialogOpen(false), []);
    const handleCloseSettings = useCallback((newSettings) => {
        settingsProvider.ankiConnectUrl = newSettings.ankiConnectUrl;
        settingsProvider.deck = newSettings.deck;
        settingsProvider.noteType = newSettings.noteType;
        settingsProvider.modelNames = newSettings.modelNames;
        settingsProvider.sentenceField = newSettings.sentenceField;
        settingsProvider.definitionField = newSettings.definitionField;
        settingsProvider.audioField = newSettings.audioField;
        settingsProvider.imageField = newSettings.imageField;
        settingsProvider.wordField = newSettings.wordField;
        settingsProvider.sourceField = newSettings.sourceField;
        settingsProvider.subtitleSize = newSettings.subtitleSize;
        settingsProvider.subtitleColor = newSettings.subtitleColor;
        settingsProvider.subtitleOutlineThickness = newSettings.subtitleOutlineThickness;
        settingsProvider.subtitleOutlineColor = newSettings.subtitleOutlineColor;
        settingsProvider.subtitleBackgroundColor = newSettings.subtitleBackgroundColor;
        settingsProvider.subtitleBackgroundOpacity = newSettings.subtitleBackgroundOpacity;
        settingsProvider.customAnkiFields = newSettings.customAnkiFields;
        settingsProvider.preferMp3 = newSettings.preferMp3;
        setSettingsDialogOpen(false);
        extension.publishMessage({command: 'subtitleSettings', value: settingsProvider.subtitleSettings})
    }, [extension, settingsProvider]);

    const handleDeleteCopyHistoryItem = useCallback(item => {
        const newCopiedSubtitles = [];

        for (let subtitle of copiedSubtitles) {
            if (item.timestamp !== subtitle.timestamp) {
                newCopiedSubtitles.push(subtitle);
            }
        }

        setCopiedSubtitles(newCopiedSubtitles);
    }, [copiedSubtitles]);

    const handleError = useCallback((message) => {
        setAlertSeverity("error");
        setAlert(message);
        setAlertOpen(true);
    }, []);

    const handleUnloadAudio = useCallback((audioFileUrl) => {
        if (audioFileUrl !== sources.audioFileUrl) {
            return;
        }

        setSources(previous => {
            URL.revokeObjectURL(audioFileUrl);

            return {
                subtitleFile: previous.subtitleFile,
                audioFile: null,
                audioFileUrl: null,
                videoFile: previous.videoFile,
                videoFileUrl: previous.videoFileUrl
            };
        });
    }, [sources]);

    const handleUnloadVideo = useCallback((videoFileUrl) => {
        if (videoFileUrl !== sources.videoFileUrl) {
            return;
        }

        setSources(previous => {
            URL.revokeObjectURL(videoFileUrl);

            return {
                subtitleFile: previous.subtitleFile,
                audioFile: previous.audioFile,
                audioFileUrl: previous.audioFileUrl,
                videoFile: null,
                videoFileUrl: null
            };
        });
    }, [sources]);

    const handleClipAudio = useCallback(async (item) => {
        try {
            const clip = await audioClipFromItem(item, offsetRef.current || 0);

            if (settingsProvider.preferMp3) {
                clip.toMp3().download();
            } else {
                clip.download();
            }
        } catch(e) {
            console.error(e);
            handleError(e.message);
        }
    }, [handleError, settingsProvider]);

    const handleDownloadImage = useCallback(async (item) => {
        try {
            await imageFromItem(item, offsetRef.current || 0).download();
        } catch(e) {
            console.error(e);
            handleError(e.message);
        }
    }, [handleError]);

    const handleSelectCopyHistoryItem = useCallback((item) => {
        if (subtitleFile.name !== item.subtitleFile.name) {
            handleError("Subtitle file " + item.subtitleFile.name + " is not open.");
            return;
        }

        setJumpToSubtitle({text: item.text, originalStart: item.originalStart});
    }, [subtitleFile, handleError]);

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
    }, []);

    const handleAnkiDialogProceed = useCallback(async (text, definition, audioClip, image, word, source, customFieldValues, gui) => {
        setAnkiDialogDisabled(true);

        try {
            const result = await anki.export(
                text,
                definition,
                audioClip,
                image,
                word,
                source,
                customFieldValues,
                gui
            );

            if (!gui) {
                setAlertSeverity("success");
                setAlert("Export succeeded: " + result);
                setAlertOpen(true);
            }

            setAnkiDialogOpen(false);
        } catch (e) {
            console.error(e);
            handleError(e.message);
        } finally {
            setAnkiDialogDisabled(false);
            setDisableKeyEvents(false);
        }
    }, [anki, handleError]);

    const handleViewImage = useCallback((image) => {
        setImage(image);
        setImageDialogOpen(true);
    }, []);

    function revokeUrls(sources) {
        if (sources.audioFileUrl) {
            URL.revokeObjectURL(sources.audioFileUrl);
        }

        if (sources.videoFileUrl) {
            URL.revokeObjectURL(sources.videoFileUrl);
        }
    }

    const handleFiles = useCallback((files) => {
        try {
            let {subtitleFile, audioFile, videoFile} = extractSources(files);

            setSources(previous => {
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
                } else {
                    videoFile = previous.videoFile;
                    videoFileUrl = previous.videoFileUrl;
                    audioFile = previous.audioFile;
                    audioFileUrl = previous.audioFileUrl;
                }

                const sources = {
                    subtitleFile: subtitleFile || previous.subtitleFile,
                    audioFile: audioFile,
                    audioFileUrl: audioFileUrl,
                    videoFile: videoFile,
                    videoFileUrl: videoFileUrl
                };

                return sources;
            });

            if (subtitleFile) {
                setFileName(subtitleFile.name);
            }
        } catch (e) {
            console.error(e);
            handleError(e.message);
        }
    }, [handleError]);

    const handleDrop = useCallback((e) => {
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
    }, [inVideoPlayer, handleError, handleFiles]);

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleFiles(files);
        }
    }, [handleFiles]);

    const handleFileSelector = useCallback(() => fileInputRef.current?.click(), []);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!inVideoPlayer) {
            dragEnterRef.current = e.target;
            setDragging(true);
        }

    }, [inVideoPlayer]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!inVideoPlayer && dragEnterRef.current === e.target) {
            setDragging(false);
        }
    }, [inVideoPlayer]);

    const handleSourcesLoaded = useCallback(() => setLoading(false), []);
    const nothingLoaded = (loading && !videoFrameRef.current) || (!sources.subtitleFile && !sources.audioFile && !sources.videoFile);

    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <Alert
                open={alertOpen}
                onClose={handleAlertClosed}
                autoHideDuration={3000}
                severity={alertSeverity}
            >
                {alert}
            </Alert>
            <Switch>
                <Route exact path="/" render={() => {
                    const params = new URLSearchParams(window.location.search);
                    const videoFile = params.get('video');
                    const channel = params.get('channel');
                    const popOut = params.get('popout');

                    if (videoFile && channel) {
                        return (<Redirect to={"/video?video=" + encodeURIComponent(videoFile) + "&channel=" + channel + "&popout=" + popOut} />);
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
                                audioClip={ankiDialogItem && audioClipFromItem(ankiDialogItem, offsetRef.current || 0)}
                                image={ankiDialogItem && imageFromItem(ankiDialogItem, offsetRef.current || 0)}
                                source={ankiDialogItem?.subtitleFile?.name}
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
                                title={fileName || "asbplayer"}
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
                                accept=".srt,.ass,.vtt,.mp3,.m4a,.mkv"
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
                                    offsetRef={offsetRef}
                                    sources={sources}
                                    jumpToSubtitle={jumpToSubtitle}
                                    videoFrameRef={videoFrameRef}
                                    extension={extension}
                                    drawerOpen={copyHistoryOpen}
                                    disableKeyEvents={disableKeyEvents}
                                />
                            </Content>
                        </div>
                    );
                }} />
                <Route exact path="/video" render={() => {
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
                }} />
            </Switch>
        </div>
    );
}

export default App;
