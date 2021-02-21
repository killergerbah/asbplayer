import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { arrayEquals, useWindowSize } from './Util';
import Clock from './Clock';
import Controls from './Controls';
import PlayerChannel from './PlayerChannel';

const useStyles = makeStyles({
    root: {
        position: 'relative',
        backgroundColor: 'black',
        height: '100vh',
        overflow: 'hidden',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
    },
    video: {
        margin: "auto"
    },
    subtitle: {
        position: 'absolute',
        paddingLeft: 20,
        paddingRight: 20,
        width: '100%',
        bottom: 100,
        textAlign: 'center',
        color: 'white',
        textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black',
        fontSize: 36
    }
});

function notifyReady(element, playerChannel, setAudioTracks, setSelectedAudioTrack) {
    if (window.outerWidth && element.videoWidth > 0 && element.videoHeight > 0) {
        const availWidth = window.screen.availWidth - (window.outerWidth - window.innerWidth);
        const availHeight = window.screen.availHeight - (window.outerHeight - window.innerHeight);
        const resizeRatio = Math.min(1, Math.min(availWidth / element.videoWidth, availHeight / element.videoHeight));

        window.resizeTo(
            resizeRatio * element.videoWidth + (window.outerWidth - window.innerWidth),
            resizeRatio * element.videoHeight + (window.outerHeight - window.innerHeight)
        );
    }

    let tracks;
    let selectedTrack;

    if (element.audioTracks) {
        tracks = [];

        for (let t of element.audioTracks) {
            tracks.push({
                id: t.id,
                label: t.label,
                language: t.language
            });

            if (t.enabled) {
                selectedTrack = t.id;
            }
        }
    } else {
        tracks = null;
        selectedTrack = null;
    }

    setAudioTracks(tracks);
    setSelectedAudioTrack(selectedTrack);
    playerChannel.ready(element.duration, element.paused, tracks, selectedTrack);
}

function errorMessage(element) {
    let error;
    switch (element.error.code) {
        case 1:
            error = "Aborted";
            break;
        case 2:
            error = "Network error";
            break;
        case 3:
            error = "Decoding error";
            break;
        case 4:
            error = "Source not supported";
            break;
        default:
            error = "Unknown error";
            break;
    }

    return error + ": " + (element.error.message || "<details missing>");
}

function useFullscreen() {
    const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

    useEffect(() => {
        const listener = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', listener);

        return () => document.removeEventListener('fullscreenchange', listener);
    }, []);

    return fullscreen;
}

