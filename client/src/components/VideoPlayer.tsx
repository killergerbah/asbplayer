import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { makeStyles } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/useWindowSize';
import { arrayEquals, computeStyles } from '../services/Util';
import {
    KeyBindings,
    surroundingSubtitles,
    mockSurroundingSubtitles,
    humanReadableTime,
    SubtitleModel,
    AudioTrackModel,
} from '@project/common';
import { SubtitleTextImage } from '@project/common/components';
import Alert from './Alert';
import Clock from '../services/Clock';
import Controls, { Point } from './Controls';
import PlayerChannel from '../services/PlayerChannel';
import SettingsProvider from '../services/SettingsProvider';

interface ExperimentalHTMLVideoElement extends HTMLVideoElement {
    readonly audioTracks: any;
}

const useStyles = makeStyles({
    root: {
        position: 'relative',
        backgroundColor: 'black',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        margin: 'auto',
    },
    cursorHidden: {
        cursor: 'none',
    },
    subtitleContainer: {
        position: 'absolute',
        paddingLeft: 20,
        paddingRight: 20,
        bottom: 100,
        textAlign: 'center',
    },
});

function notifyReady(
    element: ExperimentalHTMLVideoElement,
    playerChannel: PlayerChannel,
    setAudioTracks: React.Dispatch<React.SetStateAction<AudioTrackModel[] | undefined>>,
    setSelectedAudioTrack: React.Dispatch<React.SetStateAction<string | undefined>>
) {
    if (window.outerWidth && element.videoWidth > 0 && element.videoHeight > 0) {
        const availWidth = window.screen.availWidth - (window.outerWidth - window.innerWidth);
        const availHeight = window.screen.availHeight - (window.outerHeight - window.innerHeight);
        const resizeRatio = Math.min(1, Math.min(availWidth / element.videoWidth, availHeight / element.videoHeight));

        window.resizeTo(
            resizeRatio * element.videoWidth + (window.outerWidth - window.innerWidth),
            resizeRatio * element.videoHeight + (window.outerHeight - window.innerHeight)
        );
    }

    let tracks: AudioTrackModel[] | undefined;
    let selectedTrack: string | undefined;

    if (element.audioTracks) {
        tracks = [];

        for (let t of element.audioTracks) {
            tracks.push({
                id: t.id,
                label: t.label,
                language: t.language,
            });

            if (t.enabled) {
                selectedTrack = t.id;
            }
        }
    } else {
        tracks = undefined;
        selectedTrack = undefined;
    }

    setAudioTracks(tracks);
    setSelectedAudioTrack(selectedTrack);
    playerChannel.ready(element.duration, element.paused, tracks, selectedTrack);
}

