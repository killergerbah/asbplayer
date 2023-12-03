import React, { useEffect, useState, useMemo, useCallback, useRef, MutableRefObject } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioTrackModel,
    AutoPauseContext,
    AutoPausePreference,
    CardModel,
    PlayMode,
    PostMineAction,
    SubtitleModel,
    VideoTabModel,
} from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { KeyBinder } from '@project/common/key-binder';
import { timeDurationDisplay } from '../services/util';
import BroadcastChannelVideoProtocol from '../services/broadcast-channel-video-protocol';
import ChromeTabVideoProtocol from '../services/chrome-tab-video-protocol';
import Clock from '../services/clock';
import Controls, { Point } from './Controls';
import Grid from '@material-ui/core/Grid';
import MediaAdapter, { MediaElement } from '../services/media-adapter';
import SubtitlePlayer, { DisplaySubtitleModel } from './SubtitlePlayer';
import VideoChannel from '../services/video-channel';
import ChromeExtension from '../services/chrome-extension';
import PlaybackPreferences from '../services/playback-preferences';

interface StylesProps {
    appBarHidden: boolean;
}

const useStyles = makeStyles<Theme, StylesProps>({
    root: ({ appBarHidden }) => ({
        height: appBarHidden ? '100vh' : 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden',
    }),
    container: {
        width: '100%',
        height: '100%',
    },
    videoFrame: {
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
    },
});

function trackLength(
    video: MediaElement | undefined,
    subtitles: SubtitleModel[] | undefined,
    useOffset?: boolean
): number {
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

    const videoLength = video && video.duration ? 1000 * video.duration : 0;
    return Math.max(videoLength, subtitlesLength);
}

export interface MediaSources {
    subtitleFiles: File[];
    flattenSubtitleFiles?: boolean;
    videoFile?: File;
    videoFileUrl?: string;
}

export interface AnkiDialogFinishedRequest {
    resume: boolean;
    timestamp: number;
}

interface PlayerProps {
    sources?: MediaSources;
    subtitles: DisplaySubtitleModel[];
    subtitleReader: SubtitleReader;
    settings: AsbplayerSettings;
    playbackPreferences: PlaybackPreferences;
    keyBinder: KeyBinder;
    extension: ChromeExtension;
    videoFrameRef?: MutableRefObject<HTMLIFrameElement | null>;
    videoChannelRef?: MutableRefObject<VideoChannel | null>;
    drawerOpen: boolean;
    appBarHidden: boolean;
    showCopyButton: boolean;
    copyButtonEnabled: boolean;
    videoFullscreen: boolean;
    hideSubtitlePlayer: boolean;
    videoPopOut: boolean;
    tab?: VideoTabModel;
    availableTabs: VideoTabModel[];
    ankiDialogRequested: boolean;
    ankiDialogOpen: boolean;
    ankiDialogFinishedRequest?: AnkiDialogFinishedRequest;
    origin: string;
    onError: (error: any) => void;
    onUnloadVideo: (url: string) => void;
    onCopy: (card: CardModel, postMineAction: PostMineAction | undefined, id: string | undefined) => void;
    onLoaded: (file: File[]) => void;
    onTabSelected: (tab: VideoTabModel) => void;
    onAnkiDialogRequest: () => void;
    onAnkiDialogRewind: () => void;
    onAppBarToggle: () => void;
    onFullscreenToggle: () => void;
    onHideSubtitlePlayer: () => void;
    onVideoPopOut: () => void;
    onPlayModeChangedViaBind: (oldPlayMode: PlayMode, newPlayMode: PlayMode) => void;
    onSubtitles: (subtitles: DisplaySubtitleModel[]) => void;
    onTakeScreenshot: (mediaTimestamp: number) => void;
    disableKeyEvents: boolean;
    jumpToSubtitle?: SubtitleModel;
    rewindSubtitle?: SubtitleModel;
    hideControls?: boolean;
    forceCompressedMode?: boolean;
}