export default function VideoPlayer(props) {
    const classes = useStyles();
    const {videoFile, channel, popOut, onError} = props;
    const poppingInRef = useRef();
    const videoRef = useRef();
    const [windowWidth, windowHeight] = useWindowSize(true);
    if (videoRef.current) {
        videoRef.current.width = windowWidth;
        videoRef.current.height = windowHeight;
    }
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playing, setPlaying] = useState(false);
    const fullscreen = useFullscreen();
    const playingRef = useRef();
    playingRef.current = playing;
    const [length, setLength] = useState(0);
    const [offset, setOffset] = useState(0);
    const [audioTracks, setAudioTracks] = useState();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState();
    const [subtitles, setSubtitles] = useState([]);
    const [showSubtitles, setShowSubtitles] = useState([]);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const showSubtitlesRef = useRef([]);
    showSubtitlesRef.current = showSubtitles;
    const clock = useMemo(() => new Clock(), []);
    const mousePositionRef = useRef({x:0, y:0});
    const containerRef = useRef();
    const videoRefCallback = useCallback(element => {
        if (element) {
            videoRef.current = element;

            if (element.readyState === 4) {
                notifyReady(element, playerChannel, setAudioTracks, setSelectedAudioTrack);
            } else {
                element.onloadeddata = (event) => {
                    notifyReady(element, playerChannel, setAudioTracks, setSelectedAudioTrack);
                };
            }

            element.oncanplay = (event) => {
                playerChannel.readyState(4);

                if (playingRef.current) {
                    clock.start();
                }
            };

            element.onerror = (event) => {
                onError(errorMessage(element));
            };
        }
    }, [clock, playerChannel, onError]);

    function selectAudioTrack(id) {
        for (let t of videoRef.current.audioTracks) {
            if (t.id === id) {
                t.enabled = true;
            } else {
                t.enabled = false;
            }
        }
    }

    useEffect(() => {
        playerChannel.onReady((duration) => {
            setLength(duration);
        });

        playerChannel.onPlay(() => {
            videoRef.current.play();
            clock.start();
            setPlaying(true);
        });

        playerChannel.onPause(() => {
            videoRef.current.pause();
            clock.stop();
            setPlaying(false);
        });

        playerChannel.onCurrentTime((currentTime) => {
            if (videoRef.current) {
                videoRef.current.currentTime = currentTime;
            }

            if (videoRef.current?.readyState === 4) {
                playerChannel.readyState(4);
            }

            clock.stop();
            clock.setTime(currentTime * 1000);
        });

        playerChannel.onAudioTrackSelected((id) => {
            selectAudioTrack(id);
            playerChannel.audioTrackSelected(id);
        });

        playerChannel.onClose(() => {
            playerChannel.close();
            window.close();
        });

        playerChannel.onSubtitles((subtitles) => {
            setSubtitles(subtitles);
            if (subtitles && subtitles.length > 0) {
                const s = subtitles[0];
                const offset = s.start - s.originalStart;
                setOffset(offset);
            }
        });

        window.onbeforeunload = (e) => {
            if (!poppingInRef.current) {
                playerChannel.close();
            }
        };

        return () => {
            playerChannel.close();
        }
    }, [clock, playerChannel]);

    const handlePlay = useCallback(() => {
        if (videoRef.current) {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handlePause = useCallback(() => {
        playerChannel.pause();
    }, [playerChannel]);

    const handleSeek = useCallback((progress) => {
        if (playingRef.current) {
            clock.stop();
        }

        const time = progress * length;
        playerChannel.currentTime = time / 1000;
    }, [length, clock, playerChannel]);

    function handleMouseMove(e) {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    };

    const handleAudioTrackSelected = useCallback((id) => {
        if (playingRef.current) {
            clock.stop();
            playerChannel.pause();
        }

        selectAudioTrack(id);
        setSelectedAudioTrack(id);
        playerChannel.currentTime = 0;
        playerChannel.audioTrackSelected(id);
    }, [playerChannel, clock]);

    useEffect(() => {
        if (!subtitles || subtitles.length === 0) {
            return;
        }

        const interval = setInterval(() => {
            const now = 1000 * videoRef.current.currentTime;
            const showSubtitles = [];

            for (let i = 0; i < subtitles.length; ++i) {
                const s = subtitles[i];

                if (now >= s.start && now < s.end) {
                    showSubtitles.push({...s, index: i});
                }

                if (now < s.start) {
                    break;
                }
            }

            if (!arrayEquals(showSubtitles, showSubtitlesRef.current, (s1, s2) => s1.index === s2.index)) {
                setShowSubtitles(showSubtitles);
            }
        }, 10)

        return () => clearTimeout(interval);
    }, [subtitles])

    const handleSubtitlesToggle = useCallback(() => {
        setSubtitlesEnabled(subtitlesEnabled => !subtitlesEnabled);
    }, []);

    const handleFullscreenToggle = useCallback(() => {
        if (fullscreen) {
            document.exitFullscreen();
        } else {
            containerRef.current?.requestFullscreen();
        }
    }, [fullscreen]);

    const handleVolumeChange = useCallback((v) => {
        if (videoRef.current) {
            videoRef.current.volume = v;
        }
    }, []);

    const handleOffsetChange = useCallback((offset) => {
        playerChannel.offset(offset);
    }, [playerChannel]);

    const handlePopOutToggle = useCallback(() => {
        playerChannel.popOutToggle();
        if (popOut) {
            poppingInRef.current = true;
            window.close();
        }
    }, [playerChannel, popOut]);

    const handleClose = useCallback(() => {
        playerChannel.close();
        window.close();
    }, [playerChannel]);

    return (
        <div ref={containerRef} onMouseMove={handleMouseMove} className={classes.root}>
            <video
                preload="auto"
                nocontrols={1}
                className={classes.video}
                ref={videoRefCallback}
                src={videoFile} />
            {subtitlesEnabled && (
                <div className={classes.subtitle}>
                    {showSubtitles.map(s => (<React.Fragment key={s.index}>{s.text}<br/></React.Fragment>))}
                </div>
            )}
            <Controls
                mousePositionRef={mousePositionRef}
                playing={playing}
                clock={clock}
                length={length}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedAudioTrack}
                subtitlesToggle={subtitles && subtitles.length > 0}
                subtitlesEnabled={subtitlesEnabled}
                offsetEnabled={true}
                offset={offset}
                fullscreenEnabled={true}
                fullscreen={fullscreen}
                closeEnabled={!popOut}
                popOut={popOut}
                volumeEnabled={true}
                popOutEnabled={true}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected}
                onSubtitlesToggle={handleSubtitlesToggle}
                onFullscreenToggle={handleFullscreenToggle}
                onVolumeChange={handleVolumeChange}
                onOffsetChange={handleOffsetChange}
                onPopOutToggle={handlePopOutToggle}
                onClose={handleClose}
            />
        </div>
    );
}