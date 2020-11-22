import { useEffect, useState, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import LinearProgress from '@material-ui/core/LinearProgress';

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

export default function Controls(props) {
    const classes = useControlStyles();
    const [show, setShow] = useState(true);
    const lastMousePositionRef = useRef({x: 0, y: 0});
    const lastShowTimestampRef = useRef(Date.now());
    const lastShowRef = useRef(true);

    function handleSeek(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.right - rect.left;
        const progress = (e.pageX - rect.left) / width;

        props.onSeek(progress);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const currentShow = Date.now() - lastShowTimestampRef.current < 2000
                || Math.pow(props.mousePositionRef.current.x - lastMousePositionRef.current.x, 2)
                    + Math.pow(props.mousePositionRef.current.y - lastMousePositionRef.current.y, 2) > 100;

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

    const progress = props.clock.progress(props.length);

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
                            <LinearProgress
                                onClick={handleSeek}
                                classes={{bar1Determinate: classes.bar1Determinate}}
                                className={classes.progress}
                                variant="determinate"
                                value={progress * 100} />
                        </Grid>
                    </Grid>
                </Paper>
            </Fade>
        </div>
    );
}
