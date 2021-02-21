import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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

function timeDuration(milliseconds, totalMilliseconds) {
    if (milliseconds < 0) {
        return timeDuration(0, totalMilliseconds);
    }

    const ms = milliseconds % 1000;
    milliseconds = (milliseconds - ms) / 1000;
    const secs = milliseconds % 60;
    milliseconds = (milliseconds - secs) / 60;
    const mins = milliseconds % 60;

    if (totalMilliseconds >= 3600000) {
        const hrs = (milliseconds - mins) / 60;
        return pad(hrs) + ':' + pad(mins) + ':' + pad(secs) + '.' + padEnd(ms);
    }

    return pad(mins) + ':' + pad(secs) + '.' + padEnd(ms);
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function padEnd(n) {
    return String(n).padEnd(3, '0');
}

function trackLength(audioRef, videoRef, subtitles, useOffset) {
    let subtitlesLength;
    if (subtitles && subtitles.length > 0) {
        if (useOffset) {
            subtitlesLength = subtitles[subtitles.length - 1].end;
        } else {
            subtitlesLength = subtitles[subtitles.length - 1].originalEnd;
        }
    } else {
        subtitlesLength = 0;
    }

    const audioLength = audioRef.current && audioRef.current.duration
        ? 1000 * audioRef.current.duration
        : 0;

    const videoLength = videoRef.current && videoRef.current.duration
        ? 1000 * videoRef.current.duration
        : 0;

    return Math.max(videoLength, Math.max(subtitlesLength, audioLength));
}

export default function Player(props) {
    const {api, extension, offsetRef, onError, onUnloadVideo} = props;
    const {subtitleFile, audioFile, audioFileUrl, videoFile, videoFileUrl} = props.sources;
    const [tab, setTab] = useState();
    const [subtitles, setSubtitles] = useState();
    const [playing, setPlaying] = useState(false);
    const playingRef = useRef();
    playingRef.current = playing;
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState();
    const [offsetValue, setOffsetValue] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef();
    const videoRef = useRef();
    const mediaAdapter = useMemo(() => {
        if (audioFileUrl) {
            return new MediaAdapter(audioRef);
        } else if (videoFileUrl || tab) {
            return new MediaAdapter(videoRef);
        }

        return new MediaAdapter({});
    }, [audioFileUrl, videoFileUrl, tab]);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const [availableTabs, setAvailableTabs] = useState([]);
    const lengthRef = useRef(0);
    lengthRef.current = trackLength(audioRef, videoRef, subtitles, true);

    const seek = useCallback((progress, clock, echo, callback) => {
        const time = progress * lengthRef.current;
        clock.setTime(time);
        forceUpdate();

        if (echo) {
            mediaAdapter.seek(time / 1000).then((v) => callback());
        } else {
            callback();
        }
    }, [forceUpdate, mediaAdapter]);

    useEffect(() => {
        videoRef.current?.close();
        videoRef.current = null;
        clock.setTime(0);
        clock.stop();
        setPlaying(false);
        setAudioTracks(null);
        setSelectedAudioTrack(null);
        setOffsetValue(null);
        audioRef.current.currentTime = 0;
        audioRef.current.pause();

        let subtitlesPromise;

        if (subtitleFile) {
            subtitlesPromise = api.subtitles(subtitleFile)
                .then(nodes => {
                    const length = nodes.length > 0 ? nodes[nodes.length - 1].end : 0;

                    const subtitles = nodes.map((s) => {
                        return {
                            text: s.text,
                            start: s.start,
                            originalStart: s.start,
                            end: s.end,
                            originalEnd: s.end,
                            displayTime: timeDuration(s.start, length)};
                    });

                    setSubtitles(subtitles);
                    return subtitles;
                })
                .catch(e => onError(e));
        } else {
            subtitlesPromise = new Promise((resolve, reject) => resolve());
        }

        if (audioFileUrl) {
            mediaAdapter.onReady().then(() => forceUpdate());
        } else if (videoFileUrl || tab) {
            subtitlesPromise.then(subtitles => {
                let channel;

                if (videoFileUrl) {
                    const channelId = String(Date.now());
                    channel = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
                    window.open(
                        process.env.PUBLIC_URL + '/?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId,
                        'asbplayer-video-' + videoFileUrl,
                        "resizable,width=800,height=450"
                    );
                } else if (tab) {
                    channel = new VideoChannel(new ChromeTabVideoProtocol(tab.id, extension));
                    channel.init();
                }

                videoRef.current = channel;

                channel.onReady((paused) => {
                    lengthRef.current = trackLength(audioRef, videoRef, subtitles);
                    channel.ready(lengthRef.current);

                    if (subtitles) {
                        channel.subtitles(subtitles);
                    }

                    channel.onPlay((echo) => {
                        play(clock, mediaAdapter, echo);
                    });

                    channel.onPause((echo) => {
                        pause(clock, mediaAdapter, echo);
                    });

                    channel.onCurrentTime((currentTime, echo) => {
                        const progress = currentTime * 1000 / lengthRef.current;

                        if (playingRef.current) {
                            clock.stop();
                        }

                        seek(progress, clock, echo, (v) => {
                            if (playingRef.current) {
                                clock.start();
                            }
                        });
                    });

                    channel.onAudioTrackSelected((id) => {
                        if (playingRef.current) {
                            clock.stop();
                        }

                        mediaAdapter.onReady()
                            .then(() => {
                                if (playingRef.current) {
                                    clock.start();
                                }
                            });

                        setSelectedAudioTrack(id);
                    });

                    channel.onExit(() => {
                        onUnloadVideo(videoFileUrl);
                    });

                    if (channel.audioTracks && channel.audioTracks.length > 1) {
                        setAudioTracks(videoRef.current.audioTracks);
                        setSelectedAudioTrack(videoRef.current.selectedAudioTrack);
                    } else {
                        setAudioTracks(null);
                        setSelectedAudioTrack(null);
                    }

                    clock.setTime(videoRef.current.currentTime * 1000);

                    if (paused) {
                        clock.stop();
                    } else {
                        clock.start();
                    }

                    setPlaying(!paused);
                });
            });
        }
    }, [api, extension, clock, mediaAdapter, seek, onError, onUnloadVideo, subtitleFile, audioFileUrl, videoFileUrl, tab, forceUpdate]);

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
        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, true, () => {
            if (playingRef.current) {
                clock.start();
            }
        });
    }, [clock, seek]);

    const handleSeekToSubtitle = useCallback((progress, shouldPlay) => {
        if (!shouldPlay) {
            pause(clock, mediaAdapter, true);
        }

        if (playingRef.current) {
            clock.stop();
        }

        seek(progress, clock, true, () => {
            if (shouldPlay && !playingRef.current) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
            }
        });
    }, [clock, seek, mediaAdapter]);

    const handleCopy = useCallback((subtitle) => {
        props.onCopy(
            subtitle,
            audioFile,
            videoFile,
            subtitleFile,
            selectedAudioTrack
        );
    }, [props, audioFile, videoFile, subtitleFile, selectedAudioTrack]);

    function handleMouseMove(e) {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    };

    const handleAudioTrackSelected = useCallback((id) => {
        if (videoRef.current) {
            videoRef.current.audioTrackSelected(id);
        }

        pause(clock, mediaAdapter, true);

        seek(0, clock, true, () => {
            if (playingRef.current) {
                play(clock, mediaAdapter, true);
            }
        });
    }, [clock, mediaAdapter, seek]);

    const handleTabSelected = useCallback((id) => {
        const tab = availableTabs.filter(t => t.id === id)[0];
        setTab(tab);
    }, [availableTabs]);

    const handleOffsetChange = useCallback((o) => {
        const offset = Math.max(-lengthRef.current ?? 0, o);
        const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end + offset : 0;

        const newSubtitles = subtitles.map(s => ({
            text: s.text,
            start: s.originalStart + offset,
            originalStart: s.originalStart,
            end: s.originalEnd + offset,
            originalEnd: s.originalEnd,
            displayTime: timeDuration(s.originalStart + offset, length)
        }));

        setSubtitles(newSubtitles);
        videoRef.current?.subtitles(newSubtitles);

        if (offsetRef) {
            offsetRef.current = offset;
        }

        const offsetSeconds = offset / 1000;
        const value = offsetSeconds >= 0 ? "+" + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
        setOffsetValue(value);
    }, [subtitles, offsetRef]);

    const handleVolumeChange = useCallback((v) => {
        if (audioRef.current) {
            audioRef.current.volume = v;
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const length = lengthRef.current;
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

                for (let i = 0; i < availableTabs.length; ++i) {
                    const t1 = availableTabs[i];
                    const t2 = props.extension.tabs[i];
                    if (t1.id !== t2.id
                        || t1.title !== t2.title
                        || t1.src !== t2.src) {
                        update = true;
                        break;
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
    }, [availableTabs, tab, props]);

    useEffect(() => {
        setTab(null);
    }, [audioFile, videoFile]);

    const length = lengthRef.current;
    const loaded = audioFileUrl || videoFileUrl || subtitles;

    return (
        <div
            onMouseMove={handleMouseMove}
            className={classes.root}
        >
            {loaded && (<Controls
                mousePositionRef={mousePositionRef}
                playing={playing}
                clock={clock}
                length={length}
                displayLength={trackLength(audioRef, videoRef, subtitles, false)}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedAudioTrack}
                tabs={!videoFileUrl && !audioFileUrl && availableTabs}
                selectedTab={tab && tab.id}
                audioFile={audioFile?.name}
                videoFile={videoFile?.name}
                offsetEnabled={true}
                offsetValue={offsetValue}
                volumeEnabled={Boolean(audioFileUrl)}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected}
                onTabSelected={handleTabSelected}
                onUnloadAudio={() => props.onUnloadAudio(audioFileUrl)}
                onUnloadVideo={() => props.onUnloadVideo(videoFileUrl)}
                onOffsetChange={handleOffsetChange}
                onVolumeChange={handleVolumeChange}
            />)}
            <SubtitlePlayer
                playing={playing}
                subtitles={subtitles}
                clock={clock}
                length={length}
                jumpToSubtitle={props.jumpToSubtitle}
                onSeek={handleSeekToSubtitle}
                onCopy={handleCopy}
            />
            <audio ref={audioRef} src={audioFileUrl} />
        </div>
    );
}