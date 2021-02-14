import React, { useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { Route, Redirect, Switch, useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Alert from './Alert.js';
import Api from './Api.js';
import Bar from './Bar.js';
import ChromeExtension from './ChromeExtension.js';
import CopyHistory from './CopyHistory.js';
import Player from './Player.js';
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

// https://stackoverflow.com/questions/19014250/rerender-view-on-browser-resize-with-react
function useWindowSize(off) {
    const [size, setSize] = useState([0, 0]);
    useLayoutEffect(() => {
        function updateSize() {
            if (off) {
                return;
            }

            setSize([window.innerWidth, window.innerHeight]);
        }
        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, [off]);
    return size;
}

function App() {
    const api = useMemo(() => new Api(), []);
    const extension = useMemo(() => new ChromeExtension(), []);
    const location = useLocation();
    const [width, ] = useWindowSize(location.pathname === '/video');
    const drawerWidth = Math.max(400, width * 0.3);
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [error, setError] = useState();
    const [errorAlertOpen, setErrorAlertOpen] = useState(false);
    const [jumpToSubtitle, setJumpToSubtitle] = useState();
    const [sources, setSources] = useState({});
    const [fileName, setFileName] = useState();
    const { subtitleFile } = sources;

    const handleCopy = useCallback((text, start, end, audioFile, videoFile, subtitleFile, audioTrack) => {
        setCopiedSubtitles(copiedSubtitles => [...copiedSubtitles, {
            timestamp: Date.now(),
            text: text,
            start: start,
            end: end,
            name: fileName,
            subtitleFile: subtitleFile,
            audioFile: audioFile,
            videoFile: videoFile,
            audioTrack: audioTrack
        }]);
    }, [fileName]);

    const handleOpenCopyHistory = useCallback((event) => {
        setCopyHistoryOpen(!copyHistoryOpen);
    }, [copyHistoryOpen]);

    const handleCloseCopyHistory = useCallback(() => {
        setCopyHistoryOpen(false);
    }, [setCopyHistoryOpen]);

    const handleDeleteCopyHistoryItem = useCallback(item => {
        const newCopiedSubtitles = [];

        for (let subtitle of copiedSubtitles) {
            if (item.timestamp !== subtitle.timestamp) {
                newCopiedSubtitles.push(subtitle);
            }
        }

        setCopiedSubtitles(newCopiedSubtitles);
    }, [copiedSubtitles]);

    const handleErrorAlertClosed = useCallback(() => {
        setErrorAlertOpen(false);
    }, []);

    const handleError = useCallback((message) => {
        setError(message);
        setErrorAlertOpen(true);
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
                videoFile: previous.videoFile
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
                videoFile: null
            };
        });
    }, [sources]);

    const handleClipAudio = useCallback(item => {
        if (item.audioFile) {
            api.clipAudioFromAudioFile(item.audioFile, item.start, item.end)
                .catch(e => {
                    handleError(e.message);
                });
        } else if (item.videoFile) {
            api.clipAudioFromVideoFile(item.videoFile, item.start, item.end, item.audioTrack)
                .catch(e => {
                    handleError(e.message);
                });
        }
    }, [api, handleError]);

    const handleSelectCopyHistoryItem = useCallback((item) => {
        if (subtitleFile !== item.subtitleFile) {
            handleError("Subtitle file " + item.subtitleFile.name + " is not open.");
            return;
        }

        setJumpToSubtitle({text: item.text, start: item.start});
    }, [subtitleFile, handleError]);

    function revokeUrls(sources) {
        if (sources.audioFileUrl) {
            URL.revokeObjectURL(sources.audioFileUrl);
        }

        if (sources.videoFileUrl) {
            URL.revokeObjectURL(sources.videoFileUrl);
        }
    }

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

    const handleDrop = useCallback((e) => {
        e.preventDefault();

        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
            return;
        }

        try {
            let {subtitleFile, audioFile, videoFile} = extractSources(e.dataTransfer.files);

            setSources(previous => {
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
                    audioFile = previous.audioFile;
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
            handleError(e.message);
        }
    }, [handleError]);

    return (
        <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
        >
            <Alert
                open={errorAlertOpen}
                onClose={handleErrorAlertClosed}
                autoHideDuration={3000}
                severity="error"
            >
                {error}
            </Alert>
            <Switch>
                <Route exact path="/" render={() => {
                    const params = new URLSearchParams(window.location.search);
                    const videoFile = params.get('video');
                    const channel = params.get('channel');

                    if (videoFile && channel) {
                        return (<Redirect to={"/video?video=" + encodeURIComponent(videoFile) + "&channel=" + channel} />);
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
                            />
                            <Bar
                                title={fileName || "a subtitle player"}
                                drawerWidth={drawerWidth}
                                drawerOpen={copyHistoryOpen}
                                onOpenCopyHistory={handleOpenCopyHistory}
                            />
                            <Content drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen}>
                                <Player
                                    api={api}
                                    onCopy={handleCopy}
                                    onError={handleError}
                                    onUnloadAudio={handleUnloadAudio}
                                    onUnloadVideo={handleUnloadVideo}
                                    sources={sources}
                                    jumpToSubtitle={jumpToSubtitle}
                                    extension={extension}
                                />
                            </Content>
                        </div>
                    );
                }} />
                <Route exact path="/video">
                    <VideoPlayer api={api} onError={handleError} />
                </Route>
            </Switch>
        </div>
    );
}

export default App;