import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Clock from './Clock';
import Controls from './Controls';
import SubtitlePlayer from './SubtitlePlayer';
import VideoChannel from './VideoChannel';

const useStyles = makeStyles({
    root: {
        height: 'calc(100vh - 64px)',
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

function trackLength(audioRef, videoRef, subtitles) {
    const subtitlesLength = subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0;
    const audioLength = audioRef.current && audioRef.current.duration
        ? 1000 * audioRef.current.duration
        : 0;
    const videoLength = videoRef.current && videoRef.current.duration
        ? 1000 * videoRef.current.duration
        : 0;
    return Math.max(videoLength, Math.max(subtitlesLength, audioLength));
}

export default function Player(props) {
    const [subtitles, setSubtitles] = useState([]);
    const [playing, setPlaying] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState(null);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const { subtitleFile, audioFile, videoFile, fileName } = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            subtitleFile: params.get('subtitle'),
            audioFile: params.get('audio'),
            videoFile: params.get('video'),
            fileName: params.get('name')
        };
    }, []);
    const seek = useCallback((progress, clock, length, audioRef, videoRef) => {
        const time = progress * length;
        clock.setTime(time);

        if (audioRef.current) {
            audioRef.current.currentTime = time / 1000;
        }

        if (videoRef.current) {
            videoRef.current.currentTime = time / 1000;
        }

        forceUpdate();
    }, [forceUpdate]);

    const init = useCallback(() => {
        if (subtitleFile) {
            props.api.subtitles(subtitleFile)
                .then(res => {
                    const length = res.subtitles.length > 0
                        ? res.subtitles[res.subtitles.length - 1].end - res.subtitles[0].start
                        : 0;
                    const mappedSubtitles = res.subtitles.map((s) => {
                        return {text: s.text, start: s.start, end: s.end, displayTime: displayTime(s.start, length)};
                    });
                    setSubtitles(mappedSubtitles);

                    if (videoFile) {
                        const channel = String(Date.now());
                        const videoChannel = new VideoChannel(channel);
                        videoRef.current = videoChannel;
                        videoRef.current.onReady(() => {
                            setLoaded(true);
                            if (videoRef.current) {
                                videoRef.current.ready(trackLength(audioRef, videoRef, mappedSubtitles));

                                if (videoRef.current.audioTracks && videoRef.current.audioTracks.length > 1) {
                                    setAudioTracks(videoRef.current.audioTracks);
                                    setSelectedAudioTrack(videoRef.current.selectedAudioTrack);
                                }
                            }
                        });
                        videoRef.current.onPlay(() => {
                            play(clock, audioRef, videoRef);
                        });
                        videoRef.current.onPause(() => {
                            pause(clock, audioRef, videoRef);
                        });
                        videoRef.current.onCurrentTime((currentTime) => {
                            const length = trackLength(audioRef, videoRef, mappedSubtitles);
                            const progress = currentTime * 1000 / length;
                            seek(progress, clock, length, audioRef, videoRef);
                        });
                        videoRef.current.onAudioTrackSelected((id) => {
                            setSelectedAudioTrack(id);
                        });

                        window.open(
                            '/?video=' + encodeURIComponent(videoFile) + '&channel=' + channel,
                            'asbplayer-video',
                            "resizable,width=800,height=450");
                    } else {
                        setLoaded(true);
                    }
                })
                .catch(error => console.error(error));
        } else {
            setLoaded(true);
        }

        return () => {
            if (videoRef.current) {
                videoRef.current.close();
                videoRef.current = null;
            }
        }
    }, [props.api, subtitleFile, videoFile, clock, seek, setSelectedAudioTrack]);

    useEffect(init, [init]);

    function play(clock, audioRef, videoRef) {
        setPlaying(true);
        clock.start();

        if (audioRef.current) {
            audioRef.current.play();
        }

        if (videoRef.current) {
            videoRef.current.play();
        }
    };

    function pause(clock, audioRef, videoRef) {
        setPlaying(false);
        clock.stop();

        if (audioRef.current) {
            audioRef.current.pause();
        }

        if (videoRef.current) {
            videoRef.current.pause();
        }
    };

    const handlePlay = useCallback(() => {
        play(clock, audioRef, videoRef);
    }, [clock]);

    const handlePause = useCallback(() => {
        pause(clock, audioRef, videoRef);
    }, [clock]);

    const handleSeek = useCallback((progress) => {
        const length = trackLength(audioRef, videoRef, subtitles);
        seek(progress, clock, length, audioRef, videoRef);
    }, [clock, subtitles, seek]);

    const handleSeekToSubtitle = useCallback((progress, shouldPlay) => {
        const length = trackLength(audioRef, videoRef, subtitles);
        seek(progress, clock, length, audioRef, videoRef);

        if (shouldPlay) {
            play(clock, audioRef, videoRef);
        } else {
            pause(clock, audioRef, videoRef);
        }
    }, [clock, subtitles, seek]);

    const handleCopy = useCallback((text, start, end) => {
        props.onCopy(
            text,
            start,
            end,
            fileName,
            audioFile ? audioFile : videoFile,
            videoFile
        );
    }, [props, fileName, audioFile, videoFile]);

    function handleMouseMove(e) {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    };

    function handleAudioTrackSelected(id) {
        if (videoRef.current) {
            videoRef.current.audioTrackSelected(id);
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const length = trackLength(audioRef, videoRef, subtitles);
            const progress = clock.progress(length);

            if (progress >= 1) {
                clock.setTime(0);
                clock.stop();

                if (audioRef.current) {
                    audioRef.current.pause();
                }

                if (videoRef.current) {
                    videoRef.current.pause();
                }

                setPlaying(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, subtitles, audioRef, videoRef]);

    if (!loaded) {
        return null;
    }

    const length = trackLength(audioRef, videoRef, subtitles);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            <Controls
                mousePositionRef={mousePositionRef}
                playing={playing}
                clock={clock}
                length={length}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedAudioTrack}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected} />
            <SubtitlePlayer
                playing={playing}
                subtitles={subtitles}
                clock={clock}
                length={length}
                onSeek={handleSeekToSubtitle}
                onCopy={handleCopy} />
            {audioFile ? <audio ref={audioRef} src={props.api.streamingUrl(audioFile)} /> : null}
        </div>
    );
}