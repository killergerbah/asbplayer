import React, { useCallback, useState, useMemo, useRef } from 'react';
import { Route, Redirect, Switch, useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/useWindowSize';
import clsx from 'clsx';
import Alert from './Alert.js';
import Anki from '../services/Anki.js';
import AnkiDialog from './AnkiDialog.js'
import SubtitleReader from '../services/SubtitleReader.js';
import MediaClipper from '../services/MediaClipper.js';
import Bar from './Bar.js';
import ChromeExtension from '../services/ChromeExtension.js';
import CopyHistory from './CopyHistory.js';
import LandingPage from './LandingPage.js';
import Player from './Player.js';
import SettingsDialog from './SettingsDialog.js';
import SettingsProvider from '../services/SettingsProvider.js';
import VideoPlayer from './VideoPlayer.js';

const useStyles = drawerWidth => makeStyles((theme) => ({
    content: {
        flexGrow: 1,
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        marginRight: 0,
    },
    contentShift: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: drawerWidth,
    },
}));


function extractSources(files) {
    let subtitleFile = null;
    let audioFile = null;
    let videoFile = null;

    for(const f of files) {
        const extensionStartIndex = f.name.lastIndexOf(".");

        if (extensionStartIndex === -1) {
            throw new Error('Unable to determine extension of ' + f.name);
        }

        const extension = f.name.substring(extensionStartIndex + 1, f.name.length);
        switch (extension) {
            case "ass":
            case "srt":
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


function Content(props) {
    const classes = useStyles(props.drawerWidth)();
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
    const mediaClipper = useMemo(() => new MediaClipper(), []);
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
    const [fileName, setFileName] = useState();
    const [ankiDialogOpen, setAnkiDialogOpen] = useState(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState(false);
    const [ankiDialogItem, setAnkiDialogItem] = useState();
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const offsetRef = useRef();
    const { subtitleFile } = sources;

    const handleCopy = useCallback((subtitle, audioFile, videoFile, subtitleFile, audioTrack, audio) => {
        setCopiedSubtitles(copiedSubtitles => [...copiedSubtitles, {
            ...subtitle,
            timestamp: Date.now(),
            name: fileName,
            subtitleFile: subtitleFile,
            audioFile: audioFile,
            videoFile: videoFile,
            audioTrack: audioTrack,
            audio: audio
        }]);
        setAlertSeverity("success");
        setAlert("Copied " + subtitle.text);
        setAlertOpen(true);
    }, [fileName]);

    const handleOpenCopyHistory = useCallback(() => setCopyHistoryOpen(copyHistoryOpen => !copyHistoryOpen), []);
    const handleCloseCopyHistory = useCallback(() => setCopyHistoryOpen(false), []);
    const handleOpenSettings = useCallback(() => setSettingsDialogOpen(true), []);
    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const handleCloseSettings = useCallback((newSettings) => {
        settingsProvider.ankiConnectUrl = newSettings.ankiConnectUrl;
        settingsProvider.deck = newSettings.deck;
        settingsProvider.noteType = newSettings.noteType;
        settingsProvider.modelNames = newSettings.modelNames;
        settingsProvider.sentenceField = newSettings.sentenceField;
        settingsProvider.definitionField = newSettings.definitionField;
        settingsProvider.audioField = newSettings.audioField;
        setSettingsDialogOpen(false);
    }, [settingsProvider]);

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
            if (item.audio) {
                await mediaClipper.saveAudio(item.audio.base64, item.audio.extension);
            } else {
                const offset = offsetRef.current || 0;
                await mediaClipper.clipAndSaveAudio(
                    item.audioFile || item.videoFile,
                    item.originalStart + offset,
                    item.originalEnd + offset
                );
            }
        } catch(e) {
            console.error(e);
            handleError(e.message);
        }
    }, [mediaClipper, handleError]);

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
    }, []);

    const handleAnkiDialogCancel = useCallback(() => {
        setAnkiDialogOpen(false);
        setAnkiDialogItem(null);
        setAnkiDialogDisabled(false);
    }, []);

    const handleAnkiDialogProceed = useCallback(async (text, definition) => {
        setAnkiDialogDisabled(true);
        const item = ankiDialogItem;
        const offset = offsetRef.current || 0;

        try {
            let blob = null;
            let extension = null;
            const mediaFile = item.audioFile || item.videoFile;

            if (mediaFile) {
                [blob, extension] = await mediaClipper.clipAudio(
                    mediaFile,
                    item.originalStart + offset,
                    item.originalEnd + offset
                );
            }

            await anki.export(settingsProvider.ankiConnectUrl, text, definition, {
                audioBlob: blob,
                audioFileName: mediaFile?.name || item.subtitleFile.name,
                audioFileExtension: extension || item.audio?.extension,
                audioBase64: item.audio?.base64
            });
        } catch (e) {
            console.error(e);
            handleError(e.message);
        } finally {
            setAnkiDialogOpen(false);
            setAnkiDialogItem(null);
            setAnkiDialogDisabled(false);
        }
    }, [anki, settingsProvider, mediaClipper, handleError, ankiDialogItem]);

    function revokeUrls(sources) {
        if (sources.audioFileUrl) {
            URL.revokeObjectURL(sources.audioFileUrl);
        }

        if (sources.videoFileUrl) {
            URL.revokeObjectURL(sources.videoFileUrl);
        }
    }

    const handleDrop = useCallback((e) => {
        e.preventDefault();

        if (inVideoPlayer) {
            handleError('Video player cannot receive dropped files. Drop into the subtitle section instead.')
            return;
        }

        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
            return;
        }

        try {
            let {subtitleFile, audioFile, videoFile} = extractSources(e.dataTransfer.files);

            setSources(previous => {
                if (!previous.subtitleFile) {
                    setLoading(true);
                }

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
    }, [inVideoPlayer, handleError]);

    const handleSourcesLoaded = useCallback(() => setLoading(false), []);

    const nothingLoaded = (loading && !videoFrameRef.current) || (!sources.subtitleFile && !sources.audioFile && !sources.videoFile);

    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
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
                                onSelect={handleSelectCopyHistoryItem}
                                onAnki={handleAnki}
                            />
                            <AnkiDialog
                                open={ankiDialogOpen}
                                disabled={ankiDialogDisabled}
                                text={ankiDialogItem?.text}
                                onCancel={handleAnkiDialogCancel}
                                onProceed={handleAnkiDialogProceed}
                            />
                            <SettingsDialog
                                anki={anki}
                                open={settingsDialogOpen}
                                onClose={handleCloseSettings}
                                settings={settingsProvider.settings}
                            />
                            <Bar
                                title={fileName || "asbplayer"}
                                drawerWidth={drawerWidth}
                                drawerOpen={copyHistoryOpen}
                                onOpenCopyHistory={handleOpenCopyHistory}
                                onOpenSettings={handleOpenSettings}
                            />
                            <Content drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen}>
                                {nothingLoaded && (
                                    <LandingPage loading={loading} />
                                )}
                                <Player
                                    subtitleReader={subtitleReader}
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