import Container from '@material-ui/core/Container';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import Modal from '@material-ui/core/Modal';
import Paper from '@material-ui/core/Paper';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import LinearProgress from '@material-ui/core/LinearProgress';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import { useEffect, useState, useMemo, useCallback, useRef, createRef, memo } from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
    container: {
        height: '100vh',
        width: '100vw',
        position: 'relative',
        overflowX: 'hidden'
    },
    subtitle: {
        background: 'gray'
    },
    selectedSubtitle: {
        background: 'white'
    }
});

const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '98%',
        bottom: '3%'
    },
    paper: {
        background: 'black',
        position: 'relative',
        left: '-50%',
        zIndex: 10,
        flexGrow: 1
    },
    playButton: {
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30
    },
    progress: {
        top: '40%',
        height: '20%',
        marginRight: 10,
    },
    bar1Determinate: {
        transition: 'none',
        background: 'linear-gradient(to left, #e21e4a, #a92fff)',
    }
}));

function Clock() {
    this.accumulated = 0;
    this.started = false;

    this.time = (max) => {
        if (this.started) {
            return Math.min(max, this.accumulated + Date.now() - this.startTime);
        }

        return Math.min(max, this.accumulated);
    };

    this.stop = () => {
        this.started = false;
        this.accumulated += Date.now() - this.startTime;
    };

    this.start = () => {
        this.startTime = Date.now();
        this.started = true;
    };

    this.setTime = (time) => {
        if (this.started) {
            this.startTime = Date.now();
            this.accumulated = time;
        } else {
            this.accumulated = time;
        }
    };

    this.progress = (max) => {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }
}

function Controls(props) {
    const classes = useControlStyles();
    const [globalTime, setGlobalTime] = useState(Date.now());
    const lastMousePositionRef = useRef({x: 0, y: 0});
    const lastShowTimestampRef = useRef(Date.now());
    const lastShowRef = useRef(true);

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.right - rect.left;
        const progress = (e.pageX - rect.left) / width;

        props.onSeek(progress);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setGlobalTime(Date.now());
            lastMousePositionRef.current.x = props.mousePositionRef.current.x;
            lastMousePositionRef.current.y = props.mousePositionRef.current.y;
        }, 100);
        return () => clearInterval(interval);
    }, [props.mousePositionRef]);

    const progress = props.clock.progress(props.length);
    const show = Date.now() - lastShowTimestampRef.current < 2000
        || Math.pow(props.mousePositionRef.current.x - lastMousePositionRef.current.x, 2)
            + Math.pow(props.mousePositionRef.current.y - lastMousePositionRef.current.y, 2) > 100;

    if (show && !lastShowRef.current) {
        lastShowTimestampRef.current = Date.now();
    }

    lastShowRef.current = show;

    return (
        <div className={classes.container}>
            <Fade in={show} timeout={200}>
                <Paper square className={classes.paper}>
                    <Grid container direction="row">
                        <Grid item>
                            {props.playing
                                ? <PauseIcon onClick={props.onPause} className={classes.playButton} />
                                : <PlayArrowIcon onClick={props.onPlay} className={classes.playButton} />}
                        </Grid>
                        <Grid item xs>
                            <LinearProgress onClick={handleSeek} classes={{bar1Determinate: classes.bar1Determinate}} className={classes.progress} variant="determinate" value={progress * 100} />
                        </Grid>
                    </Grid>
                </Paper>
            </Fade>
        </div>
    );
}

function trackLength(audioRef, subtitles) {
    const subtitlesLength = subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
    const audioLength = audioRef.current ? 1000 * audioRef.current.duration : 0;
    return Math.max(subtitlesLength, audioLength);
}

