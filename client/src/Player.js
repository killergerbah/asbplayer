import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import BroadcastChannelVideoProtocol from './BroadcastChannelVideoProtocol';
import ChromeTabVideoProtocol from './ChromeTabVideoProtocol';
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
    const [subtitles, setSubtitles] = useState();
    const [playing, setPlaying] = useState(false);
    const playingRef = useRef();
    playingRef.current = playing;
    const [loaded, setLoaded] = useState(false);
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef();
    const videoRef = useRef();
    const mediaAdapter = useMemo(() => new MediaAdapter(audioRef, videoRef), []);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const location = useLocation();
    const [subtitleFile, setSubtitleFile] = useState();
    const [audioFile, setAudioFile] = useState();
    const [videoFile, setVideoFile] = useState();
    const [fileName, setFileName] = useState();
    const [tab, setTab] = useState();
    const [availableTabs, setAvailableTabs] = useState([]);

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
    }, [location, mediaAdapter, clock]);

    const seek = useCallback((progress, clock, length, echo, callback) => {
        const time = progress * length;
        clock.setTime(time);
        forceUpdate();

        if (echo) {
            mediaAdapter.seek(time / 1000).then((v) => callback());
        } else {
            callback();
        }
    }, [forceUpdate, mediaAdapter]);

    useEffect(() => {
        const subtitlePromise = new Promise((resolve, reject) => {
            setSubtitles(null);
            if (subtitleFile) {
                props.api.subtitles(subtitleFile)
                    .then(res => {
                        const length = res.subtitles.length > 0
                            ? res.subtitles[res.subtitles.length - 1].end - res.subtitles[0].start
                            : 0;
                        const mappedSubtitles = res.subtitles.map((s) => {
                            return {text: s.text, start: s.start, end: s.end, displayTime: displayTime(s.start, length)};
                        });
                        resolve(mappedSubtitles);
                    })
                    .catch(reject);
            } else {
                resolve([]);
            }
        });

        const videoPromise = new Promise((resolve, reject) => {
            if (videoFile) {
                const channelId = String(Date.now());
                videoRef.current = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
                videoRef.current.onReady((paused) => {
                    resolve(paused);
                });

                window.open(
                    '/?video=' + encodeURIComponent(videoFile) + '&channel=' + channelId,
                    'asbplayer-video-' + videoFile,
                    "resizable,width=800,height=450");
            } else if (tab) {
                videoRef.current?.close();
                videoRef.current = new VideoChannel(new ChromeTabVideoProtocol(tab.id, props.extension));
                videoRef.current.init();
                videoRef.current.onReady((paused) => {
                    resolve(paused);
                });
            } else {
                resolve(true);
            }
        });

        Promise.all([subtitlePromise, videoPromise])
            .then(v => {
                const mappedSubtitles = v[0];
                const paused = v[1];

                if (videoRef.current) {
                    videoRef.current.ready(trackLength(audioRef, videoRef, mappedSubtitles));

                    videoRef.current.onPlay((echo) => {
                        play(clock, mediaAdapter, echo);
                    });

                    videoRef.current.onPause((echo) => {
                        pause(clock, mediaAdapter, echo);
                    });

                    videoRef.current.onCurrentTime((currentTime, echo) => {
                        const length = trackLength(audioRef, videoRef, mappedSubtitles);
                        const progress = currentTime * 1000 / length;

                        if (playingRef.current) {
                            clock.stop();
                        }

                        seek(progress, clock, length, echo, (v) => {
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

                    clock.setTime(videoRef.current.currentTime * 1000);

                    if (paused) {
                        clock.stop();
                    } else {
                        clock.start();
                    }

                    setPlaying(!paused);
                }

                setSubtitles(mappedSubtitles);
                setLoaded(true);
            })
            .catch(props.onError);

        return () => {
            if (videoRef.current) {
                videoRef.current.close();
                videoRef.current = null;
            }
        }
    }, [props.api, props.extension, props.onError, subtitleFile, videoFile, tab, clock, seek, mediaAdapter]);

    function play(clock, mediaAdapter, echo) {
        setPlaying(true);
        clock.start();

        if (echo) {
            mediaAdapter.play();
        }
    };

    function pause(clock, mediaAdapter, echo) {
        setPlaying(false);
        clock.stop();

        if (echo) {
            mediaAdapter.pause();
        }
    };

    const handlePlay = useCallback(() => {
        play(clock, mediaAdapter, true);
    }, [clock, mediaAdapter]);

    const handlePause = useCallback(() => {
        pause(clock, mediaAdapter, true);
    }, [clock, mediaAdapter]);

    const handleSeek = useCallback((progress) => {
        const length = trackLength(audioRef, videoRef, subtitles);

        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, length, true, () => {
            if (playingRef.current) {
                clock.start();
            }
        });
    }, [clock, subtitles, seek]);

    const handleSeekToSubtitle = useCallback((progress, shouldPlay) => {
        const length = trackLength(audioRef, videoRef, subtitles);

        if (!shouldPlay) {
            pause(clock, mediaAdapter, true);
        }

        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, length, true, () => {
            if (shouldPlay && !playingRef.current) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
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

        pause(clock, mediaAdapter, true);

        seek(0, clock, length, true, () => {
            if (playingRef.current) {
                play(clock, mediaAdapter, true);
            }
        });
    }, [clock, mediaAdapter, subtitles, seek]);

    const handleTabSelected = useCallback((id) => {
        const tab = availableTabs.filter(t => t.id === id)[0];
        setTab(tab);
    }, [availableTabs]);

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

    useEffect(() => {
        const interval = setInterval(() => {
            if (props.extension.tabs.length !== availableTabs.length) {
                setAvailableTabs(props.extension.tabs);
            } else {
                let update = false;

                for (let t1 of availableTabs) {
                    for (let t2 of props.extension.tabs) {
                        if (t1.id !== t2.id
                            || t1.title !== t2.title
                            || t1.src !== t2.src) {
                            update = true;
                            break;
                        }
                    }
                }

                if (update) {
                    setAvailableTabs(props.extension.tabs);
                }
            }

            let selectedTabMissing = tab && props.extension.tabs.filter(t => t.id === tab.id && t.src === tab.src).length === 0;

            if (selectedTabMissing) {
                setTab(null);
                props.onError('Lost connection with tab ' + tab.id + ' ' + tab.title);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [availableTabs, tab, props])

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
                tabs={!videoFile && !audioFile && availableTabs}
                selectedTab={tab && tab.id}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected}
                onTabSelected={handleTabSelected}
            />
            <SubtitlePlayer
                playing={playing}
                subtitles={subtitles}
                clock={clock}
                length={length}
                jumpToSubtitle={props.jumpToSubtitle}
                onSeek={handleSeekToSubtitle}
                onCopy={handleCopy}
            />
            {audioFile && (<audio ref={audioRef} src={props.api.streamingUrl(audioFile)} />)}
        </div>
    );
}