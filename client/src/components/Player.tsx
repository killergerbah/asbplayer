import { useEffect, useState, useMemo, useCallback, useRef, MutableRefObject } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { v4 as uuidv4 } from 'uuid';
import {
    AsbplayerSettingsProvider,
    AudioModel,
    AudioTrackModel,
    ImageModel,
    KeyBindings,
    mockSurroundingSubtitles,
    SubtitleModel,
    VideoTabModel,
} from '@project/common';
import { timeDurationDisplay } from '../services/Util';
import BroadcastChannelVideoProtocol from '../services/BroadcastChannelVideoProtocol';
import ChromeTabVideoProtocol from '../services/ChromeTabVideoProtocol';
import Clock from '../services/Clock';
import Controls, { Point } from './Controls';
import Grid from '@material-ui/core/Grid';
import MediaAdapter, { MediaElement } from '../services/MediaAdapter';
import SubtitlePlayer, { DisplaySubtitleModel } from './SubtitlePlayer';
import VideoChannel from '../services/VideoChannel';
import ChromeExtension from '../services/ChromeExtension';
import SubtitleReader from '../services/SubtitleReader';

const useStyles = makeStyles({
    root: {
        height: 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden',
    },
    container: {
        width: '100%',
        height: '100%',
    },
    videoFrame: {
        width: '100%',
        height: '100%',
        border: 0,
    },
});

function trackLength(
    audioRef: MutableRefObject<HTMLAudioElement | null>,
    videoRef: MutableRefObject<MediaElement | undefined>,
    subtitles: SubtitleModel[] | undefined,
    useOffset?: boolean
) {
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

    const audioLength = audioRef.current && audioRef.current.duration ? 1000 * audioRef.current.duration : 0;

    const videoLength = videoRef.current && videoRef.current.duration ? 1000 * videoRef.current.duration : 0;

    return Math.max(videoLength, Math.max(subtitlesLength, audioLength));
}

interface MediaSources {
    subtitleFiles: File[];
    audioFile?: File;
    audioFileUrl?: string;
    videoFile?: File;
    videoFileUrl?: string;
}

interface AnkiDialogFinishedRequest {
    resume: boolean;
    timestamp: number;
}

interface PlayerProps {
    sources: MediaSources;
    subtitleReader: SubtitleReader;
    settingsProvider: AsbplayerSettingsProvider;
    extension: ChromeExtension;
    videoFrameRef: MutableRefObject<HTMLIFrameElement>;
    drawerOpen: boolean;
    tab: VideoTabModel;
    availableTabs: VideoTabModel[];
    ankiDialogRequestToVideo: boolean;
    ankiDialogRequested: boolean;
    ankiDialogFinishedRequest: AnkiDialogFinishedRequest;
    onError: (error: string) => void;
    onUnloadAudio: (url: string) => void;
    onUnloadVideo: (url: string) => void;
    onCopy: (
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        audioFile: File | undefined,
        videoFile: File | undefined,
        subtitleFile: File | undefined,
        audioTrack: string | undefined,
        audio: AudioModel | undefined,
        image: ImageModel | undefined,
        url: string | undefined,
        preventDuplicate: boolean | undefined,
        id: string | undefined
    ) => void;
    onLoaded: () => void;
    onTabSelected: (tab: VideoTabModel) => void;
    onAnkiDialogRequest: (forwardToVideo?: boolean) => void;
    disableKeyEvents: boolean;
    jumpToSubtitle: SubtitleModel;
}

