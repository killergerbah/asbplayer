import React, { useCallback, useEffect, useState, useRef } from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import CloseIcon from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Popover from '@material-ui/core/Popover';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import Slider from '@material-ui/core/Slider';
import SpeedIcon from '@material-ui/icons/Speed';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Tooltip from '@material-ui/core/Tooltip';
import VideocamIcon from '@material-ui/icons/Videocam';
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';

const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '50%',
        bottom: 0,
        pointerEvents: 'none'
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
        fontSize: 20,
        marginLeft: 10
    },
    offsetInput: {
        height: '100%',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontSize: 20,
        marginLeft: 10,
        width: 200,
        color: theme.palette.text.secondary,
        pointerEvents: 'auto'
    },
    volumeInputContainerShown: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 5,
        pointerEvents: 'auto'
    },
    volumeInputContainerHidden: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 0,
        pointerEvents: 'auto'
    },
    volumeInputHidden: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        width: 0,
        pointerEvents: 'auto'
    },
    volumeInputShown: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        width: 100,
        pointerEvents: 'auto'
    },
    volumeInputThumbHidden: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        opacity: 0,
        pointerEvents: 'auto'
    },
    volumeInputThumbShown: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        opacity: 1,
        pointerEvents: 'auto'
    },
    subContainer: {
        background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.7))",
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
        padding: 10
    },
    button: {
        color: theme.palette.action.active,
        pointerEvents: 'auto'
    },
    inactiveButton: {
        color: theme.palette.action.disabled,
        pointerEvents: 'auto'
    },
    progress: {
        margin: 5
    },
    closeButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        pointerEvents: 'auto'
    }
}));

const useProgressBarStyles = makeStyles((theme) => ({
    container: {
        background: 'rgba(30,30,30,0.7)',
        height: 5,
        margin: '0 10px 5px 10px',
        cursor: 'pointer',
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
        left: 12,
        filter: 'drop-shadow(3px 3px 3px rgba(0,0,0,0.3))'
    }
}));

