import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { v4 as uuidv4 } from 'uuid';
import BroadcastChannelVideoProtocol from '../services/BroadcastChannelVideoProtocol';
import ChromeTabVideoProtocol from '../services/ChromeTabVideoProtocol';
import Clock from '../services/Clock';
import Controls from './Controls';
import Grid from '@material-ui/core/Grid';
import MediaAdapter from '../services/MediaAdapter';
import SubtitlePlayer from './SubtitlePlayer';
import VideoChannel from '../services/VideoChannel';

const useStyles = makeStyles({
    root: {
        height: 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden'
    },
    container: {
        width: "100%",
        height: "100%"
    },
    videoFrame: {
        width: '100%',
        height: '100%',
        border: 0
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
    const {subtitleReader, settingsProvider, extension, offsetRef, videoFrameRef, drawerOpen, tab, availableTabs, onError, onUnloadVideo, onCopy, onLoaded, onTabSelected, disableKeyEvents} = props;
    const {subtitleFile, audioFile, audioFileUrl, videoFile, videoFileUrl} = props.sources;
    const [subtitles, setSubtitles] = useState();
    const subtitlesRef = useRef();
    subtitlesRef.current = subtitles;
    const [loadingSubtitles, setLoadingSubtitles] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState(0);
    const playingRef = useRef();
    playingRef.current = playing;
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState();
    const [offset, setOffset] = useState(0);
    const [channelId, setChannelId] = useState();
    const [videoPopOut, setVideoPopOut] = useState(false);
    const [hideSubtitlePlayer, setHideSubtitlePlayer] = useState(false);
    const hideSubtitlePlayerRef = useRef();
    hideSubtitlePlayerRef.current = hideSubtitlePlayer;
    const [condensedModeEnabled, setCondensedModeEnabled] = useState(false);
    const condensedModeEnabledRef = useRef();
    condensedModeEnabledRef.current = condensedModeEnabled;
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
    const lengthRef = useRef(0);
    lengthRef.current = trackLength(audioRef, videoRef, subtitles, true);

    const seek = useCallback(async (progress, clock, forwardToMedia) => {
        const time = progress * lengthRef.current;
        clock.setTime(time);
        forceUpdate();

        if (forwardToMedia) {
            await mediaAdapter.seek(time / 1000);
        }
    }, [forceUpdate, mediaAdapter]);

    const applyOffset = useCallback((offset, forwardToVideo) => {
        setOffset(offset);

        if (offsetRef) {
            offsetRef.current = offset;
        }

        setSubtitles((subtitles) => {
            if (!subtitles) {
                return;
            }

            const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end + offset : 0;

            const newSubtitles = subtitles.map(s => ({
                text: s.text,
                start: s.originalStart + offset,
                originalStart: s.originalStart,
                end: s.originalEnd + offset,
                originalEnd: s.originalEnd,
                displayTime: timeDuration(s.originalStart + offset, length)
            }));

            if (forwardToVideo) {
                videoRef.current?.subtitles(newSubtitles, subtitleFile?.name);
            }

            return newSubtitles;
        });
    }, [subtitleFile, offsetRef]);

    useEffect(() => {
        let channel = null;
        let channelClosed = false;

        async function init() {
            videoRef.current?.close();
            videoRef.current = null;
            clock.setTime(0);
            clock.stop();
            setPlaying(false);
            setAudioTracks(null);
            setSelectedAudioTrack(null);
            setOffset(0);
            setCondensedModeEnabled(false);
            audioRef.current.currentTime = 0;
            audioRef.current.pause();

            let subtitles;

            if (subtitleFile) {
                setLoadingSubtitles(true);

                try {
                    const nodes = await subtitleReader.subtitles(subtitleFile);
                    const length = nodes.length > 0 ? nodes[nodes.length - 1].end : 0;
                    subtitles = nodes.map((s) => ({
                        text: s.text,
                        start: s.start,
                        originalStart: s.start,
                        end: s.end,
                        originalEnd: s.end,
                        displayTime: timeDuration(s.start, length)
                    }));

                    setSubtitles(subtitles);
                    setLastJumpToTopTimestamp(Date.now());
                } catch (e) {
                    onError(e.message);
                } finally {
                    setLoadingSubtitles(false);
                }
            } else {
                subtitles = null;
            }

            if (audioFileUrl) {
                await mediaAdapter.onReady();
                forceUpdate();
            } else if (videoFileUrl || tab) {
                if (channelClosed) {
                    return;
                }

                if (videoFileUrl) {
                    const channelId = uuidv4();
                    channel = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
                    setChannelId(channelId);
                } else if (tab) {
                    channel = new VideoChannel(new ChromeTabVideoProtocol(tab.id, tab.src, extension));
                    channel.init();
                }

                videoRef.current = channel;
                let subscribed = false;

                channel.onExit(() => onUnloadVideo(videoFileUrl));
                channel.onPopOutToggle(() => setVideoPopOut(popOut => !popOut));
                channel.onHideSubtitlePlayerToggle(() => {
                    setHideSubtitlePlayer(hidden => {
                        channel.hideSubtitlePlayerToggle(!hidden);
                        return !hidden;
                    });
                });
                channel.onReady((paused) => {
                    lengthRef.current = trackLength(audioRef, videoRef, subtitlesRef.current);
                    channel.ready(lengthRef.current);

                    if (subtitlesRef.current) {
                        channel.subtitleSettings(settingsProvider.subtitleSettings);
                        channel.subtitles(subtitlesRef.current, subtitleFile?.name);
                    }

                    channel.condensedModeToggle(condensedModeEnabledRef.current);
                    channel.hideSubtitlePlayerToggle(hideSubtitlePlayerRef.current);

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

                    if (!subscribed) {
                        channel.onPlay((forwardToMedia) => play(clock, mediaAdapter, forwardToMedia));
                        channel.onPause((forwardToMedia) => pause(clock, mediaAdapter, forwardToMedia));
                        channel.onOffset((offset) => applyOffset(Math.max(-lengthRef.current ?? 0, offset), false));
                        channel.onCopy((subtitle, audio, image) => onCopy(
                            subtitle,
                            audioFile,
                            videoFile,
                            subtitleFile,
                            channel.selectedAudioTrack,
                            audio,
                            image
                        ));
                        channel.onCondensedModeToggle(() => setCondensedModeEnabled(enabled => {
                            const newValue = !enabled;
                            channel.condensedModeToggle(newValue);
                            return newValue;
                        }));
                        channel.onCurrentTime(async (currentTime, forwardToMedia) => {
                            const progress = currentTime * 1000 / lengthRef.current;

                            if (playingRef.current) {
                                clock.stop();
                            }

                            await seek(progress, clock, forwardToMedia);

                            if (playingRef.current) {
                                clock.start();
                            }
                        });
                        channel.onAudioTrackSelected(async (id) => {
                            if (playingRef.current) {
                                clock.stop();
                            }

                            await mediaAdapter.onReady();
                            if (playingRef.current) {
                                clock.start();
                            }

                            setSelectedAudioTrack(id);
                        });

                        subscribed = true;
                    }
                });
            }
        }

        init().then(() => onLoaded());

        return () => {
            channel?.close();
            channelClosed = true;
        };
    }, [subtitleReader, extension, settingsProvider, clock, mediaAdapter, seek, onLoaded, onError, onUnloadVideo, onCopy, subtitleFile, audioFile, audioFileUrl, videoFile, videoFileUrl, tab, forceUpdate, videoFrameRef, applyOffset]);

    useEffect(() => {
        if (!condensedModeEnabled) {
            return;
        }

        if (!subtitles || subtitles.length === 0) {
            return;
        }

        let seeking = false;
        let expectedSeekTime = 1000;

        const interval = setInterval(async () => {
            const length = lengthRef.current;

            if (!length) {
                return;
            }

            const progress = clock.progress(length);

            let currentOrNextIndex = 0;
            let currentIndex = -1;

            for (let i = subtitles.length - 1; i >= 0; --i) {
                const s = subtitles[i];
                const start = s.start / length;
                const end = s.end / length;

                if (progress >= start) {
                    if (progress < end) {
                        currentIndex = i;
                        currentOrNextIndex = i;
                    } else {
                        currentOrNextIndex = Math.min(subtitles.length - 1, i + 1);
                    }

                    break;
                }
            }

            if (currentIndex !== currentOrNextIndex) {
                const nextSubtitle = subtitles[currentOrNextIndex];

                if (nextSubtitle.start - progress * length < expectedSeekTime + 500) {
                    return;
                }

                if (playingRef.current) {
                    clock.stop();
                }

                if (!seeking) {
                    seeking = true;
                    const t0 = Date.now();
                    await seek(nextSubtitle.start / length, clock, true);
                    expectedSeekTime = Date.now() - t0;
                    seeking = false;
                }

                if (playingRef.current) {
                    clock.start();
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [subtitles, condensedModeEnabled, clock, seek]);

    useEffect(() => {
        if (videoPopOut && channelId && videoFileUrl) {
            window.open(
                process.env.PUBLIC_URL + '/?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=true',
                'asbplayer-video-' + videoFileUrl,
                "resizable,width=800,height=450"
            );
        }

        setLastJumpToTopTimestamp(Date.now());
    }, [videoPopOut, channelId, videoFileUrl, videoFrameRef]);

    function play(clock, mediaAdapter, forwardToMedia) {
        setPlaying(true);
        clock.start();

        if (forwardToMedia) {
            mediaAdapter.play();
        }
    };

    function pause(clock, mediaAdapter, forwardToMedia) {
        setPlaying(false);
        clock.stop();

        if (forwardToMedia) {
            mediaAdapter.pause();
        }
    };

    const handlePlay = useCallback(() => play(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handlePause = useCallback(() => pause(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handleSeek = useCallback(async (progress) => {
        if (playingRef.current) {
            clock.stop();
        }

        await seek(progress, clock, true);

        if (playingRef.current) {
            clock.start();
        }
    }, [clock, seek]);

    const handleSeekToSubtitle = useCallback(async (progress, shouldPlay) => {
        if (!shouldPlay) {
            pause(clock, mediaAdapter, true);
        }

        if (playingRef.current) {
            clock.stop();
        }

        await seek(progress, clock, true);

        if (shouldPlay && !playingRef.current) {
            // play method will start the clock again
            play(clock, mediaAdapter, true);
        }
    }, [clock, seek, mediaAdapter]);

    const handleCopy = useCallback((subtitle, audioBase64) => {
        onCopy(
            subtitle,
            audioFile,
            videoFile,
            subtitleFile,
            selectedAudioTrack
        );
    }, [onCopy, audioFile, videoFile, subtitleFile, selectedAudioTrack]);

    const handleMouseMove = useCallback((e) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    }, []);

    const handleAudioTrackSelected = useCallback(async (id) => {
        if (videoRef.current) {
            videoRef.current.audioTrackSelected(id);
        }

        pause(clock, mediaAdapter, true);

        await seek(0, clock, true);

        if (playingRef.current) {
            play(clock, mediaAdapter, true);
        }
    }, [clock, mediaAdapter, seek]);

    const handleOffsetChange = useCallback((offset) => {
        applyOffset(Math.max(-lengthRef.current ?? 0, offset), true);
    }, [applyOffset]);

    const handleVolumeChange = useCallback((v) => {
        if (audioRef.current) {
            audioRef.current.volume = v;
        }
    }, []);

    const handleCondensedModeToggle = useCallback(() =>  setCondensedModeEnabled(v => !v), []);

    useEffect(() => {
        const interval = setInterval(() => {
            const length = lengthRef.current;
            const progress = clock.progress(length);

            if (progress >= 1) {
                clock.setTime(0);
                clock.stop();
                mediaAdapter.pause();
                setPlaying(false);
                setLastJumpToTopTimestamp(Date.now());
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, subtitles, mediaAdapter]);

    const length = lengthRef.current;
    const loaded = audioFileUrl || videoFileUrl || subtitles;
    const videoInWindow = loaded && videoFileUrl && channelId && !videoPopOut;

    return (
        <div
            onMouseMove={handleMouseMove}
            className={classes.root}
        >
            <Grid
                container
                direction="row"
                wrap="nowrap"
                className={classes.container}
            >
                {videoInWindow && (
                    <Grid item style={{flexGrow: 1, minWidth: 600}}>
                        <iframe
                            ref={videoFrameRef}
                            className={classes.videoFrame}
                            src={process.env.PUBLIC_URL + '/?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=false'}
                            title="asbplayer"
                        />
                    </Grid>
                )}
                {(!videoInWindow || subtitles?.length > 0) && (
                    <Grid item style={{flexGrow: videoInWindow ? 0 : 1, width: videoInWindow && hideSubtitlePlayer ? 0 : 'auto'}}>
                        {loaded && !(videoFileUrl && !videoPopOut) && (
                            <Controls
                                mousePositionRef={mousePositionRef}
                                playing={playing}
                                clock={clock}
                                length={length}
                                displayLength={trackLength(audioRef, videoRef, subtitles, false)}
                                audioTracks={audioTracks}
                                selectedAudioTrack={selectedAudioTrack}
                                tabs={!videoFileUrl && !audioFileUrl && availableTabs}
                                selectedTab={tab}
                                audioFile={audioFile?.name}
                                videoFile={videoFile?.name}
                                offsetEnabled={true}
                                offset={offset}
                                volumeEnabled={Boolean(audioFileUrl)}
                                condensedModeToggleEnabled={Boolean(audioFileUrl) && subtitles?.length > 0}
                                condensedModeEnabled={condensedModeEnabled}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onSeek={handleSeek}
                                onAudioTrackSelected={handleAudioTrackSelected}
                                onTabSelected={onTabSelected}
                                onUnloadAudio={() => props.onUnloadAudio(audioFileUrl)}
                                onUnloadVideo={() => props.onUnloadVideo(videoFileUrl)}
                                onOffsetChange={handleOffsetChange}
                                onVolumeChange={handleVolumeChange}
                                onCondensedModeToggle={handleCondensedModeToggle}
                                disableKeyEvents={disableKeyEvents}
                                settingsProvider={settingsProvider}
                            />
                        )}
                        <SubtitlePlayer
                            playing={playing}
                            subtitles={subtitles}
                            clock={clock}
                            length={length}
                            jumpToSubtitle={props.jumpToSubtitle}
                            drawerOpen={drawerOpen}
                            compressed={videoFileUrl && !videoPopOut}
                            loading={loadingSubtitles}
                            displayHelp={audioFile?.name || (videoPopOut && videoFile?.name)}
                            disableKeyEvents={disableKeyEvents}
                            lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                            hidden={videoInWindow && hideSubtitlePlayer}
                            onSeek={handleSeekToSubtitle}
                            onCopy={handleCopy}
                            onOffsetChange={handleOffsetChange}
                        />
                    </Grid>
                )}
            </Grid>
            <audio ref={audioRef} src={audioFileUrl} />
        </div>
    );
}