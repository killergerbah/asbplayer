import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import Clock from './Clock';
import Controls from './Controls';
import MediaAdapter from './MediaAdapter';
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
    const subtitlesLength = subtitles === null ? 0 : (subtitles.length > 0 ? subtitles[subtitles.length - 1].end - subtitles[0].start : 0);
    const audioLength = audioRef.current && audioRef.current.duration
        ? 1000 * audioRef.current.duration
        : 0;
    const videoLength = videoRef.current && videoRef.current.duration
        ? 1000 * videoRef.current.duration
        : 0;
    return Math.max(videoLength, Math.max(subtitlesLength, audioLength));
}

export default function Player(props) {
    const [subtitles, setSubtitles] = useState(null);
    const [playing, setPlaying] = useState(false);
    const playingRef = useRef();
    playingRef.current = playing;
    const [loaded, setLoaded] = useState(false);
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState(null);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const mediaAdapter = useMemo(() => new MediaAdapter(audioRef, videoRef), []);
    const clock = useMemo(() => new Clock(), []);

    const classes = useStyles();
    const location = useLocation();
    const [subtitleFile, setSubtitleFile] = useState(null);
    const [audioFile, setAudioFile] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [fileName, setFileName] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setPlaying(false);
        setLoaded(false);
        mediaAdapter.pause();
        clock.setTime(0);
        clock.stop();
        setSubtitleFile(params.get('subtitle'));
        setAudioFile(params.get('audio'));
        setVideoFile(params.get('video'));
        setFileName(params.get('name'));
    }, [location, setSubtitleFile, setAudioFile, setVideoFile, setFileName, mediaAdapter, clock]);

    const seek = useCallback((progress, clock, length, callback) => {
        const time = progress * length;
        clock.setTime(time);
        forceUpdate();
        mediaAdapter.seek(time / 1000).then((v) => callback());
    }, [forceUpdate, mediaAdapter]);

    const init = useCallback(() => {
        const subtitlePromise = new Promise((resolve, reject) => {
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
                        resolve(mappedSubtitles);
                    })
                    .catch(reject);
            } else {
                resolve([]);
            }
        });

        const videoPromise = new Promise((resolve, reject) => {
            if (videoFile) {
                const channel = String(Date.now());
                const videoChannel = new VideoChannel(channel);
                videoRef.current = videoChannel;
                videoRef.current.onReady(() => {
                    resolve();
                });

                window.open(
                    '/?video=' + encodeURIComponent(videoFile) + '&channel=' + channel,
                    'asbplayer-video-' + videoFile,
                    "resizable,width=800,height=450");
            } else {
                resolve();
            }
        });

        Promise.all([subtitlePromise, videoPromise])
            .then(v => {
                const mappedSubtitles = v[0];

                if (videoRef.current) {
                    videoRef.current.ready(trackLength(audioRef, videoRef, mappedSubtitles));

                    videoRef.current.onPlay(() => {
                        play(clock, mediaAdapter);
                    });

                    videoRef.current.onPause(() => {
                        pause(clock, mediaAdapter);
                    });

                    videoRef.current.onCurrentTime((currentTime) => {
                        const length = trackLength(audioRef, videoRef, mappedSubtitles);
                        const progress = currentTime * 1000 / length;

                        if (playingRef.current) {
                            clock.stop();
                        }

                        seek(progress, clock, length, (v) => {
                            if (playingRef.current) {
                                clock.start();
                            }
                        });
                    });

                    videoRef.current.onAudioTrackSelected((id) => {
                        if (playingRef.current) {
                            clock.stop();
                        }

                        mediaAdapter.onReady(() => {
                            if (playingRef.current) {
                                clock.start();
                            }
                        });

                        setSelectedAudioTrack(id);
                    });

                    if (videoRef.current.audioTracks && videoRef.current.audioTracks.length > 1) {
                        setAudioTracks(videoRef.current.audioTracks);
                        setSelectedAudioTrack(videoRef.current.selectedAudioTrack);
                    }
                }

                setLoaded(true);
            });

        return () => {
            if (videoRef.current) {
                videoRef.current.close();
                videoRef.current = null;
            }
        }
    }, [props.api, subtitleFile, videoFile, clock, seek, setSelectedAudioTrack, mediaAdapter]);

    useEffect(init, [init]);

    function play(clock, mediaAdapter) {
        setPlaying(true);
        clock.start();
        mediaAdapter.play();
    };

    function pause(clock, mediaAdapter) {
        setPlaying(false);
        clock.stop();
        mediaAdapter.pause();
    };

    const handlePlay = useCallback(() => {
        play(clock, mediaAdapter);
    }, [clock, mediaAdapter]);

    const handlePause = useCallback(() => {
        pause(clock, mediaAdapter);
    }, [clock, mediaAdapter]);

    const handleSeek = useCallback((progress) => {
        const length = trackLength(audioRef, videoRef, subtitles);

        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, length, () => {
            if (playingRef.current) {
                clock.start();
            }
        });
    }, [clock, subtitles, seek]);

    const handleSeekToSubtitle = useCallback((progress, shouldPlay) => {
        const length = trackLength(audioRef, videoRef, subtitles);

        if (!shouldPlay) {
            pause(clock, mediaAdapter);
        }

        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, length, () => {
            if (shouldPlay && !playingRef.current) {
                // play method will start the clock again
                play(clock, mediaAdapter);
            }
        });
    }, [clock, subtitles, seek, mediaAdapter]);

    const handleCopy = useCallback((text, start, end) => {
        props.onCopy(
            text,
            start,
            end,
            fileName,
            audioFile,
            videoFile,
            subtitleFile,
            selectedAudioTrack
        );
    }, [props, fileName, audioFile, videoFile, subtitleFile, selectedAudioTrack]);

    function handleMouseMove(e) {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    };

    const handleAudioTrackSelected = useCallback((id) => {
        const length = trackLength(audioRef, videoRef, subtitles);

        if (videoRef.current) {
            videoRef.current.audioTrackSelected(id);
        }

        pause(clock, mediaAdapter);
        seek(0, clock, length, () => {
            if (playingRef.current) {
                play(clock, mediaAdapter);
            }
        });
    }, [clock, mediaAdapter, subtitles, seek]);

    useEffect(() => {
        const interval = setInterval(() => {
            const length = trackLength(audioRef, videoRef, subtitles);
            const progress = clock.progress(length);

            if (progress >= 1) {
                clock.setTime(0);
                clock.stop();
                mediaAdapter.pause();
                setPlaying(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, subtitles, mediaAdapter]);

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
                jumpToSubtitle={props.jumpToSubtitle}
                onSeek={handleSeekToSubtitle}
                onCopy={handleCopy} />
            {audioFile ? <audio ref={audioRef} src={props.api.streamingUrl(audioFile)} /> : null}
        </div>
    );
}