export default function Player({
    sources: { subtitleFiles, audioFile, audioFileUrl, videoFile, videoFileUrl },
    subtitleReader,
    settingsProvider,
    extension,
    videoFrameRef,
    drawerOpen,
    tab,
    availableTabs,
    ankiDialogRequestToVideo,
    ankiDialogRequested,
    ankiDialogFinishedRequest,
    onError,
    onUnloadAudio,
    onUnloadVideo,
    onCopy,
    onLoaded,
    onTabSelected,
    onAnkiDialogRequest,
    disableKeyEvents,
    jumpToSubtitle,
}: PlayerProps) {
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>();
    const subtitlesRef = useRef<SubtitleModel[]>();
    subtitlesRef.current = subtitles;
    const [loadingSubtitles, setLoadingSubtitles] = useState<boolean>(false);
    const [playing, setPlaying] = useState<boolean>(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const playingRef = useRef<boolean>();
    playingRef.current = playing;
    const [, updateState] = useState<any>();
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [channelId, setChannelId] = useState<string>();
    const [videoPopOut, setVideoPopOut] = useState<boolean>(false);
    const [, setResumeOnFinishedAnkiDialogRequest] = useState<boolean>(false);
    const [hideSubtitlePlayer, setHideSubtitlePlayer] = useState<boolean>(false);
    const hideSubtitlePlayerRef = useRef<boolean>();
    hideSubtitlePlayerRef.current = hideSubtitlePlayer;
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [track: number]: boolean }>({});
    const [condensedModeEnabled, setCondensedModeEnabled] = useState<boolean>(false);
    const condensedModeEnabledRef = useRef<boolean>();
    condensedModeEnabledRef.current = condensedModeEnabled;
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const audioRef = useRef<HTMLAudioElement>(null);
    const videoRef = useRef<MediaElement>();
    const mediaAdapter = useMemo(() => {
        if (audioFileUrl) {
            return new MediaAdapter(audioRef);
        } else if (videoFileUrl || tab) {
            return new MediaAdapter(videoRef);
        }

        return new MediaAdapter({ current: null });
    }, [audioFileUrl, videoFileUrl, tab]);
    const clock = useMemo<Clock>(() => new Clock(), []);
    const classes = useStyles();
    const lengthRef = useRef<number>(0);
    lengthRef.current = trackLength(audioRef, videoRef, subtitles, true);

    const seek = useCallback(
        async (time, clock, forwardToMedia) => {
            clock.setTime(time);
            forceUpdate();

            if (forwardToMedia) {
                await mediaAdapter.seek(time / 1000);
            }
        },
        [forceUpdate, mediaAdapter]
    );

    const applyOffset = useCallback(
        (offset, forwardToVideo) => {
            setOffset(offset);

            setSubtitles((subtitles) => {
                if (!subtitles) {
                    return;
                }

                const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end + offset : 0;

                const newSubtitles = subtitles.map((s) => ({
                    text: s.text,
                    start: s.originalStart + offset,
                    originalStart: s.originalStart,
                    end: s.originalEnd + offset,
                    originalEnd: s.originalEnd,
                    displayTime: timeDurationDisplay(s.originalStart + offset, length),
                    track: s.track,
                }));

                if (forwardToVideo) {
                    if (videoRef.current instanceof VideoChannel) {
                        videoRef.current.subtitles(
                            newSubtitles,
                            subtitleFiles.map((f) => f.name)
                        );
                    }
                }

                return newSubtitles;
            });
        },
        [subtitleFiles]
    );

    useEffect(() => {
        let channel: VideoChannel | undefined = undefined;
        let channelClosed = false;

        async function init() {
            if (videoRef.current instanceof VideoChannel) {
                videoRef.current.close();
            }
            videoRef.current = undefined;
            clock.setTime(0);
            clock.stop();
            setOffset(0);
            setPlaying(false);
            setAudioTracks(undefined);
            setSelectedAudioTrack(undefined);
            setCondensedModeEnabled(false);
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.pause();
            }

            let subtitles;

            if (subtitleFiles.length > 0) {
                setLoadingSubtitles(true);

                try {
                    const nodes = await subtitleReader.subtitles(subtitleFiles);
                    const length = nodes.length > 0 ? nodes[nodes.length - 1].end : 0;
                    subtitles = nodes.map((s) => ({
                        text: s.text,
                        start: s.start,
                        originalStart: s.start,
                        end: s.end,
                        originalEnd: s.end,
                        displayTime: timeDurationDisplay(s.start, length),
                        track: s.track,
                    }));

                    setSubtitles(subtitles);
                    setLastJumpToTopTimestamp(Date.now());
                } catch (e) {
                    if (e instanceof Error) {
                        onError(e.message);
                    } else {
                        onError(String(e));
                    }
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
                } else {
                    // Not possible
                    // But throw error so typescript recognizes channel as defined
                    throw new Error('Unreachable code');
                }

                videoRef.current = channel;
                let subscribed = false;

                channel.onExit(() => videoFileUrl && onUnloadVideo(videoFileUrl));
                channel.onPopOutToggle(() => setVideoPopOut((popOut) => !popOut));
                channel.onHideSubtitlePlayerToggle(() => {
                    setHideSubtitlePlayer((hidden) => {
                        channel?.hideSubtitlePlayerToggle(!hidden);
                        return !hidden;
                    });
                });
                channel.onReady((paused) => {
                    lengthRef.current = trackLength(audioRef, videoRef, subtitlesRef.current);
                    channel?.ready(lengthRef.current);

                    if (subtitlesRef.current) {
                        channel?.subtitleSettings(settingsProvider.subtitleSettings);
                        channel?.subtitles(
                            subtitlesRef.current,
                            subtitleFiles.map((f) => f.name)
                        );
                    }

                    channel?.ankiSettings(settingsProvider.ankiSettings);
                    channel?.miscSettings(settingsProvider.miscSettings);
                    channel?.condensedModeToggle(condensedModeEnabledRef.current ?? false);
                    channel?.hideSubtitlePlayerToggle(hideSubtitlePlayerRef.current ?? false);

                    if (channel?.audioTracks && channel?.audioTracks?.length > 1) {
                        setAudioTracks(channel?.audioTracks);
                        setSelectedAudioTrack(channel?.selectedAudioTrack);
                    } else {
                        setAudioTracks(undefined);
                        setSelectedAudioTrack(undefined);
                    }

                    if (videoRef.current) {
                        clock.setTime(videoRef.current.currentTime * 1000);
                    }

                    if (paused) {
                        clock.stop();
                    } else {
                        clock.start();
                    }

                    setPlaying(!paused);

                    if (!subscribed) {
                        channel?.onPlay((forwardToMedia) => play(clock, mediaAdapter, forwardToMedia));
                        channel?.onPause((forwardToMedia) => pause(clock, mediaAdapter, forwardToMedia));
                        channel?.onOffset((offset) => applyOffset(Math.max(-lengthRef.current ?? 0, offset), false));
                        channel?.onCopy((subtitle, surroundingSubtitles, audio, image, url, preventDuplicate, id) =>
                            onCopy(
                                subtitle,
                                surroundingSubtitles,
                                audioFile,
                                videoFile,
                                subtitle ? subtitleFiles[subtitle.track] : undefined,
                                channel?.selectedAudioTrack,
                                audio,
                                image,
                                url,
                                preventDuplicate,
                                id
                            )
                        );
                        channel?.onCondensedModeToggle(() =>
                            setCondensedModeEnabled((enabled) => {
                                const newValue = !enabled;
                                channel?.condensedModeToggle(newValue);
                                return newValue;
                            })
                        );
                        channel?.onCurrentTime(async (currentTime, forwardToMedia) => {
                            if (playingRef.current) {
                                clock.stop();
                            }

                            await seek(currentTime * 1000, clock, forwardToMedia);

                            if (playingRef.current) {
                                clock.start();
                            }
                        });
                        channel?.onAudioTrackSelected(async (id) => {
                            if (playingRef.current) {
                                clock.stop();
                            }

                            await mediaAdapter.onReady();
                            if (playingRef.current) {
                                clock.start();
                            }

                            setSelectedAudioTrack(id);
                        });
                        channel?.onAnkiDialogRequest((forwardToVideo) => onAnkiDialogRequest(forwardToVideo));
                        channel?.onToggleSubtitleTrackInList((track) =>
                            setDisabledSubtitleTracks((tracks) => {
                                const newTracks = { ...tracks };
                                newTracks[track] = !tracks[track];
                                return newTracks;
                            })
                        );

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
    }, [
        subtitleReader,
        extension,
        settingsProvider,
        clock,
        mediaAdapter,
        seek,
        onLoaded,
        onError,
        onUnloadVideo,
        onCopy,
        onAnkiDialogRequest,
        subtitleFiles,
        audioFile,
        audioFileUrl,
        videoFile,
        videoFileUrl,
        tab,
        forceUpdate,
        videoFrameRef,
        applyOffset,
    ]);

    function play(clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) {
        setPlaying(true);
        clock.start();

        if (forwardToMedia) {
            mediaAdapter.play();
        }
    }

    function pause(clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) {
        setPlaying(false);
        clock.stop();

        if (forwardToMedia) {
            mediaAdapter.pause();
        }
    }

    useEffect(() => {
        if (ankiDialogRequestToVideo && videoRef.current instanceof VideoChannel) {
            videoRef.current.ankiDialogRequest();
        }
    }, [ankiDialogRequestToVideo]);

    useEffect(() => {
        if (ankiDialogFinishedRequest && ankiDialogFinishedRequest.timestamp > 0) {
            if (videoRef.current instanceof VideoChannel) {
                videoRef.current.finishedAnkiDialogRequest(ankiDialogFinishedRequest.resume);
            }

            setResumeOnFinishedAnkiDialogRequest((resumeOnFinishedAnkiDialogRequest) => {
                if (resumeOnFinishedAnkiDialogRequest && ankiDialogFinishedRequest.resume) {
                    play(clock, mediaAdapter, true);
                }

                return false;
            });
        }
    }, [ankiDialogFinishedRequest, clock, mediaAdapter]);

    useEffect(() => {
        if (ankiDialogRequested && playingRef.current) {
            pause(clock, mediaAdapter, true);
            setResumeOnFinishedAnkiDialogRequest(true);
        }
    }, [ankiDialogRequested, clock, mediaAdapter]);

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
                    await seek(nextSubtitle.start, clock, true);
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
                process.env.PUBLIC_URL +
                    '/?video=' +
                    encodeURIComponent(videoFileUrl) +
                    '&channel=' +
                    channelId +
                    '&popout=true',
                'asbplayer-video-' + videoFileUrl,
                'resizable,width=800,height=450'
            );
        }

        setLastJumpToTopTimestamp(Date.now());
    }, [videoPopOut, channelId, videoFileUrl, videoFrameRef]);

    const handlePlay = useCallback(() => play(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handlePause = useCallback(() => pause(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handleSeek = useCallback(
        async (progress) => {
            if (!lengthRef.current) {
                return;
            }

            if (playingRef.current) {
                clock.stop();
            }

            await seek(progress * lengthRef.current, clock, true);

            if (playingRef.current) {
                clock.start();
            }
        },
        [clock, seek]
    );

    const handleSeekToSubtitle = useCallback(
        async (time, shouldPlay) => {
            if (!shouldPlay) {
                pause(clock, mediaAdapter, true);
            }

            if (playingRef.current) {
                clock.stop();
            }

            await seek(time, clock, true);

            if (shouldPlay && !playingRef.current) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
            }
        },
        [clock, seek, mediaAdapter]
    );

    const handleCopy = useCallback(
        (subtitle, surroundingSubtitles, preventDuplicate) => {
            onCopy(
                subtitle,
                surroundingSubtitles,
                audioFile,
                videoFile,
                subtitleFiles[subtitle.track],
                selectedAudioTrack,
                undefined,
                undefined,
                undefined,
                preventDuplicate,
                undefined
            );
        },
        [onCopy, audioFile, videoFile, subtitleFiles, selectedAudioTrack]
    );

    const handleMouseMove = useCallback((e) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    }, []);

    const handleAudioTrackSelected = useCallback(
        async (id) => {
            if (videoRef.current instanceof VideoChannel) {
                (videoRef.current as VideoChannel).audioTrackSelected(id);
            }

            pause(clock, mediaAdapter, true);

            await seek(0, clock, true);

            if (playingRef.current) {
                play(clock, mediaAdapter, true);
            }
        },
        [clock, mediaAdapter, seek]
    );

    const handleOffsetChange = useCallback(
        (offset) => {
            applyOffset(Math.max(-lengthRef.current ?? 0, offset), true);
        },
        [applyOffset]
    );

    const handleVolumeChange = useCallback((v) => {
        if (audioRef.current instanceof HTMLMediaElement) {
            audioRef.current.volume = v;
        }
    }, []);

    const handleCondensedModeToggle = useCallback(() => setCondensedModeEnabled((v) => !v), []);

    const handleToggleSubtitleTrack = useCallback(
        (track) =>
            setDisabledSubtitleTracks((tracks) => {
                const newTracks = { ...tracks };
                newTracks[track] = !tracks[track];
                return newTracks;
            }),
        []
    );

    useEffect(() => {
        if (tab) {
            return;
        }

        const interval = setInterval(async () => {
            const length = lengthRef.current;
            const progress = clock.progress(length);

            if (progress >= 1) {
                pause(clock, mediaAdapter, true);
                await seek(0, clock, true);
                setLastJumpToTopTimestamp(Date.now());
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, subtitles, mediaAdapter, seek, tab]);

    useEffect(() => {
        const unbind = KeyBindings.bindPlay(
            (event) => {
                event.preventDefault();

                if (playing) {
                    pause(clock, mediaAdapter, true);
                } else {
                    play(clock, mediaAdapter, true);
                }
            },
            () => disableKeyEvents
        );

        return () => unbind();
    }, [playing, clock, mediaAdapter, disableKeyEvents]);

    useEffect(() => {
        if ((audioFile || videoFile) && (!subtitles || subtitles.length === 0)) {
            const unbindCopy = KeyBindings.bindCopy(
                (event, subtitle) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const surroundingSubtitles = mockSurroundingSubtitles(subtitle, lengthRef.current, 5000);
                    onCopy(
                        subtitle,
                        surroundingSubtitles,
                        audioFile,
                        videoFile,
                        undefined,
                        selectedAudioTrack,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined
                    );
                },
                () => disableKeyEvents,
                () => {
                    if (!lengthRef.current) {
                        return undefined;
                    }

                    const timestamp = clock.time(lengthRef.current);
                    const end = Math.min(timestamp + 5000, lengthRef.current);

                    return {
                        text: '',
                        start: timestamp,
                        originalStart: timestamp,
                        end: end,
                        originalEnd: end,
                        track: 0,
                    };
                }
            );

            const unbindAnkiExport = KeyBindings.bindAnkiExport(
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const timestamp = clock.time(lengthRef.current);
                    const end = Math.min(timestamp + 5000, lengthRef.current);
                    const subtitle = {
                        text: '',
                        start: timestamp,
                        originalStart: timestamp,
                        end: end,
                        originalEnd: end,
                        track: 0,
                    };
                    const surroundingSubtitles = mockSurroundingSubtitles(subtitle, lengthRef.current, 5000);
                    onCopy(
                        subtitle,
                        surroundingSubtitles,
                        audioFile,
                        videoFile,
                        undefined,
                        selectedAudioTrack,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined
                    );

                    onAnkiDialogRequest();
                },
                () => false
            );

            return () => {
                unbindCopy();
                unbindAnkiExport();
            };
        }
    }, [audioFile, videoFile, subtitles, clock, selectedAudioTrack, disableKeyEvents, onCopy, onAnkiDialogRequest]);

    const length = lengthRef.current;
    const loaded = audioFileUrl || videoFileUrl || subtitles;
    const videoInWindow = Boolean(loaded && videoFileUrl && !videoPopOut);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            <Grid container direction="row" wrap="nowrap" className={classes.container}>
                {videoInWindow && (
                    <Grid item style={{ flexGrow: 1, minWidth: 600 }}>
                        <iframe
                            ref={videoFrameRef}
                            className={classes.videoFrame}
                            src={
                                process.env.PUBLIC_URL +
                                '/?video=' +
                                encodeURIComponent(videoFileUrl!) +
                                '&channel=' +
                                channelId +
                                '&popout=false'
                            }
                            title="asbplayer"
                        />
                    </Grid>
                )}
                {(!videoInWindow || (subtitles && subtitles?.length > 0)) && (
                    <Grid
                        item
                        style={{
                            flexGrow: videoInWindow ? 0 : 1,
                            width: videoInWindow && hideSubtitlePlayer ? 0 : 'auto',
                        }}
                    >
                        {loaded && !(videoFileUrl && !videoPopOut) && (
                            <Controls
                                mousePositionRef={mousePositionRef}
                                playing={playing}
                                clock={clock}
                                length={length}
                                displayLength={trackLength(audioRef, videoRef, subtitles, false)}
                                audioTracks={audioTracks}
                                selectedAudioTrack={selectedAudioTrack}
                                tabs={(!videoFileUrl && !audioFileUrl && availableTabs) || undefined}
                                selectedTab={tab}
                                audioFile={audioFile?.name}
                                videoFile={videoFile?.name}
                                offsetEnabled={true}
                                offset={offset}
                                volumeEnabled={Boolean(audioFileUrl)}
                                condensedModeToggleEnabled={Boolean(audioFileUrl) && subtitles && subtitles.length > 0}
                                condensedModeEnabled={condensedModeEnabled}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onSeek={handleSeek}
                                onAudioTrackSelected={handleAudioTrackSelected}
                                onTabSelected={onTabSelected}
                                onUnloadAudio={() => audioFileUrl && onUnloadAudio(audioFileUrl)}
                                onUnloadVideo={() => videoFileUrl && onUnloadVideo(videoFileUrl)}
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
                            jumpToSubtitle={jumpToSubtitle}
                            drawerOpen={drawerOpen}
                            compressed={Boolean(videoFileUrl && !videoPopOut)}
                            loading={loadingSubtitles}
                            displayHelp={audioFile?.name || (videoPopOut && videoFile?.name) || undefined}
                            disableKeyEvents={disableKeyEvents}
                            lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                            hidden={videoInWindow && hideSubtitlePlayer}
                            disabledSubtitleTracks={disabledSubtitleTracks}
                            onSeek={handleSeekToSubtitle}
                            onCopy={handleCopy}
                            onOffsetChange={handleOffsetChange}
                            onAnkiDialogRequest={onAnkiDialogRequest}
                            onToggleSubtitleTrack={handleToggleSubtitleTrack}
                            settingsProvider={settingsProvider}
                        />
                    </Grid>
                )}
            </Grid>
            <audio ref={audioRef} src={audioFileUrl} />
        </div>
    );
}
