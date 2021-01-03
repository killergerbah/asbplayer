import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Clock from './Clock';
import Controls from './Controls';
import SubtitlePlayer from './SubtitlePlayer';

const useStyles = makeStyles({
    container: {
        height: '100vh',
        width: '100vw',
        position: 'relative',
        overflowX: 'hidden'
    }
});

function displayTime(milliseconds, totalMilliseconds) {
    const seconds = milliseconds / 1000;
    const totalSeconds = totalMilliseconds / 1000;
    let parts;

    if (totalSeconds >= 3600) {
        parts = 3;
    } else if (totalSeconds >= 60) {
        parts = 2;
    } else {
        parts = 1;
    }

    const units = [];
    let timeLeft = seconds;

    for (let i = parts - 1; i >= 0; --i) {
        const place = Math.pow(60, i);
        let digit = Math.floor(timeLeft / place);
        let timeUsed = place * digit;
        timeLeft -= timeUsed;
        units.push(digit);
    }

    return units.map((unit) => String(unit).padStart(2, '0')).join(':') + "." + (String(milliseconds % 1000)).padEnd(3, '0');
}

function trackLength(audioRef, subtitles) {
    const subtitlesLength = subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
    const audioLength = audioRef.current ? 1000 * audioRef.current.duration : 0;
    return Math.max(subtitlesLength, audioLength);
}

export default function Player(props) {
    const [subtitles, setSubtitles] = useState([]);
    const [playing, setPlaying] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);
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
                    const length = res.subtitles.length > 0
                        ? res.subtitles[res.subtitles.length - 1].end - res.subtitles[0].start
                        : 0;
                    setSubtitles(res.subtitles.map((s) => {
                        return {text: s.text, start: s.start, end: s.end, displayTime: displayTime(s.start, length)};
                    }));
                    setLoaded(true);
                })
                .catch(error => console.error(error));
        } else {
            setLoaded(true);
        }
    }, [props.api, subtitleFile]);

    useEffect(init, [init]);

    function play(clock, audioRef) {
        setPlaying(true);
        clock.start();

        if (audioRef.current) {
            audioRef.current.play();
        }
    };

    function pause(clock, audioRef) {
        setPlaying(false);
        clock.stop();

        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    const seek = useCallback((progress, clock, length, audioRef) => {
        const time = progress * length;
        clock.setTime(time);

        if (audioRef.current) {
            audioRef.current.currentTime = time / 1000;
        }

        forceUpdate();
    }, [forceUpdate]);

    const handlePlay = useCallback(() => {
        play(clock, audioRef);
    }, [clock]);

    const handlePause = useCallback(() => {
        pause(clock, audioRef);
    }, [clock]);

    const length = trackLength(audioRef, subtitles);

    const handleSeek = useCallback((progress) => {
        seek(progress, clock, length, audioRef);
    }, [clock, length, seek]);

    const handleSeekToSubtitle = useCallback((progress, shouldPlay) => {
        seek(progress, clock, length, audioRef);

        if (shouldPlay) {
            play(clock, audioRef);
        } else {
            pause(clock, audioRef);
        }
    }, [clock, length, seek]);

    function handleMouseMove(e) {
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

    return (
        <Paper onMouseMove={handleMouseMove} square className={classes.container}>
            <Controls
                mousePositionRef={mousePositionRef}
                playing={playing}
                clock={clock}
                length={length}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek} />
            <SubtitlePlayer
                playing={playing}
                subtitles={subtitles}
                clock={clock}
                length={length}
                onSeek={handleSeekToSubtitle} />
            {audioFile ? <audio ref={audioRef} src={props.api.streamingUrl(audioFile)} /> : null}
        </Paper>
    );
}