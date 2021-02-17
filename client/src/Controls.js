import { useCallback, useEffect, useState, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import VideocamIcon from '@material-ui/icons/Videocam';

const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '50%',
        bottom: 0
    },
    buttonContainer: {
        flexDirection: 'row'
    },
    timeDisplay: {
        color: theme.palette.action.active,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: '100%',
        cursor: 'default',
        fontSize: 20
    },
    offsetInput: {
        height: '100%',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontSize: 20,
        marginLeft: 10,
        width: 100,
        color: theme.palette.text.secondary
    },
    paper: {
        background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0, 0, 0, 0.5))",
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
        padding: 10
    },
    button: {
        color: theme.palette.action.active
    },
    inactiveButton: {
        color: theme.palette.action.disabled
    },
    progress: {
        margin: 5
    },
    bar1Determinate: {
        transition: 'none',
        background: 'linear-gradient(to left, #e21e4a, #a92fff)',
    }
}));

const useProgressBarStyles = makeStyles((theme) => ({
    container: {
        width: '100%',
        background: 'rgba(30,30,30,0.7)',
        height: 5,
        marginBottom: 5,
        cursor: 'pointer'
    },
    fillContainer: {
        width: '100%'
    },
    fill: {
        background: 'linear-gradient(to left, #e21e4a, #a92fff)',
        height: '100%'
    },
    handleContainer: {
        position: 'relative',
        width: 0,
        height: 0
    },
    handle: {
        borderRadius: '50%',
        width: 15,
        height: 15,
        background: 'white',
        position: 'absolute',
        top: 5,
        left: 2,
        filter: 'drop-shadow(3px 3px 3px rgba(0,0,0,0.3))'
    }
}));

function displayTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsInMinute = seconds % 60;
    return String(minutes) + ':' + String(secondsInMinute).padStart(2, '0');
}

function elementWidth(element) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
}

function ProgressBar(props) {
    const classes = useProgressBarStyles();
    const containerRef = useRef(null);

    function handleClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.right - rect.left;
        const progress = (e.pageX - rect.left) / width;

        props.onSeek(progress);
    };

    const fillStyle = {width: props.value + '%'};
    const handleStyle = {marginLeft: containerRef.current ? elementWidth(containerRef.current) * props.value / 100 : 0};

    return (
        <div ref={containerRef} onClick={handleClick} className={classes.container}>
            <div className={classes.fill} style={fillStyle}></div>
            <div className={classes.handleAnchor}>
                <div className={classes.handle} style={handleStyle}></div>
            </div>
        </div>
    );
}