export default function Player({
    sources,
    subtitles,
    subtitleReader,
    settings,
    playbackPreferences,
    keyBinder,
    extension,
    videoFrameRef,
    videoChannelRef,
    drawerOpen,
    appBarHidden,
    showCopyButton,
    copyButtonEnabled,
    videoFullscreen,
    hideSubtitlePlayer,
    videoPopOut,
    tab,
    availableTabs,
    ankiDialogRequested,
    ankiDialogFinishedRequest,
    ankiDialogOpen,
    origin,
    onError,
    onUnloadVideo,
    onCopy,
    onLoaded,
    onTabSelected,
    onAnkiDialogRequest,
    onAnkiDialogRewind,
    onAppBarToggle,
    onFullscreenToggle,
    onHideSubtitlePlayer,
    onVideoPopOut,
    onPlayModeChangedViaBind,
    onSubtitles,
    onTakeScreenshot,
    disableKeyEvents,
    jumpToSubtitle,
    rewindSubtitle,
    hideControls,
    forceCompressedMode,
}: PlayerProps) {
    const [playMode, setPlayMode] = useState<PlayMode>(PlayMode.normal);
    const [subtitlesSentThroughChannel, setSubtitlesSentThroughChannel] = useState<boolean>();
    const subtitlesRef = useRef<DisplaySubtitleModel[]>();
    subtitlesRef.current = subtitles;
    const subtitleCollection = useMemo<SubtitleCollection<DisplaySubtitleModel>>(
        () =>
            new SubtitleCollection(subtitles ?? [], {
                returnLastShown: true,
                returnNextToShow: playMode === PlayMode.condensed,
                showingCheckRadiusMs: 100,
            }),
        [subtitles, playMode]
    );
    const subtitleFiles = sources?.subtitleFiles;
    const flattenSubtitleFiles = sources?.flattenSubtitleFiles;
    const videoFile = sources?.videoFile;
    const videoFileUrl = sources?.videoFileUrl;
    const playModeEnabled = subtitles && subtitles.length > 0 && Boolean(videoFileUrl);
    const [loadingSubtitles, setLoadingSubtitles] = useState<boolean>(false);
    const [playing, setPlaying] = useState<boolean>(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [, updateState] = useState<any>();
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [channelId, setChannelId] = useState<string>();
    const [channel, setChannel] = useState<VideoChannel>();
    const channelRef = useRef<VideoChannel>();
    channelRef.current = channel;
    const playbackPreferencesRef = useRef<PlaybackPreferences>();
    playbackPreferencesRef.current = playbackPreferences;
    const [, setResumeOnFinishedAnkiDialogRequest] = useState<boolean>(false);
    const hideSubtitlePlayerRef = useRef<boolean>();
    hideSubtitlePlayerRef.current = hideSubtitlePlayer;
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [track: number]: boolean }>({});
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const mediaAdapter = useMemo(() => {
        if (videoFileUrl || tab) {
            return new MediaAdapter({ current: channel });
        }

        return new MediaAdapter({ current: null });
    }, [channel, videoFileUrl, tab]);
    const clock = useMemo<Clock>(() => new Clock(), []);
    const classes = useStyles({ appBarHidden });
    const calculateLength = () => trackLength(channelRef.current, subtitlesRef.current);

    const handleOnStartedShowingSubtitle = useCallback(() => {
        if (
            playMode !== PlayMode.autoPause ||
            settings.autoPausePreference !== AutoPausePreference.atStart ||
            videoFileUrl // Let VideoPlayer do the auto-pausing
        ) {
            return;
        }

        pause(clock, mediaAdapter, true);
    }, [playMode, clock, mediaAdapter, videoFileUrl, settings]);

    const handleOnWillStopShowingSubtitle = useCallback(() => {
        if (
            playMode !== PlayMode.autoPause ||
            settings.autoPausePreference !== AutoPausePreference.atEnd ||
            videoFileUrl // Let VideoPlayer do the auto-pausing
        ) {
            return;
        }

        pause(clock, mediaAdapter, true);
    }, [playMode, clock, mediaAdapter, videoFileUrl, settings]);

    const autoPauseContext = useMemo(() => {
        const context = new AutoPauseContext();
        context.onStartedShowing = handleOnStartedShowingSubtitle;
        context.onWillStopShowing = handleOnWillStopShowingSubtitle;
        return context;
    }, [handleOnStartedShowingSubtitle, handleOnWillStopShowingSubtitle]);
    const autoPauseContextRef = useRef<AutoPauseContext>();
    autoPauseContextRef.current = autoPauseContext;

    const seek = useCallback(
        async (time: number, clock: Clock, forwardToMedia: boolean) => {
            clock.setTime(time);
            forceUpdate();

            if (forwardToMedia) {
                await mediaAdapter.seek(time / 1000);
            }

            autoPauseContextRef.current?.clear();
        },
        [forceUpdate, mediaAdapter]
    );

    const updatePlaybackRate = useCallback(
        (playbackRate: number, forwardToMedia: boolean) => {
            clock.rate = playbackRate;
            setPlaybackRate(playbackRate);

            if (forwardToMedia) {
                mediaAdapter.playbackRate(playbackRate);
            }
        },
        [clock, mediaAdapter]
    );

    const applyOffset = useCallback(
        (offset: number, forwardToVideo: boolean) => {
            setOffset(offset);

            if (!subtitles) {
                return;
            }

            const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end + offset : 0;

            const newSubtitles = subtitles.map((s, i) => ({
                text: s.text,
                textImage: s.textImage,
                start: s.originalStart + offset,
                originalStart: s.originalStart,
                end: s.originalEnd + offset,
                originalEnd: s.originalEnd,
                displayTime: timeDurationDisplay(s.originalStart + offset, length),
                track: s.track,
                index: i,
            }));

            if (forwardToVideo) {
                if (channel !== undefined) {
                    channel.offset(offset);

                    // Older versions of extension don't support the offset message
                    if (tab !== undefined && extension.installed && !extension.supportsOffsetMessage) {
                        channel.subtitles(newSubtitles, subtitleFiles?.map((f) => f.name) ?? ['']);
                    }
                }
            }

            onSubtitles(newSubtitles);
            playbackPreferences.offset = offset;
        },
        [subtitleFiles, subtitles, extension, playbackPreferences, tab, channel, onSubtitles]
    );

    useEffect(() => {
        if (!videoFile && !tab) {
            return;
        }

        let channel: VideoChannel;

        if (videoFile) {
            const channelId = uuidv4();
            channel = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
            setChannelId(channelId);
            onLoaded([videoFile]);
        } else {
            channel = new VideoChannel(new ChromeTabVideoProtocol(tab!.id, tab!.src, extension));
            channel.init();
        }

        if (videoChannelRef) {
            videoChannelRef.current = channel;
        }

        setChannel(channel);

        return () => {
            clock.setTime(0);
            clock.stop();
            setPlaying(false);
            channel.close();
        };
    }, [clock, videoPopOut, videoFile, tab, extension, videoChannelRef, onLoaded]);

    useEffect(() => {
        async function init() {
            const offset = playbackPreferencesRef.current?.offset ?? 0;
            setOffset(offset);
            let subtitles: DisplaySubtitleModel[] | undefined;

            if (subtitleFiles !== undefined && subtitleFiles.length > 0) {
                setLoadingSubtitles(true);

                try {
                    const nodes = await subtitleReader.subtitles(subtitleFiles, flattenSubtitleFiles);
                    const length = nodes.length > 0 ? nodes[nodes.length - 1].end + offset : 0;

                    subtitles = nodes.map((s, i) => ({
                        text: s.text,
                        textImage: s.textImage,
                        start: s.start + offset,
                        originalStart: s.start,
                        end: s.end + offset,
                        originalEnd: s.end,
                        displayTime: timeDurationDisplay(s.start + offset, length),
                        track: s.track,
                        index: i,
                    }));

                    setSubtitlesSentThroughChannel(false);
                    onSubtitles(subtitles);
                    setPlayMode((playMode) => (!subtitles || subtitles.length === 0 ? PlayMode.normal : playMode));
                } catch (e) {
                    onError(e);
                    onSubtitles([]);
                } finally {
                    setLoadingSubtitles(false);
                }
            } else {
                subtitles = undefined;
                setPlayMode(PlayMode.normal);
            }
        }

        init().then(() => onLoaded(subtitleFiles ?? []));
    }, [subtitleReader, onLoaded, onError, subtitleFiles, flattenSubtitleFiles, onSubtitles]);

    useEffect(() => {
        setSubtitlesSentThroughChannel(false);
    }, [channel]);

    useEffect(
        () => channel?.onExit(() => videoFileUrl && onUnloadVideo(videoFileUrl)),
        [channel, onUnloadVideo, videoFileUrl]
    );
    useEffect(() => channel?.onPopOutToggle(() => onVideoPopOut()), [channel, onVideoPopOut]);
    useEffect(() => channel?.onHideSubtitlePlayerToggle(onHideSubtitlePlayer), [channel, onHideSubtitlePlayer]);
    useEffect(() => channel?.onAppBarToggle(onAppBarToggle), [channel, onAppBarToggle]);
    useEffect(() => channel?.onFullscreenToggle(onFullscreenToggle), [channel, onFullscreenToggle]);
    useEffect(
        () =>
            channel?.onReady(() => {
                return channel?.ready(trackLength(channel, subtitles), videoFile?.name);
            }),
        [channel, subtitles, videoFile]
    );
    useEffect(() => {
        if (
            channel === undefined ||
            subtitles === undefined ||
            subtitlesSentThroughChannel ||
            subtitleFiles === undefined
        ) {
            return;
        }

        return channel.onReady(() => {
            setSubtitlesSentThroughChannel(true);
            channel.subtitles(
                subtitles,
                flattenSubtitleFiles ? [subtitleFiles[0].name] : subtitleFiles.map((f) => f.name)
            );
        });
    }, [subtitles, channel, flattenSubtitleFiles, subtitleFiles, subtitlesSentThroughChannel]);
    useEffect(() => channel?.onReady(() => channel?.subtitleSettings(settings)), [channel, settings]);
    useEffect(() => channel?.ankiSettings(settings), [channel, settings]);
    useEffect(() => channel?.miscSettings(settings), [channel, settings]);
    useEffect(() => channel?.playMode(playMode), [channel, playMode]);
    useEffect(() => channel?.hideSubtitlePlayerToggle(hideSubtitlePlayer), [channel, hideSubtitlePlayer]);
    useEffect(
        () =>
            channel?.onReady(() => {
                if (channel?.audioTracks && channel?.audioTracks?.length > 1) {
                    setAudioTracks(channel?.audioTracks);
                    setSelectedAudioTrack(channel?.selectedAudioTrack);
                } else {
                    setAudioTracks(undefined);
                    setSelectedAudioTrack(undefined);
                }
            }),
        [channel]
    );
    useEffect(
        () =>
            channel?.onReady((paused) => {
                if (channel) {
                    clock.setTime(channel.currentTime * 1000);
                }

                if (paused) {
                    clock.stop();
                } else {
                    clock.start();
                }

                setPlaying(!paused);

                if (channel?.playbackRate) {
                    clock.rate = channel.playbackRate;
                    setPlaybackRate(channel.playbackRate);
                }
            }),
        [channel, clock]
    );
    useEffect(
        () => channel?.onPlay((forwardToMedia) => play(clock, mediaAdapter, forwardToMedia)),
        [channel, mediaAdapter, clock]
    );
    useEffect(
        () => channel?.onPause((forwardToMedia) => pause(clock, mediaAdapter, forwardToMedia)),
        [channel, mediaAdapter, clock]
    );
    useEffect(() => {
        return channel?.onOffset((offset) => applyOffset(Math.max(-calculateLength() ?? 0, offset), false));
    }, [channel, applyOffset]);
    useEffect(() => channel?.onPlaybackRate(updatePlaybackRate), [channel, updatePlaybackRate]);
    useEffect(
        () =>
            channel?.onCopy((subtitle, surroundingSubtitles, audio, image, url, postMineAction, id, mediaTimestamp) =>
                onCopy(
                    {
                        subtitle,
                        surroundingSubtitles,
                        subtitleFileName: subtitle ? subtitleFiles?.[subtitle.track]?.name ?? '' : '',
                        mediaTimestamp: mediaTimestamp ?? 0,
                        file: videoFile
                            ? {
                                  name: videoFile.name,
                                  blobUrl: URL.createObjectURL(videoFile),
                                  audioTrack: channel?.selectedAudioTrack,
                                  playbackRate: channel?.playbackRate,
                              }
                            : undefined,
                        audio,
                        image,
                        url,
                    },
                    postMineAction,
                    id
                )
            ),
        [channel, onCopy, videoFile, subtitleFiles]
    );
    useEffect(
        () =>
            channel?.onPlayMode((playMode) => {
                setPlayMode(playMode);
                channel?.playMode(playMode);
            }),
        [channel, playMode]
    );
    useEffect(
        () =>
            channel?.onCurrentTime(async (currentTime, forwardToMedia) => {
                const playing = clock.running;

                if (playing) {
                    clock.stop();
                }

                await seek(currentTime * 1000, clock, forwardToMedia);

                if (playing) {
                    clock.start();
                }
            }),
        [channel, clock, seek]
    );
    useEffect(
        () =>
            channel?.onAudioTrackSelected(async (id) => {
                if (playing) {
                    clock.stop();
                }

                await mediaAdapter.onReady();
                if (playing) {
                    clock.start();
                }

                setSelectedAudioTrack(id);
            }),
        [channel, clock, mediaAdapter, playing]
    );
    useEffect(() => channel?.onAnkiDialogRequest(() => onAnkiDialogRequest()), [channel, onAnkiDialogRequest]);
    useEffect(
        () =>
            channel?.onToggleSubtitleTrackInList((track) =>
                setDisabledSubtitleTracks((tracks) => {
                    const newTracks = { ...tracks };
                    newTracks[track] = !tracks[track];
                    return newTracks;
                })
            ),
        [channel]
    );
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
        if (ankiDialogFinishedRequest && ankiDialogFinishedRequest.timestamp > 0) {
            setResumeOnFinishedAnkiDialogRequest((resumeOnFinishedAnkiDialogRequest) => {
                if (resumeOnFinishedAnkiDialogRequest && ankiDialogFinishedRequest.resume) {
                    play(clock, mediaAdapter, true);
                }

                return false;
            });
        }
    }, [ankiDialogFinishedRequest, clock, mediaAdapter]);

    useEffect(() => {
        if (ankiDialogRequested && playing) {
            pause(clock, mediaAdapter, true);
            setResumeOnFinishedAnkiDialogRequest(true);
        }
    }, [ankiDialogRequested, clock, mediaAdapter, playing]);

    useEffect(() => {
        if (playMode !== PlayMode.condensed) {
            return;
        }

        if (!subtitles || subtitles.length === 0) {
            return;
        }

        let seeking = false;
        let expectedSeekTime = 1000;

        const interval = setInterval(async () => {
            const timestamp = clock.time(calculateLength());
            const slice = subtitleCollection.subtitlesAt(timestamp);

            if (slice.nextToShow && slice.nextToShow.length > 0) {
                const nextSubtitle = slice.nextToShow[0];

                if (nextSubtitle.start - timestamp < expectedSeekTime + 500) {
                    return;
                }

                if (playing) {
                    clock.stop();
                }

                if (!seeking) {
                    seeking = true;
                    const t0 = Date.now();
                    await seek(nextSubtitle.start, clock, true);
                    expectedSeekTime = Date.now() - t0;
                    seeking = false;
                }

                if (playing) {
                    clock.start();
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [subtitles, subtitleCollection, playMode, clock, seek, playing]);

    useEffect(() => {
        if (videoPopOut && videoFileUrl && channelId) {
            window.open(
                origin + '?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=true',
                'asbplayer-video-' + videoFileUrl,
                'resizable,width=800,height=450'
            );
        }

        setLastJumpToTopTimestamp(Date.now());
    }, [videoPopOut, channelId, videoFileUrl, videoFrameRef, videoChannelRef, origin]);

    const handlePlay = useCallback(() => play(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handlePause = useCallback(() => pause(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handleSeek = useCallback(
        async (progress: number) => {
            if (playing) {
                clock.stop();
            }

            await seek(progress * calculateLength(), clock, true);

            if (playing) {
                clock.start();
            }
        },
        [clock, seek, playing]
    );

    const handleSeekToTimestamp = useCallback(
        async (time: number, shouldPlay: boolean) => {
            if (!shouldPlay) {
                pause(clock, mediaAdapter, true);
            }

            await seek(time, clock, true);

            if (shouldPlay && !playing) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
            }
        },
        [clock, seek, mediaAdapter, playing]
    );

    const handleCopyFromSubtitlePlayer = useCallback(
        async (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            postMineAction: PostMineAction,
            forceUseGivenSubtitle?: boolean
        ) => {
            if (videoFileUrl) {
                if (forceUseGivenSubtitle) {
                    channel?.copy(postMineAction, subtitle, surroundingSubtitles);
                } else {
                    // Let VideoPlayer do the copying to ensure copied subtitle is consistent with the VideoPlayer clock
                    channel?.copy(postMineAction);
                }
            } else {
                onCopy(
                    {
                        subtitle,
                        surroundingSubtitles,
                        subtitleFileName: subtitleFiles?.[subtitle.track]?.name ?? '',
                        mediaTimestamp: clock.time(calculateLength()),
                        file:
                            videoFile === undefined
                                ? undefined
                                : {
                                      name: videoFile.name,
                                      audioTrack: selectedAudioTrack,
                                      playbackRate,
                                      blobUrl: URL.createObjectURL(videoFile),
                                  },
                    },
                    postMineAction,
                    undefined
                );
            }
        },
        [channel, onCopy, clock, videoFile, videoFileUrl, subtitleFiles, selectedAudioTrack, playbackRate]
    );

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    }, []);

    const handleAudioTrackSelected = useCallback(
        async (id: string) => {
            channel?.audioTrackSelected(id);
            pause(clock, mediaAdapter, true);

            await seek(0, clock, true);

            if (playing) {
                play(clock, mediaAdapter, true);
            }
        },
        [channel, clock, mediaAdapter, seek, playing]
    );

    const handleOffsetChange = useCallback(
        (offset: number) => {
            const length = calculateLength();
            applyOffset(Math.max(-length ?? 0, offset), true);
        },
        [applyOffset]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            updatePlaybackRate(playbackRate, true);
        },
        [updatePlaybackRate]
    );

    const handlePlayMode = useCallback((playMode: PlayMode) => setPlayMode(playMode), []);

    const handleToggleSubtitleTrack = useCallback(
        (track: number) =>
            setDisabledSubtitleTracks((tracks) => {
                const newTracks = { ...tracks };
                newTracks[track] = !tracks[track];
                return newTracks;
            }),
        []
    );

    const handleSubtitlesSelected = useCallback(
        (subtitles: SubtitleModel[]) => {
            if (subtitles.length === 0 || !settings.autoCopyCurrentSubtitle || !document.hasFocus()) {
                return;
            }

            navigator.clipboard.writeText(subtitles.map((s) => s.text).join('\n')).catch((e) => {
                // ignore
            });
        },
        [settings.autoCopyCurrentSubtitle]
    );

    useEffect(() => {
        if (tab) {
            return;
        }

        const interval = setInterval(async () => {
            const progress = clock.progress(calculateLength());

            if (progress >= 1) {
                pause(clock, mediaAdapter, true);
                await seek(0, clock, true);
                setLastJumpToTopTimestamp(Date.now());
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, mediaAdapter, seek, tab]);

    useEffect(() => {
        const unbind = keyBinder.bindPlay(
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
    }, [keyBinder, playing, clock, mediaAdapter, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                event.preventDefault();
                if (increase) {
                    updatePlaybackRate(Math.min(5, playbackRate + 0.1), true);
                } else {
                    updatePlaybackRate(Math.max(0.1, playbackRate - 0.1), true);
                }
            },
            () => disableKeyEvents
        );
    }, [updatePlaybackRate, playbackRate, disableKeyEvents, keyBinder]);

    const togglePlayMode = useCallback(
        (event: KeyboardEvent, togglePlayMode: PlayMode) => {
            if (!playModeEnabled) {
                return;
            }

            event.preventDefault();
            const newPlayMode = playMode === togglePlayMode ? PlayMode.normal : togglePlayMode;
            setPlayMode(newPlayMode);
            onPlayModeChangedViaBind(playMode, newPlayMode);
            channel?.playMode(newPlayMode);
        },
        [channel, playMode, playModeEnabled, onPlayModeChangedViaBind]
    );

    useEffect(() => {
        return keyBinder.bindAutoPause(
            (event) => togglePlayMode(event, PlayMode.autoPause),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindCondensedPlayback(
            (event) => togglePlayMode(event, PlayMode.condensed),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        if (!videoFileUrl) {
            return;
        }

        return keyBinder.bindTakeScreenshot(
            (event) => {
                event.preventDefault();

                if (ankiDialogOpen) {
                    onAnkiDialogRewind();
                } else {
                    onTakeScreenshot(clock.time(calculateLength()));
                }
            },
            () => false
        );
    }, [videoFileUrl, clock, onTakeScreenshot, onAnkiDialogRewind, keyBinder, disableKeyEvents, ankiDialogOpen]);

    useEffect(() => channel?.appBarToggle(appBarHidden), [channel, appBarHidden]);
    useEffect(() => channel?.hideSubtitlePlayerToggle(hideSubtitlePlayer), [channel, hideSubtitlePlayer]);
    useEffect(() => channel?.fullscreenToggle(videoFullscreen), [channel, videoFullscreen]);

    useEffect(() => {
        if (rewindSubtitle?.start === undefined) {
            return;
        }

        pause(clock, mediaAdapter, true);
        seek(rewindSubtitle.start, clock, true);
    }, [clock, rewindSubtitle?.start, mediaAdapter, seek]);

    const loaded = videoFileUrl || subtitles;
    const videoInWindow = Boolean(loaded && videoFileUrl && !videoPopOut);
    const actuallyHideSubtitlePlayer = videoInWindow && (hideSubtitlePlayer || !subtitles || subtitles?.length === 0);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            <Grid container direction="row" wrap="nowrap" className={classes.container}>
                {videoInWindow && (
                    <Grid item style={{ flexGrow: 1, minWidth: 400 }}>
                        <iframe
                            ref={videoFrameRef}
                            className={classes.videoFrame}
                            src={
                                origin +
                                '?video=' +
                                encodeURIComponent(videoFileUrl!) +
                                '&channel=' +
                                channelId +
                                '&popout=false'
                            }
                            title="asbplayer"
                        />
                    </Grid>
                )}

                {!actuallyHideSubtitlePlayer && (
                    <Grid
                        item
                        style={{
                            flexGrow: videoInWindow ? 0 : 1,
                            width: 'auto',
                        }}
                    >
                        {loaded && !(videoFileUrl && !videoPopOut) && !hideControls && (
                            <Controls
                                mousePositionRef={mousePositionRef}
                                playing={playing}
                                clock={clock}
                                length={calculateLength()}
                                displayLength={trackLength(channel, subtitles, false)}
                                audioTracks={audioTracks}
                                selectedAudioTrack={selectedAudioTrack}
                                tabs={(!videoFileUrl && availableTabs) || undefined}
                                selectedTab={tab}
                                videoFile={videoFile?.name}
                                offsetEnabled={true}
                                offset={offset}
                                playbackRate={playbackRate}
                                playbackRateEnabled={!tab || extension.supportsPlaybackRateMessage}
                                onPlaybackRateChange={handlePlaybackRateChange}
                                playModeEnabled={playModeEnabled}
                                playMode={playMode}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onSeek={handleSeek}
                                onAudioTrackSelected={handleAudioTrackSelected}
                                onTabSelected={onTabSelected}
                                onUnloadVideo={() => videoFileUrl && onUnloadVideo(videoFileUrl)}
                                onOffsetChange={handleOffsetChange}
                                onPlayMode={handlePlayMode}
                                disableKeyEvents={disableKeyEvents}
                                playbackPreferences={playbackPreferences}
                                showOnMouseMovement={true}
                            />
                        )}
                        <SubtitlePlayer
                            playing={playing}
                            subtitles={subtitles}
                            subtitleCollection={subtitleCollection}
                            clock={clock}
                            length={calculateLength()}
                            jumpToSubtitle={jumpToSubtitle}
                            drawerOpen={drawerOpen}
                            appBarHidden={appBarHidden}
                            compressed={videoInWindow || (forceCompressedMode ?? false)}
                            resizable={videoInWindow}
                            showCopyButton={showCopyButton}
                            copyButtonEnabled={copyButtonEnabled}
                            loading={loadingSubtitles}
                            displayHelp={(videoPopOut && videoFile?.name) || undefined}
                            disableKeyEvents={disableKeyEvents}
                            // The VideoPlayer will receive the mining commands instead
                            disableMiningBinds={extension.installed && videoFile !== undefined}
                            lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                            hidden={videoInWindow && hideSubtitlePlayer}
                            disabledSubtitleTracks={disabledSubtitleTracks}
                            onSeek={handleSeekToTimestamp}
                            onCopy={handleCopyFromSubtitlePlayer}
                            onOffsetChange={handleOffsetChange}
                            onToggleSubtitleTrack={handleToggleSubtitleTrack}
                            onSubtitlesSelected={handleSubtitlesSelected}
                            autoPauseContext={autoPauseContext}
                            settings={settings}
                            keyBinder={keyBinder}
                        />
                    </Grid>
                )}
            </Grid>
        </div>
    );
}