function SubtitlePlayer(props) {
    const clock = props.clock;
    const subtitles = props.subtitles;
    const subtitleRefs = useMemo(() => Array(subtitles.length).fill().map((_, i) => createRef()), [subtitles]);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const classes = useStyles();

    useEffect(() => {
        const interval = setInterval(() => {
            const length = props.length;
            const progress = clock.progress(length);
            const currentSubtitleIndex = subtitles.findIndex(s => s.end / length > progress);
            if (currentSubtitleIndex !== -1 && currentSubtitleIndex !== selectedSubtitleIndex) {
                 setSelectedSubtitleIndex(currentSubtitleIndex);
                 const selectedSubtitleRef = subtitleRefs[currentSubtitleIndex];
                 if (selectedSubtitleRef.current) {
                     selectedSubtitleRef.current.scrollIntoView({block: "center", inline: "nearest", behavior: "smooth"});
                 }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [subtitles, clock, selectedSubtitleIndex, subtitleRefs, props.length])

    const handleClick = (subtitleIndex) => {
        const progress = props.subtitles[subtitleIndex].start / props.length;
        props.onSeek(progress);
    };

    if (subtitles.length === 0) {
        return null;
    }

    return (
        <TableContainer className={classes.container}>
            <Table>
                <TableBody>
                    {props.subtitles.map((s, index) => {
                        const selected = index === selectedSubtitleIndex;
                        return (
                            <TableRow onClick={(e) => handleClick(index)} key={index} ref={subtitleRefs[index]} selected={selected}><TableCell>{s.text}</TableCell></TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default function Player(props) {
    const [subtitles, setSubtitles] = useState([]);
    const [playing, setPlaying] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [globalTime, setGlobalTime] = useState(Date.now());
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef(null);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const { subtitleFile, audioFile } = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            audioFile: params.get('audio'),
            subtitleFile: params.get('subtitle')
        };
    }, []);

    const init = useCallback(() => {
        if (subtitleFile) {
            props.api.subtitles(subtitleFile)
                .then(res => {
                    setSubtitles(res.subtitles);
                    setLoaded(true);
                })
                .catch(error => console.error(error));
        } else {
            setLoaded(true);
        }
    }, [props.api, subtitleFile]);

    useEffect(init, [init]);

    const play = (clock, audioRef) => {
        setPlaying(true);
        clock.start();
        if (audioRef.current) {
            audioRef.current.play();
        }
    };

    const pause = (clock, audioRef) => {
        setPlaying(false);
        clock.stop();
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const seek = (progress, clock, length, audioRef) => {
        const time = progress * length;
        clock.setTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time / 1000;
        }
        setGlobalTime(Date.now());
    };

    const handlePlay = useCallback(() => {
        play(clock, audioRef);
    }, [clock]);

    const handlePause = useCallback(() => {
        pause(clock, audioRef);
    }, [clock]);

    const length = trackLength(audioRef, subtitles);

    const handleSeek = useCallback((progress) => {
        seek(progress, clock, length, audioRef);
    }, [clock, length]);

    const handleSeekToSubtitle = useCallback((progress) => {
        seek(progress, clock, length, audioRef);
        if (playing) {
            pause(clock, audioRef);
        }
    }, [clock, length, playing]);

    const handleMouseMove = (e) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const progress = clock.progress(length);
            if (progress >= 1) {
                clock.setTime(0);
                clock.stop();
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                setPlaying(false);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [clock, length, audioRef]);

    if (!loaded) {
        return null;
    }

    let audio = null;

    if (audioFile) {
        audio =  (<audio ref={audioRef} src={props.api.streamingUrl(audioFile)} />);
    }

    return (
        <Paper onMouseMove={handleMouseMove} square className={classes.container}>
            <Controls mousePositionRef={mousePositionRef} playing={playing} clock={clock} length={length} onPlay={handlePlay} onPause={handlePause} onSeek={handleSeek} />
            <SubtitlePlayer subtitles={subtitles} clock={clock} length={length} onSeek={handleSeekToSubtitle} />
            {audio}
        </Paper>
    );
}