const VolumeSlider = withStyles((theme) => ({
    root: {
        color: theme.palette.text.secondary,
        verticalAlign: 'middle'
    },
    thumb: {
        backgroundColor: 'white',
        color: theme.palette.text.secondary,
        '&:focus': {
            boxShadow: 'inherit'
        },
        '&:hover, &$active': {
            boxShadow: '0px 0px 0px 8px rgba(255, 255, 255, 0.1)',
        },
    },
    active: {
        color: theme.palette.text.secondary
    },
}))(Slider);

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
        const progress = Math.min(1, Math.max(0, (e.pageX - rect.left) / width));

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
    const {playing, length, offsetEnabled, displayLength, offset, onAudioTrackSelected, onSeek, mousePositionRef, onShow, onPause, onPlay, onTabSelected, onUnloadAudio, onUnloadVideo, onOffsetChange, onVolumeChange, disableKeyEvents, settingsProvider} = props;
    const [show, setShow] = useState(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState();
    const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState();
    const [audioUnloaderOpen, setAudioUnloaderOpen] = useState(false);
    const [audioUnloaderAnchorEl, setAudioUnloaderAnchorEl] = useState();
    const [videoUnloaderOpen, setVideoUnloaderOpen] = useState(false);
    const [videoUnloaderAnchorEl, setVideoUnloaderAnchorEl] = useState();
    const [showVolumeBar, setShowVolumeBar] = useState(false);
    const [volume, setVolume] = useState(100);
    const [lastCommittedVolume, setLastCommittedVolume] = useState(100);
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
        const savedVolume = Number(settingsProvider.volume);
        setVolume(savedVolume);
        onVolumeChange(savedVolume / 100);

        if (savedVolume > 0) {
            setLastCommittedVolume(savedVolume);
        }
    }, [settingsProvider, onVolumeChange]);

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

    useEffect(() => onShow?.(show), [onShow, show]);

    useEffect(() => {
        if (disableKeyEvents) {
            return;
        }

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
    }, [playing, onPause, onPlay, onOffsetChange, disableKeyEvents]);

    const handleOffsetInputClicked = useCallback((e) => e.target.setSelectionRange(0, e.target.value?.length || 0), []);

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate()
        }, 100);

        return () => clearInterval(interval);
    }, [forceUpdate]);

    useEffect(() => {
        if (offsetInputRef.current) {
            if (offset === 0) {
                offsetInputRef.current.value = null;
            } else {
                const offsetSeconds = offset / 1000;
                const value = offsetSeconds >= 0 ? "+" + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
                offsetInputRef.current.value = value;
            }
        }
    }, [offset]);

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

    const handleVolumeMouseOut = useCallback(() => setShowVolumeBar(false), []);
    const handleVolumeMouseOver = useCallback(() => setShowVolumeBar(true), []);

    const handleVolumeChange = useCallback((e, value) => {
        setVolume(value);
        onVolumeChange(value / 100);
    }, [onVolumeChange]);

    const handleVolumeChangeCommitted = useCallback((e, value) => {
        if (value > 0) {
            setLastCommittedVolume(value);
        }

        settingsProvider.volume = value;
    }, [settingsProvider]);

    const handleVolumeToggle = useCallback((e, value) => {
        setVolume((volume) => {
            const newVolume = volume > 0 ? 0 : lastCommittedVolume;
            onVolumeChange(newVolume / 100);
            return newVolume;
        });
    }, [onVolumeChange, lastCommittedVolume]);

    const progress = props.clock.progress(length);

    return (
        <React.Fragment>
            {props.closeEnabled && (
                <Fade in={show} timeout={200}>
                    <IconButton
                        className={classes.closeButton}
                        onClick={() => props.onClose()}
                    >
                        <CloseIcon />
                    </IconButton>
                </Fade>
            )}
            <div className={classes.container} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
                <Fade in={show} timeout={200}>
                    <div className={classes.subContainer}>
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
                            {props.volumeEnabled && (
                                <Grid item
                                    onMouseOver={handleVolumeMouseOver}
                                    onMouseOut={handleVolumeMouseOut}
                                    className={showVolumeBar ? classes.volumeInputContainerShown : classes.volumeInputContainerHidden}
                                >
                                    <IconButton onClick={handleVolumeToggle}>
                                        {volume === 0 ? (<VolumeOffIcon />) : (<VolumeUpIcon />)}
                                    </IconButton>
                                    <VolumeSlider
                                        onChange={handleVolumeChange}
                                        onChangeCommitted={handleVolumeChangeCommitted}
                                        value={volume}
                                        defaultValue={100}
                                        classes={{
                                            root: showVolumeBar ? classes.volumeInputShown : classes.volumeInputHidden,
                                            thumb: showVolumeBar ? classes.volumeInputThumbShown : classes.volumeInputThumbHidden
                                        }}
                                    />
                                </Grid>
                            )}
                            <Grid item>
                                <div className={classes.timeDisplay}>
                                    {displayTime(progress * length)} / {displayTime(displayLength || length)}
                                </div>
                            </Grid>
                            {offsetEnabled && (
                                <Grid item>
                                    <Input
                                        inputRef={offsetInputRef}
                                        disableUnderline={true}
                                        className={classes.offsetInput}
                                        placeholder={"±" + Number(0).toFixed(2) + " subtitle offset"}
                                        onClick={handleOffsetInputClicked}
                                    />
                                </Grid>
                            )}
                            <Grid style={{flexGrow: 1}} item>
                            </Grid>
                            {props.condensedModeToggleEnabled && (
                                <Grid item>
                                    <Tooltip title="Condensed Mode">
                                        <IconButton onClick={(e) => props.onCondensedModeToggle()}>
                                            <SpeedIcon className={props.condensedModeEnabled ? classes.button : classes.inactiveButton} />
                                        </IconButton>
                                    </Tooltip>
                                </Grid>
                            )}
                            {props.subtitlesToggle && (
                                <Grid item>
                                    <IconButton onClick={(e) => props.onSubtitlesToggle()}>
                                        <SubtitlesIcon className={props.subtitlesEnabled ? classes.button : classes.inactiveButton} />
                                    </IconButton>
                                </Grid>
                            )}
                            {props.videoFile && (
                                <Grid item>
                                    <IconButton onClick={handleVideoUnloaderOpened}>
                                        <VideocamIcon className={classes.button} />
                                    </IconButton>
                                 </Grid>
                            )}
                            {props.audioFile && (
                                <Grid item>
                                    <IconButton onClick={handleAudioUnloaderOpened}>
                                        <AudiotrackIcon className={classes.button} />
                                    </IconButton>
                                </Grid>
                            )}
                            {props.audioTracks && props.audioTracks.length > 1 &&  (
                                <Grid item>
                                    <IconButton onClick={handleAudioTrackSelectorOpened}>
                                        <QueueMusicIcon className={classes.button}  />
                                    </IconButton>
                                </Grid>
                            )}
                            {props.tabs && props.tabs.length > 0 && (
                                <Grid item>
                                    <IconButton onClick={handleTabSelectorOpened}>
                                        <VideocamIcon className={props.selectedTab ? classes.button : classes.inactiveButton} />
                                    </IconButton>
                                </Grid>
                            )}
                            {props.popOutEnabled && (
                                <Grid item>
                                    <IconButton onClick={() => props.onPopOutToggle()}>
                                        <OpenInNewIcon className={classes.button} style={props.popOut ? {transform: 'rotateX(180deg)'} : {}}/>
                                    </IconButton>
                                </Grid>
                            )}
                            {props.fullscreenEnabled && (
                                <Grid item>
                                    <IconButton onClick={() => props.onFullscreenToggle()}>
                                        {props.fullscreen
                                            ? (<FullscreenExitIcon className={classes.button} />)
                                            : (<FullscreenIcon className={classes.button} />)}
                                    </IconButton>
                                </Grid>
                            )}
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
        </React.Fragment>
    );
}
