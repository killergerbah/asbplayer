import { useCallback, useEffect, useState, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import Typography from '@material-ui/core/Typography';

const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '100%',
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
        marginLeft: 10
    },
    paper: {
        background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0, 0, 0, 0.5))",
        position: 'relative',
        left: '-50%',
        zIndex: 10,
        padding: 10
    },
    playButtonContainer: {
        display: 'flex',
        flexDirection: "column",
        justifyContent: 'center',
        height: "100%",
    },
    playButton: {
        color: 'white',
        width: 35,
        height: 30,
        marginBottom: 0,
        cursor: 'pointer'
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
        background: 'rgba(0,0,0,0.5)',
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

export default function Controls(props) {
    const classes = useControlStyles();
    const [show, setShow] = useState(true);
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

    const progress = props.clock.progress(props.length);

    return (
        <div className={classes.container} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            <Fade in={show} timeout={200}>
                <div className={classes.paper}>
                    <ProgressBar
                        onSeek={handleSeek}
                        value={progress * 100} />
                    <Grid container direction="row">
                        <Grid item>
                            <div className={classes.playButtonContainer}>
                            {props.playing
                                ? <PauseIcon onClick={props.onPause} className={classes.playButton} />
                                : <PlayArrowIcon onClick={props.onPlay} className={classes.playButton} />}
                            </div>
                        </Grid>
                        <Grid item>
                            <Typography variant="h6" className={classes.timeDisplay}>
                                {displayTime(progress * props.length)}
                            </Typography>
                        </Grid>
                    </Grid>
                </div>
            </Fade>
        </div>
    );
}