function AudioTrackSelector(props) {
    if (!props.audioTracks || props.audioTracks.length === 0) {
        return null;
    }

    const list = props.audioTracks.map((t) => {
        return (
            <ListItem
                key={t.id}
                selected={t.id === props.selectedAudioTrack}
                button onClick={() => props.onAudioTrackSelected(t.id)}>
                {t.language} {t.label}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>{list}</List>
            </Popover>
        </div>
    );
}

function TabSelector(props) {
    if (!props.tabs || props.tabs.length === 0) {
        return null;
    }

    const list = props.tabs.map((t) => {
        return (
            <ListItem
                key={t.id}
                selected={t.id === props.selectedTab}
                button onClick={() => props.onTabSelected(t.id)}>
                {t.id} {t.title} {t.src}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>{list}</List>
            </Popover>
        </div>
    );
}

function MediaUnloader(props) {
    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>
                    <ListItem button onClick={(e) => props.onUnload()}>
                        Unload {props.file}
                    </ListItem>
                </List>
            </Popover>
        </div>
    );
}

export default function Controls(props) {
    const classes = useControlStyles();
    const {playing, length, displayLength, offsetValue, onAudioTrackSelected, onSeek, mousePositionRef, onPause, onPlay, onTabSelected, onUnloadAudio, onUnloadVideo, onOffsetChange} = props;
    const [show, setShow] = useState(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState();
    const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState();
    const [audioUnloaderOpen, setAudioUnloaderOpen] = useState(false);
    const [audioUnloaderAnchorEl, setAudioUnloaderAnchorEl] = useState();
    const [videoUnloaderOpen, setVideoUnloaderOpen] = useState(false);
    const [videoUnloaderAnchorEl, setVideoUnloaderAnchorEl] = useState();
    const lastMousePositionRef = useRef({x: 0, y: 0});
    const lastShowTimestampRef = useRef(Date.now());
    const lastShowRef = useRef(true);
    const forceShowRef = useRef(false);
    const offsetInputRef = useRef();
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    const handleSeek = useCallback((progress) => {
        onSeek(progress);
    }, [onSeek]);

    function handleMouseOver(e) {
        forceShowRef.current = true;
    };

    function handleMouseOut(e) {
        forceShowRef.current = false;
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const currentShow = Date.now() - lastShowTimestampRef.current < 2000
                || Math.pow(mousePositionRef.current.x - lastMousePositionRef.current.x, 2)
                    + Math.pow(mousePositionRef.current.y - lastMousePositionRef.current.y, 2) > 100
                || forceShowRef.current
                || offsetInputRef.current === document.activeElement

            if (currentShow && !lastShowRef.current) {
                lastShowTimestampRef.current = Date.now();
                setShow(currentShow);
            } else if (!currentShow && lastShowRef.current) {
                setShow(currentShow);
            }

            lastShowRef.current = currentShow;
            lastMousePositionRef.current.x = mousePositionRef.current.x;
            lastMousePositionRef.current.y = mousePositionRef.current.y;
        }, 100);
        return () => clearInterval(interval);
    }, [mousePositionRef, setShow, show]);

    useEffect(() => {
        function handleKey(event) {
            if (event.keyCode === 32) {
                event.preventDefault();

                if (playing) {
                    onPause();
                } else {
                    onPlay();
                }
            } else if (event.keyCode === 13) {
                if (offsetInputRef.current === document.activeElement) {
                    const offset = Number(offsetInputRef.current.value);

                    if (Number.isNaN(offset)) {
                        return;
                    }

                     onOffsetChange(offset * 1000);
                     offsetInputRef.current.blur();
                }
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [playing, onPause, onPlay, onOffsetChange]);

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate()
        }, 100);

        return () => clearInterval(interval);
    }, [forceUpdate]);

    useEffect(() => {
        if (offsetInputRef.current) {
            offsetInputRef.current.value= offsetValue;
        }
    }, [offsetValue]);

    const handleAudioTrackSelectorClosed = useCallback(() => {
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, []);

    const handleAudioTrackSelectorOpened = useCallback((e) => {
        setAudioTrackSelectorAnchorEl(e.currentTarget);
        setAudioTrackSelectorOpen(true);
    }, []);

    const handleAudioTrackSelected = useCallback((id) => {
        onAudioTrackSelected(id);
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, [onAudioTrackSelected]);

    const handleTabSelectorClosed = useCallback(() => {
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, []);

    const handleTabSelectorOpened = useCallback((e) => {
        setTabSelectorAnchorEl(e.currentTarget);
        setTabSelectorOpen(true);
    }, []);

    const handleTabSelected = useCallback((id) => {
        onTabSelected(id);
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, [onTabSelected]);

    const handleAudioUnloaderClosed = useCallback(() => {
        setAudioUnloaderAnchorEl(null);
        setAudioUnloaderOpen(false);
    }, []);

    const handleAudioUnloaderOpened = useCallback((e) => {
        setAudioUnloaderAnchorEl(e.currentTarget);
        setAudioUnloaderOpen(true);
    }, []);

    const handleUnloadAudio = useCallback(() => {
        onUnloadAudio();
        setAudioUnloaderOpen(false);
    }, [onUnloadAudio]);

    const handleVideoUnloaderClosed = useCallback((e) => {
        setVideoUnloaderAnchorEl(null);
        setVideoUnloaderOpen(false);
    }, []);

    const handleVideoUnloaderOpened = useCallback((e) => {
        setVideoUnloaderAnchorEl(e.currentTarget);
        setVideoUnloaderOpen(true);
    }, []);

    const handleUnloadVideo = useCallback(() => {
        onUnloadVideo();
        setVideoUnloaderOpen(false);
    }, [onUnloadVideo]);

    const progress = props.clock.progress(length);

    return (
        <div className={classes.container} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            <Fade in={show} timeout={200}>
                <div className={classes.paper}>
                    <ProgressBar
                        onSeek={handleSeek}
                        value={progress * 100}
                    />
                    <Grid container direction="row">
                        <Grid item>
                            <IconButton
                                onClick={() => playing ? onPause() : onPlay()}
                            >
                                {playing
                                    ? <PauseIcon className={classes.button} />
                                    : <PlayArrowIcon className={classes.button} />}
                            </IconButton>
                        </Grid>
                        <Grid item>
                            <div className={classes.timeDisplay}>
                                {displayTime(progress * length)} / {displayTime(displayLength)}
                            </div>
                        </Grid>
                        <Grid item>
                            <Input
                                inputRef={offsetInputRef}
                                disableUnderline={true}
                                className={classes.offsetInput}
                                placeholder={"±" + Number(0).toFixed(2)}
                            />
                        </Grid>
                        <Grid style={{flexGrow: 1}} item>
                        </Grid>
                        <Grid item>
                            {props.subtitlesToggle && (
                                <IconButton onClick={(e) => props.onSubtitlesToggle()}>
                                    <SubtitlesIcon className={props.subtitlesEnabled ? classes.button : classes.inactiveButton} />
                                </IconButton>
                            )}
                        </Grid>
                        <Grid item>
                            {props.videoFile && (
                                <IconButton onClick={handleVideoUnloaderOpened}>
                                    <VideocamIcon className={classes.button} />
                                </IconButton>
                            )}
                        </Grid>
                        <Grid item>
                            {props.audioFile && (
                                <IconButton onClick={handleAudioUnloaderOpened}>
                                    <AudiotrackIcon className={classes.button} />
                                </IconButton>
                            )}
                        </Grid>
                        <Grid item>
                            {props.audioTracks && props.audioTracks.length > 1 && (
                                <IconButton onClick={handleAudioTrackSelectorOpened}>
                                    <QueueMusicIcon className={classes.button}  />
                                </IconButton>
                            )}
                        </Grid>
                        <Grid item>
                            {props.tabs && props.tabs.length > 0 && (
                                <IconButton onClick={handleTabSelectorOpened}>
                                    <VideocamIcon className={props.selectedTab ? classes.button : classes.inactiveButton} />
                                </IconButton>
                            )}
                        </Grid>
                    </Grid>
                </div>
            </Fade>
            <TabSelector
                open={tabSelectorOpen && show}
                anchorEl={tabSelectorAnchorEl}
                tabs={props.tabs}
                selectedTab={props.selectedTab}
                onClose={handleTabSelectorClosed}
                onTabSelected={handleTabSelected}
            />
            <AudioTrackSelector
                open={audioTrackSelectorOpen && show}
                anchorEl={audioTrackSelectorAnchorEl}
                audioTracks={props.audioTracks}
                selectedAudioTrack={props.selectedAudioTrack}
                onClose={handleAudioTrackSelectorClosed}
                onAudioTrackSelected={handleAudioTrackSelected}
            />
            <MediaUnloader
                open={audioUnloaderOpen}
                anchorEl={audioUnloaderAnchorEl}
                file={props.audioFile}
                onClose={handleAudioUnloaderClosed}
                onUnload={handleUnloadAudio}
            />
            <MediaUnloader
                open={videoUnloaderOpen}
                anchorEl={videoUnloaderAnchorEl}
                file={props.videoFile}
                onClose={handleVideoUnloaderClosed}
                onUnload={handleUnloadVideo}
            />
        </div>
    );
}
