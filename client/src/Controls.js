import { useCallback, useEffect, useState, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Typography from '@material-ui/core/Typography';
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
        color: 'white',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: '100%',
        cursor: 'default'
    },
    paper: {
        background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0, 0, 0, 0.5))",
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
        padding: 10
    },
    activeButton: {
        color: "#55ff55"
    },
    button: {
        color: 'white'
    },
    disabledButton: {
        color: 'disabled'
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

export default function Controls(props) {
    const classes = useControlStyles();
    const [show, setShow] = useState(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState();
    const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState();
    const lastMousePositionRef = useRef({x: 0, y: 0});
    const lastShowTimestampRef = useRef(Date.now());
    const lastShowRef = useRef(true);
    const forceShowRef = useRef(false);
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    const handleSeek = useCallback((progress) => {
        props.onSeek(progress);
    }, [props]);

    function handleMouseOver(e) {
        forceShowRef.current = true;
    };

    function handleMouseOut(e) {
        forceShowRef.current = false;
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const currentShow = Date.now() - lastShowTimestampRef.current < 2000
                || Math.pow(props.mousePositionRef.current.x - lastMousePositionRef.current.x, 2)
                    + Math.pow(props.mousePositionRef.current.y - lastMousePositionRef.current.y, 2) > 100
                || forceShowRef.current;

            if (currentShow && !lastShowRef.current) {
                lastShowTimestampRef.current = Date.now();
                setShow(currentShow);
            } else if (!currentShow && lastShowRef.current) {
                setShow(currentShow);
            }

            lastShowRef.current = currentShow;
            lastMousePositionRef.current.x = props.mousePositionRef.current.x;
            lastMousePositionRef.current.y = props.mousePositionRef.current.y;
        }, 100);
        return () => clearInterval(interval);
    }, [props.mousePositionRef, setShow, show]);

    useEffect(() => {
        function handleKey(event) {
            if (event.keyCode === 32) {
                event.preventDefault();

                if (props.playing) {
                    props.onPause();
                } else {
                    props.onPlay();
                }
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [props]);

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate()
        }, 100);

        return () => clearInterval(interval);
    }, [forceUpdate]);

    const handleAudioTrackSelectorClosed = useCallback(() => {
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, []);

    const handleAudioTrackSelectorOpened = useCallback((e) => {
        setAudioTrackSelectorAnchorEl(e.currentTarget);
        setAudioTrackSelectorOpen(true);
    }, []);

    const handleAudioTrackSelected = useCallback((id) => {
        props.onAudioTrackSelected(id);
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, [props]);

    const handleTabSelectorClosed = useCallback(() => {
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, []);

    const handleTabSelectorOpened = useCallback((e) => {
        setTabSelectorAnchorEl(e.currentTarget);
        setTabSelectorOpen(true);
    }, []);

    const handleTabSelected = useCallback((id) => {
        props.onTabSelected(id);
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, [props]);

    const progress = props.clock.progress(props.length);

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
                                onClick={() => props.playing ? props.onPause() : props.onPlay()}
                            >
                                {props.playing
                                    ? <PauseIcon className={classes.button} />
                                    : <PlayArrowIcon className={classes.button} />}
                            </IconButton>
                        </Grid>
                        <Grid item>
                            <Typography variant="h6" className={classes.timeDisplay}>
                                {displayTime(progress * props.length)} / {displayTime(props.length)}
                            </Typography>
                        </Grid>
                        <Grid style={{flexGrow: 1}} item>
                        </Grid>
                        <Grid item>
                            {props.subtitlesToggle && (
                                <IconButton onClick={(e) => props.onSubtitlesToggle()}>
                                    <SubtitlesIcon className={props.subtitlesEnabled ? classes.button : classes.disabledButton} />
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
                                    <VideocamIcon className={props.selectedTab ? classes.activeButton : classes.button} />
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
        </div>
    );
}
