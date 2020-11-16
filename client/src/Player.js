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
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
    container: {
        maxHeight: '90vh',
        maxWidth: '90vw',
        position: 'relative'
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
}

function Controls(props) {
    const classes = useControlStyles();
    const [show, setShow] = useState(true);
    const handleSeek = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.right - rect.left;
        const progress = (e.pageX - rect.left) / width;

        props.onSeek(progress);
    }, []);

    useEffect(() => {
        const timeLeftUntilHide = Math.max(0, 2000 - Date.now() + props.lastMouseMove);
        if (timeLeftUntilHide > 0) {
            if (!show) {
                setShow(true);
            }
            const timeout = setTimeout(() => {
                setShow(false);
            }, timeLeftUntilHide);
            return () => clearTimeout(timeout);
        }
    }, [props.lastMouseMove]);

    return (
        <div className={classes.container}>
            <Fade in={show}>
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

export default function Player(props) {
    const [subtitles, setSubtitles] = useState([]);
    const [playing, setPlaying] = useState(false);
    const [selectedSubtitle, setSelectedSubtitle] = useState(0);
    const [globalTime, setGlobalTime] = useState(Date.now());
    const [lastMouseMove, setLastMouseMove] = useState(Date.now());
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const nextSubtitleRef = useRef(null);
    const init = useCallback(() => {
        if (props.file.type === 'subtitle') {
            const advance = () => {
            setGlobalTime(Date.now());
        };

        props.api.subtitles(props.file.path)
            .then(res => {
                setSubtitles(res.subtitles);
            })
            .catch(console.error);

            const interval = setInterval(advance, 500);
            return () => clearInterval(interval);
        }
    }, [props.api, props.file.path, props.file.type]);

    useEffect(init, [init]);

    const handlePlay = useCallback(() => {
        setPlaying(true);
        clock.start();
    }, [clock]);

    const handlePause = useCallback(() => {
        setPlaying(false);
        clock.stop();
    }, [clock]);

    const handleSeek = (progress) => {
        const trackLength = subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
        clock.setTime(progress * trackLength);
    };

    const handleMouseMove = useCallback(() => {
        setLastMouseMove(Date.now());
    }, []);


    if (subtitles.length === 0) {
        return null;
    }

    const trackLength = subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
    const progress = clock.time(trackLength) / trackLength;
    const currentSubtitle = subtitles.findIndex(s => s.end / trackLength > progress);

    if (currentSubtitle !== selectedSubtitle) {
         setSelectedSubtitle(currentSubtitle);
    }

    if (nextSubtitleRef.current) {
        nextSubtitleRef.current.scrollIntoView({block: "center", inline: "nearest", behavior: "smooth"});
    }

    return (
        <Paper square onMouseMove={handleMouseMove} className={classes.container}>
            <Controls playing={playing} progress={progress} onPlay={handlePlay} onPause={handlePause} onSeek={handleSeek} lastMouseMove={lastMouseMove} />
            <TableContainer className={classes.container}>
                <Table>
                    <TableBody>
                        {subtitles.map((s, index) => {
                            const selected = index === selectedSubtitle;
                            const next = index - 1 === selectedSubtitle;
                            return (
                                <TableRow ref={next ? nextSubtitleRef : null} key={index} selected={selected}><TableCell>{s.text}</TableCell></TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}