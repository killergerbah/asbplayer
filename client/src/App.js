import React, { useCallback, useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Route, Redirect, Switch, useHistory, useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Alert from './Alert.js';
import Api from './Api.js';
import Bar from './Bar.js';
import CopyHistory from './CopyHistory.js';
import Browser from './Browser.js';
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

function openMedia(audioFile, videoFile, subtitleFile, fileName, history) {
    var parameters = [];

    if (audioFile) {
        parameters.push('audio=' + encodeURIComponent(audioFile));
    }

    if (videoFile) {
        parameters.push('video=' + encodeURIComponent(videoFile));
    }

    if (subtitleFile) {
        parameters.push('subtitle=' + encodeURIComponent(subtitleFile));
    }

    parameters.push('name=' + encodeURIComponent(fileName));

    history.push('/view?' + parameters.join('&'));
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
    const history = useHistory();
    const location = useLocation();
    const [width, ] = useWindowSize(location.pathname === '/video');
    const drawerWidth = Math.max(300, width * 0.3);
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [error, setError] = useState(null);
    const [errorAlertOpen, setErrorAlertOpen] = useState(false);
    const [jumpToSubtitle, setJumpToSubtitle] = useState(null);
    const [subtitleFile, setSubtitleFile] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSubtitleFile(params.get('subtitle'));
    }, [location]);

    const handleOpenMedia = useCallback((media) => {
        setJumpToSubtitle(null);
        openMedia(media.audioFile?.path, media.videoFile?.path, media.subtitleFile?.path, media.name, history);
    }, [history, setJumpToSubtitle]);

    const handleOpenPath = useCallback((path) => {
        history.push('/browse/' + path);
    }, [history]);

    const handleCopy = useCallback((text, start, end, fileName, audioFile, videoFile, subtitleFile, audioTrack) => {
        let newCopiedSubtitles = copiedSubtitles.slice();
        newCopiedSubtitles.push({
            timestamp: Date.now(),
            text: text,
            start: start,
            end: end,
            name: fileName,
            subtitleFile: subtitleFile,
            audioFile: audioFile,
            videoFile: videoFile,
            audioTrack: audioTrack
        });
        setCopiedSubtitles(newCopiedSubtitles);
    }, [setCopiedSubtitles, copiedSubtitles]);

    const handleOpenCopyHistory = useCallback((event) => {
        setCopyHistoryOpen(!copyHistoryOpen);
    }, [setCopyHistoryOpen, copyHistoryOpen]);

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
    }, [copiedSubtitles, setCopiedSubtitles]);

    const handleClipAudio = useCallback(item => {
        api.clipAudio(item.name, item.audioFile || item.videoFile, item.start, item.end, item.audioTrack)
            .catch(e => {
                setError(e.message);
                setErrorAlertOpen(true);
            });
    }, [api]);

    const handleSelectCopyHistoryItem = useCallback((item) => {
        if (subtitleFile !== item.subtitleFile) {
            openMedia(item.audioFile, item.videoFile, item.subtitleFile, item.name, history);
        }

        setJumpToSubtitle({text: item.text, start: item.start});
    }, [setJumpToSubtitle, history, subtitleFile]);

    const handleErrorAlertClosed = useCallback(() => {
        setErrorAlertOpen(false);
    }, [setErrorAlertOpen]);

    const handleError = useCallback((message) => {
        setError(message);
        setErrorAlertOpen(true);
    }, [setError, setErrorAlertOpen]);

    return (
        <div>
            <Alert open={errorAlertOpen} onClose={handleErrorAlertClosed} autoHideDuration={3000} severity="error">
                {error}
            </Alert>
            <CopyHistory
                items={copiedSubtitles}
                open={copyHistoryOpen}
                drawerWidth={drawerWidth}
                onClose={handleCloseCopyHistory}
                onDelete={handleDeleteCopyHistoryItem}
                onClipAudio={handleClipAudio}
                onSelect={handleSelectCopyHistoryItem} />
            <Switch>
                <Route exact path="/" render={() => {
                    const params = new URLSearchParams(window.location.search);
                    const videoFile = params.get('video');
                    const channel = params.get('channel');

                    if (videoFile && channel) {
                        return (<Redirect to={"/video?video=" + encodeURIComponent(videoFile) + "&channel=" + channel} />);
                    }

                    return (<Redirect to="/browse" />)
                }} />
                <Route exact path="/browse">
                    <Bar drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen} onOpenCopyHistory={handleOpenCopyHistory} />
                    <Content drawerOpen={copyHistoryOpen}>
                        <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
                    </Content>
                </Route>
                <Route exact path="/browse/:path+">
                    <Bar drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen} onOpenCopyHistory={handleOpenCopyHistory} />
                    <Content drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen}>
                        <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
                    </Content>
                </Route>
                <Route exact path="/video">
                    <VideoPlayer api={api} onError={handleError} />
                </Route>
                <Route exact path="/view">
                    <Bar drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen} onOpenCopyHistory={handleOpenCopyHistory} />
                    <Content drawerWidth={drawerWidth} drawerOpen={copyHistoryOpen}>
                        <Player api={api} onCopy={handleCopy} jumpToSubtitle={jumpToSubtitle} />
                    </Content>
                </Route>
            </Switch>
        </div>
    );
}

export default App;
