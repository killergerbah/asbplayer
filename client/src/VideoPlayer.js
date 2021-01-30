import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Clock from './Clock';
import Controls from './Controls';
import PlayerChannel from './PlayerChannel';

const useStyles = makeStyles({
    root: {
        backgroundColor: 'black',
        width: '100%',
        height: '100vh',
        overflow: 'hidden'
    },
    video: {
        objectFit: "cover",
        position: "absolute",
        width: "auto",
        height: "100%"
    }
});

export default function VideoPlayer(props) {
    const classes = useStyles();
    const { videoFile, channel } = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            videoFile: params.get('video'),
            channel: params.get('channel')
        };
    }, []);
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playing, setPlaying] = useState(false);
    const playingRef = useRef();
    playingRef.current = playing;
    const [length, setLength] = useState(0);
    const [audioTracks, setAudioTracks] = useState(null);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
    const clock = useMemo(() => new Clock(), []);
    const mousePositionRef = useRef({x:0, y:0});
    const videoRef = useRef(null);
    const videoRefCallback = useCallback(element => {
        if (element) {
            videoRef.current = element;

            if (element.duration) {
                playerChannel.ready(element.duration);
            } else {
                element.onloadeddata = (event) => {
                    // https://stackoverflow.com/questions/10385768/how-do-you-resize-a-browser-window-so-that-the-inner-width-is-a-specific-value
                    if (window.outerWidth) {
                        const desiredWidth = element.videoWidth + (window.outerWidth - window.innerWidth);
                        const desiredHeight = element.videoHeight + (window.outerHeight - window.innerHeight);
                        const resizeRatio = Math.max(1, Math.min(window.screen.width / desiredWidth, window.screen.height / desiredHeight));

                        window.resizeTo(
                            resizeRatio * desiredWidth,
                            resizeRatio * desiredHeight
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
                    playerChannel.ready(element.duration, tracks, selectedTrack);
                };

                element.oncanplay = (event) => {
                    playerChannel.readyState(4);

                    if (playingRef.current) {
                        clock.start();
                    }
                };
            }
        }
    }, [setAudioTracks, setSelectedAudioTrack, clock, playerChannel]);

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

        return () => {
            playerChannel.close();
        }
    }, [clock, setPlaying, playerChannel]);

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
        playerChannel.pause();
        playerChannel.audioTrackSelected(id);
        selectAudioTrack(id);
        setSelectedAudioTrack(id);
    }, [playerChannel]);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            <video
                preload="auto"
                nocontrols={1}
                className={classes.video}
                ref={videoRefCallback}
                src={props.api.streamingUrl(videoFile)} />
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
        </div>
    );
}