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
import { useEffect, useState, useMemo, useCallback, useRef, createRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
    container: {
        maxHeight: '100vh',
        maxWidth: '100vw',
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
    },
    progress: {
        top: '40%',
        height: '20%',
        width: '99%',
        transition: 'none'
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
        return this.time(max) / max;
    }
}

function Controls(props) {
    const classes = useControlStyles();
    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.right - rect.left;
        const progress = (e.pageX - rect.left) / width;

        props.onSeek(progress);
    };

    return (
        <div className={classes.container}>
            <Fade in={props.show} timeout={200}>
                <Paper square className={classes.paper}>
                    <Grid container direction="row">
                        <Grid item>
                            {props.playing
                                ? <PauseIcon onClick={props.onPause} className={classes.playButton} />
                                : <PlayArrowIcon onClick={props.onPlay} className={classes.playButton} />}
                        </Grid>
                        <Grid item xs>
                            <LinearProgress onClick={handleSeek} className={classes.progress} variant="determinate" value={props.progress * 100} />
                        </Grid>
                    </Grid>
                </Paper>
            </Fade>
        </div>
    );
}

function trackLength(subtitles) {
    return subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
}

function SubtitlePlayer(props) {
    const clock = props.clock;
    const subtitles = props.subtitles;
    const subtitleRefs = useMemo(() => Array(subtitles.length).fill().map((_, i) => createRef()), [subtitles]);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const classes = useStyles();

    useEffect(() => {
        const interval = setInterval(() => {
            const length = trackLength(subtitles);
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
    }, [subtitles, clock, selectedSubtitleIndex, subtitleRefs])

    if (subtitles.length === 0) {
        return null;
    }

    return (
        <TableContainer className={classes.container}>
            <Table>
                <TableBody>
                    {subtitles.map((s, index) => {
                        const selected = index === selectedSubtitleIndex;
                        return (
                            <TableRow ref={subtitleRefs[index]} key={index} selected={selected}><TableCell>{s.text}</TableCell></TableRow>
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
    const [lastMouseMove, setLastMouseMove] = useState(Date.now());
    const audioRef = useRef(null);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();

    const init = useCallback(() => {
        if (props.media.subtitleFile) {
            props.api.subtitles(props.media.subtitleFile.path)
                .then(res => {
                    setSubtitles(res.subtitles);
                    setLoaded(true);
                })
                .catch(error => console.error(error));
        } else {
            setLoaded(true);
        }
    }, [props.api, props.media.subtitleFile]);

    useEffect(init, [init]);

    useEffect(() => {
        const timeLeftUntilHide = Math.max(0, 2000 - Date.now() + lastMouseMove);
        if (timeLeftUntilHide > 0) {
            if (!showControls) {
                setShowControls(true);
            }
            const timeout = setTimeout(() => {
                setShowControls(false);
            }, timeLeftUntilHide);
            return () => clearTimeout(timeout);
        }
    }, [lastMouseMove, showControls]);

    if (!loaded) {
        return null;
    }

    const handlePlay = () => {
        setPlaying(true);
        clock.start();
        if (audioRef.current) {
            audioRef.current.play();
        }
    };

    const handlePause = () => {
        setPlaying(false);
        clock.stop();
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const handleSeek = (progress) => {
        const time = progress * trackLength(subtitles);
        clock.setTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time / 1000;
        }
    };

    const handleMouseMove = () => {
        setLastMouseMove(Date.now());
    };

    const length = trackLength(subtitles);
    const progress = clock.progress(length);
    let audio = null;

    if (props.media.audioFile) {
        audio =  (<audio ref={audioRef} src={props.api.streamingUrl(props.media.audioFile.path)} />);
    }

    return (
        <Paper square onMouseMove={handleMouseMove} className={classes.container}>
            <Controls show={showControls} playing={playing} progress={progress} onPlay={handlePlay} onPause={handlePause} onSeek={handleSeek} lastMouseMove={lastMouseMove} />
            <SubtitlePlayer subtitles={subtitles} clock={clock} />
            {audio}
        </Paper>
    );
}