function errorMessage(element: HTMLVideoElement) {
    let error;
    switch (element.error?.code) {
        case 1:
            error = 'Aborted';
            break;
        case 2:
            error = 'Network error';
            break;
        case 3:
            error = 'Decoding error';
            break;
        case 4:
            error = 'Source not supported';
            break;
        default:
            error = 'Unknown error';
            break;
    }

    return error + ': ' + (element.error?.message || '<details missing>');
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

interface Props {
    settingsProvider: SettingsProvider;
    videoFile: string;
    channel: string;
    popOut: boolean;
    onError: (error: string) => void;
}

interface IndexedSubtitleModel extends SubtitleModel {
    index: number;
}

export default function VideoPlayer(props: Props) {
    const classes = useStyles();
    const { settingsProvider, videoFile, channel, popOut, onError } = props;
    const poppingInRef = useRef<boolean>();
    const videoRef = useRef<ExperimentalHTMLVideoElement>();
    const [windowWidth, windowHeight] = useWindowSize(true);
    if (videoRef.current) {
        videoRef.current.width = windowWidth;
        videoRef.current.height = windowHeight;
    }
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playing, setPlaying] = useState<boolean>(false);
    const fullscreen = useFullscreen();
    const fullscreenRef = useRef<boolean>();
    fullscreenRef.current = fullscreen;
    const playingRef = useRef<boolean>();
    playingRef.current = playing;
    const [length, setLength] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [subtitles, setSubtitles] = useState<SubtitleModel[]>([]);
    const [showSubtitles, setShowSubtitles] = useState<IndexedSubtitleModel[]>([]);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [index: number]: boolean }>({});
    const [condensedModeEnabled, setCondensedModeEnabled] = useState<boolean>(false);
    const [subtitlePlayerHidden, setSubtitlePlayerHidden] = useState<boolean>(false);
    const [appBarHidden, setAppBarHidden] = useState<boolean>(settingsProvider.theaterMode);
    const showSubtitlesRef = useRef<IndexedSubtitleModel[]>([]);
    showSubtitlesRef.current = showSubtitles;
    const clock = useMemo<Clock>(() => new Clock(), []);
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const [showCursor, setShowCursor] = useState<boolean>(false);
    const lastMouseMovementTimestamp = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [returnToFullscreenOnFinishedAnkiDialogRequest, setReturnToFullscreenOnFinishedAnkiDialogRequest] =
        useState<boolean>(false);
    const returnToFullscreenOnFinishedAnkiDialogRequestRef = useRef<boolean>();
    returnToFullscreenOnFinishedAnkiDialogRequestRef.current = returnToFullscreenOnFinishedAnkiDialogRequest;

    const videoRefCallback = useCallback(
        (element: HTMLVideoElement) => {
            if (element) {
                const videoElement = element as ExperimentalHTMLVideoElement;
                videoRef.current = videoElement;

                if (videoElement.readyState === 4) {
                    notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
                } else {
                    videoElement.onloadeddata = (event) => {
                        notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
                    };
                }

                videoElement.oncanplay = (event) => {
                    playerChannel.readyState(4);

                    if (playingRef.current) {
                        clock.start();
                    }
                };

                videoElement.ontimeupdate = (event) => clock.setTime(element.currentTime * 1000);

                videoElement.onerror = (event) => onError(errorMessage(element));
            }
        },
        [clock, playerChannel, onError]
    );

    function selectAudioTrack(id: string) {
        const audioTracks = videoRef.current?.audioTracks;

        if (!audioTracks) {
            return;
        }

        // @ts-ignore
        for (const t of audioTracks) {
            if (t.id === id) {
                t.enabled = true;
            } else {
                t.enabled = false;
            }
        }
    }

    useEffect(() => {
        playerChannel.onReady((duration) => setLength(duration));

        playerChannel.onPlay(async () => {
            await videoRef.current?.play();
            clock.start();
            setPlaying(true);
        });

        playerChannel.onPause(() => {
            videoRef.current?.pause();
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
            setSelectedAudioTrack(id);
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

        playerChannel.onCondensedModeToggle((enabled) => setCondensedModeEnabled(enabled));
        playerChannel.onHideSubtitlePlayerToggle((hidden) => setSubtitlePlayerHidden(hidden));
        playerChannel.onAppBarToggle((hidden) => setAppBarHidden(hidden));
        playerChannel.onAnkiDialogRequest(() => {
            if (fullscreenRef.current && !popOut) {
                document.exitFullscreen();
                setReturnToFullscreenOnFinishedAnkiDialogRequest(true);
            }
        });

        playerChannel.onFinishedAnkiDialogRequest(async (resume) => {
            if (returnToFullscreenOnFinishedAnkiDialogRequestRef.current) {
                if (resume) {
                    try {
                        await containerRef.current?.requestFullscreen();
                    } catch (e) {
                        console.error(e);
                    }
                }

                setReturnToFullscreenOnFinishedAnkiDialogRequest(false);
            }
        });

        window.onbeforeunload = (e) => {
            if (!poppingInRef.current) {
                playerChannel.close();
            }
        };

        return () => playerChannel.close();
    }, [clock, playerChannel, popOut]);

    const handlePlay = useCallback(() => {
        if (videoRef.current) {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handlePause = useCallback(() => playerChannel.pause(), [playerChannel]);

    const handleSeek = useCallback(
        (progress: number) => {
            if (playingRef.current) {
                clock.stop();
            }

            const time = progress * length;
            playerChannel.currentTime = time / 1000;
        },
        [length, clock, playerChannel]
    );

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        lastMouseMovementTimestamp.current = Date.now();

        if (!containerRef.current) {
            return;
        }

        var bounds = containerRef.current.getBoundingClientRect();
        mousePositionRef.current.x = e.clientX - bounds.left;
        mousePositionRef.current.y = e.clientY - bounds.top;
    }

    const handleAudioTrackSelected = useCallback(
        (id: string) => {
            if (playingRef.current) {
                clock.stop();
                playerChannel.pause();
            }

            selectAudioTrack(id);
            setSelectedAudioTrack(id);
            playerChannel.currentTime = 0;
            playerChannel.audioTrackSelected(id);
        },
        [playerChannel, clock]
    );

    useEffect(() => {
        if (!subtitles || subtitles.length === 0) {
            return;
        }

        const interval = setInterval(() => {
            const now = clock.time(length);
            let showSubtitles = [];

            for (let i = 0; i < subtitles.length; ++i) {
                const s = subtitles[i];

                if (now >= s.start && now < s.end && !disabledSubtitleTracks[s.track]) {
                    showSubtitles.push({ ...s, index: i });
                }

                if (now < s.start) {
                    break;
                }
            }

            showSubtitles = showSubtitles.sort((s1, s2) => s1.track - s2.track);

            if (!arrayEquals(showSubtitles, showSubtitlesRef.current, (s1, s2) => s1.index === s2.index)) {
                setShowSubtitles(showSubtitles);
            }
        }, 50);

        return () => clearTimeout(interval);
    }, [subtitles, disabledSubtitleTracks, clock, length]);

    const handleOffsetChange = useCallback(
        (offset: number) => {
            setOffset(offset);
            setSubtitles((subtitles) =>
                subtitles.map((s) => ({
                    text: s.text,
                    textImage: s.textImage,
                    start: s.originalStart + offset,
                    originalStart: s.originalStart,
                    end: s.originalEnd + offset,
                    originalEnd: s.originalEnd,
                    track: s.track,
                }))
            );
            playerChannel.offset(offset);
        },
        [playerChannel]
    );

    useEffect(() => {
        const unbind = KeyBindings.bindSeekToSubtitle(
            (event, subtitle) => {
                event.stopPropagation();
                event.preventDefault();
                playerChannel.currentTime = subtitle.start / 1000;
            },
            () => !videoRef.current,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [playerChannel, subtitles, length, clock]);

    useEffect(() => {
        const unbind = KeyBindings.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.stopPropagation();
                event.preventDefault();
                playerChannel.currentTime = subtitle.start / 1000;
            },
            () => !videoRef.current,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [playerChannel, subtitles, length, clock]);

    useEffect(() => {
        const unbind = KeyBindings.bindSeekBackwardOrForward(
            (event, forward) => {
                event.stopPropagation();
                event.preventDefault();
                const timestamp = clock.time(length);

                if (forward) {
                    playerChannel.currentTime = Math.min(length / 1000, (timestamp + 10000) / 1000);
                } else {
                    playerChannel.currentTime = Math.max(0, (timestamp - 10000) / 1000);
                }
            },
            () => !videoRef.current
        );

        return () => unbind();
    }, [playerChannel, length, clock]);

    const calculateSurroundingSubtitles = useCallback(
        (index: number) => {
            return surroundingSubtitles(
                subtitles,
                index,
                settingsProvider.surroundingSubtitlesCountRadius,
                settingsProvider.surroundingSubtitlesTimeRadius
            );
        },
        [subtitles, settingsProvider.surroundingSubtitlesCountRadius, settingsProvider.surroundingSubtitlesTimeRadius]
    );

    useEffect(() => {
        const unbind = KeyBindings.bindCopy<IndexedSubtitleModel>(
            (event, subtitle) => {
                event.stopPropagation();
                event.preventDefault();

                const noSubtitles = !subtitles || subtitles.length === 0;

                playerChannel.copy(
                    subtitle,
                    noSubtitles
                        ? mockSurroundingSubtitles(subtitle, length, 5000)
                        : calculateSurroundingSubtitles(subtitle.index)
                );

                if (fullscreen) {
                    setAlert(
                        subtitle.text === ''
                            ? `Saved ${humanReadableTime(subtitle.start)}`
                            : `Copied: "${subtitle.text}"`
                    );
                    setAlertOpen(true);
                }
            },
            () => false,
            () => {
                if (!subtitles || subtitles.length === 0) {
                    const timestamp = clock.time(length);
                    const end = Math.min(timestamp + 5000, length);

                    return {
                        text: '',
                        start: timestamp,
                        originalStart: timestamp,
                        end: end,
                        originalEnd: end,
                        track: 0,
                        index: 0,
                    };
                }

                if (!showSubtitlesRef.current || showSubtitlesRef.current.length === 0) {
                    return undefined;
                }

                return showSubtitlesRef.current[0];
            }
        );

        return () => unbind();
    }, [playerChannel, clock, length, subtitles, calculateSurroundingSubtitles, fullscreen]);

    useEffect(() => {
        const unbind = KeyBindings.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                handleOffsetChange(offset);
            },
            () => false,
            () => subtitles
        );

        return () => unbind();
    }, [handleOffsetChange, subtitles]);

    useEffect(() => {
        const unbind = KeyBindings.bindToggleSubtitles(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                setSubtitlesEnabled((enabled) => !enabled);
            },
            () => {},
            () => false
        );

        return () => unbind();
    }, []);

    useEffect(() => {
        const unbind = KeyBindings.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                event.stopPropagation();
                setDisabledSubtitleTracks((tracks) => {
                    const newTracks = { ...tracks };
                    newTracks[track] = !tracks[track];
                    return newTracks;
                });
            },
            () => {},
            () => false
        );

        return () => unbind();
    }, []);

    useEffect(() => {
        const unbind = KeyBindings.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopPropagation();
                playerChannel.toggleSubtitleTrackInList(track);
            },
            () => {},
            () => false
        );

        return () => unbind();
    }, [playerChannel]);

    useEffect(() => {
        const unbind = KeyBindings.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                handleOffsetChange(offset);
            },
            () => false,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [handleOffsetChange, subtitles, clock, length]);

    useEffect(() => {
        const unbind = KeyBindings.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!subtitles || subtitles.length === 0) {
                    const timestamp = clock.time(length);
                    const end = Math.min(timestamp + 5000, length);
                    const subtitle = {
                        text: '',
                        start: timestamp,
                        originalStart: timestamp,
                        end: end,
                        originalEnd: end,
                        track: 0,
                    };

                    playerChannel.copy(subtitle, mockSurroundingSubtitles(subtitle, length, 5000), false);
                } else if (showSubtitlesRef.current && showSubtitlesRef.current.length > 0) {
                    const currentSubtitle = showSubtitlesRef.current[0];
                    playerChannel.copy(currentSubtitle, calculateSurroundingSubtitles(currentSubtitle.index), true);
                }

                // Ensure that anki dialog request is handled after the subtitle has appeared in copy history
                // FIXME: This is a hack
                setTimeout(() => playerChannel.ankiDialogRequest(fullscreen), 100);
            },
            () => false
        );

        return () => unbind();
    }, [playerChannel, subtitles, clock, length, calculateSurroundingSubtitles, fullscreen]);

    useEffect(() => {
        const unbind = KeyBindings.bindPlay(
            (event) => {
                event.preventDefault();

                if (playing) {
                    playerChannel.pause();
                } else {
                    playerChannel.play();
                }
            },
            () => false
        );

        return () => unbind();
    }, [playing, playerChannel]);

    const handleSubtitlesToggle = useCallback(() => setSubtitlesEnabled((subtitlesEnabled) => !subtitlesEnabled), []);

    const handleFullscreenToggle = useCallback(() => {
        if (fullscreen) {
            document.exitFullscreen();
        } else {
            containerRef.current?.requestFullscreen();
        }
    }, [fullscreen]);

    const handleVolumeChange = useCallback((volume: number) => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
    }, []);

    const handlePopOutToggle = useCallback(() => {
        playerChannel.popOutToggle();
        if (popOut) {
            poppingInRef.current = true;
            window.close();
        }
    }, [playerChannel, popOut]);

    const handleCondensedModeToggle = useCallback(() => {
        playerChannel.condensedModeToggle();
    }, [playerChannel]);

    const handleClose = useCallback(() => {
        playerChannel.close();
        window.close();
    }, [playerChannel]);

    const handleHideSubtitlePlayerToggle = useCallback(() => {
        playerChannel.hideSubtitlePlayerToggle();
    }, [playerChannel]);

    const handleTheaterModeToggle = useCallback(() => {
        playerChannel.appBarToggle();
    }, [playerChannel]);

    const handleClick = useCallback(() => {
        if (playing) {
            playerChannel.pause();
        } else {
            playerChannel.play();
        }
    }, [playerChannel, playing]);

    const handleDoubleClick = useCallback(() => handleFullscreenToggle(), [handleFullscreenToggle]);

    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const {
        subtitleSize,
        subtitleColor,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        imageBasedSubtitleScaleFactor,
    } = settingsProvider.subtitleSettings;
    const subtitleStyles = useMemo(
        () =>
            computeStyles({
                subtitleSize,
                subtitleColor,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleBackgroundColor,
                subtitleBackgroundOpacity,
                subtitleFontFamily,
            }),
        [
            subtitleSize,
            subtitleColor,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleBackgroundColor,
            subtitleBackgroundOpacity,
            subtitleFontFamily,
        ]
    );

    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - lastMouseMovementTimestamp.current > 300) {
                if (showCursor) {
                    setShowCursor(false);
                }
            } else if (!showCursor) {
                setShowCursor(true);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [showCursor]);

    return (
        <div ref={containerRef} onMouseMove={handleMouseMove} className={classes.root}>
            <video
                preload="auto"
                controls={false}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={showCursor ? classes.video : `${classes.cursorHidden} ${classes.video}`}
                ref={videoRefCallback}
                src={videoFile}
            />
            {subtitlesEnabled && (
                <div className={classes.subtitleContainer}>
                    {showSubtitles.map((subtitle) => {
                        let content;

                        if (subtitle.textImage) {
                            content = (
                                <SubtitleTextImage
                                    availableWidth={videoRef.current?.width ?? window.screen.availWidth}
                                    subtitle={subtitle}
                                    scale={imageBasedSubtitleScaleFactor}
                                />
                            );
                        } else {
                            content = <span style={subtitleStyles}>{subtitle.text}</span>;
                        }
                        return <React.Fragment key={subtitle.index}>{content}</React.Fragment>;
                    })}
                </div>
            )}
            {fullscreen && (
                <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity="success">
                    {alert}
                </Alert>
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
                popOutEnabled={!isMobile}
                condensedModeToggleEnabled={true}
                condensedModeEnabled={condensedModeEnabled}
                hideSubtitlePlayerToggleEnabled={subtitles?.length > 0 && !popOut && !fullscreen}
                subtitlePlayerHidden={subtitlePlayerHidden}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected}
                onSubtitlesToggle={handleSubtitlesToggle}
                onFullscreenToggle={handleFullscreenToggle}
                onVolumeChange={handleVolumeChange}
                onOffsetChange={handleOffsetChange}
                onPopOutToggle={handlePopOutToggle}
                onCondensedModeToggle={handleCondensedModeToggle}
                onClose={handleClose}
                onHideSubtitlePlayerToggle={handleHideSubtitlePlayerToggle}
                settingsProvider={settingsProvider}
                showOnMouseMovement={false}
                theaterModeToggleEnabled={true}
                theaterModeEnabled={appBarHidden}
                onTheaterModeToggle={handleTheaterModeToggle}
            />
        </div>
    );
}
