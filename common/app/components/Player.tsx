import React, { useEffect, useState, useMemo, useCallback, useRef, MutableRefObject } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioTrackModel,
    AutoPauseContext,
    AutoPausePreference,
    CardModel,
    CardTextFieldValues,
    PlayMode,
    PostMineAction,
    PostMinePlayback,
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
import Grid from '@mui/material/Grid';
import MediaAdapter, { MediaElement } from '../services/media-adapter';
import SubtitlePlayer, { DisplaySubtitleModel, minSubtitlePlayerWidth } from './SubtitlePlayer';
import VideoChannel from '../services/video-channel';
import ChromeExtension from '../services/chrome-extension';
import PlaybackPreferences from '../services/playback-preferences';
import PlayModeManager from '../services/play-mode-manager';
import { useWindowSize } from '../hooks/use-window-size';
import { useAppBarHeight } from '../hooks/use-app-bar-height';
import { createBlobUrl } from '../../blob-url';
import { MiningContext } from '../services/mining-context';
import { SeekTimestampCommand, WebSocketClient } from '../../web-socket-client';

const minVideoPlayerWidth = 300;

interface StylesProps {
    appBarHidden: boolean;
    appBarHeight: number;
}

const useStyles = makeStyles<Theme, StylesProps>(() => ({
    root: ({ appBarHidden, appBarHeight }) => ({
        height: appBarHidden ? '100vh' : `calc(100vh - ${appBarHeight}px)`,
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
}));

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
    videoFullscreen: boolean;
    hideSubtitlePlayer: boolean;
    videoPopOut: boolean;
    tab?: VideoTabModel;
    availableTabs: VideoTabModel[];
    miningContext: MiningContext;
    origin: string;
    onError: (error: any) => void;
    onUnloadVideo: (url: string) => void;
    onCopy: (card: CardModel, postMineAction: PostMineAction | undefined, id: string | undefined) => void;
    onLoaded: (file: File[]) => void;
    onTabSelected: (tab: VideoTabModel) => void;
    onAnkiDialogRequest: () => void;
    onAnkiDialogRewind: () => void;
    onAppBarToggle: () => void;
    onHideSubtitlePlayer: () => void;
    onVideoPopOut: () => void;
    onPlayModeChangedViaBind: (playModes: Set<PlayMode>, targetMode: PlayMode) => void;
    onSubtitles: (subtitles: DisplaySubtitleModel[]) => void;
    onLoadFiles?: () => void;
    disableKeyEvents: boolean;
    jumpToSubtitle?: SubtitleModel;
    rewindSubtitle?: SubtitleModel;
    hideControls?: boolean;
    forceCompressedMode?: boolean;
    webSocketClient?: WebSocketClient;
}

const Player = React.memo(function Player({
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
    videoFullscreen,
    hideSubtitlePlayer,
    videoPopOut,
    tab,
    availableTabs,
    miningContext,
    origin,
    onError,
    onUnloadVideo,
    onCopy,
    onLoaded,
    onTabSelected,
    onAnkiDialogRequest,
    onAppBarToggle,
    onHideSubtitlePlayer,
    onVideoPopOut,
    onPlayModeChangedViaBind,
    onSubtitles,
    onLoadFiles,
    disableKeyEvents,
    jumpToSubtitle,
    rewindSubtitle,
    hideControls,
    forceCompressedMode,
    webSocketClient,
}: PlayerProps) {
    const [playModes, setPlayModes] = useState<Set<PlayMode>>(new Set([PlayMode.normal]));
    const playModesRef = useRef<Set<PlayMode>>(new Set([PlayMode.normal]));
    const pendingTimeRef = useRef<number>(0);
    const lastSeekDurationRef = useRef<number>(0);
    const [subtitlesSentThroughChannel, setSubtitlesSentThroughChannel] = useState<boolean>();
    const subtitlesRef = useRef<DisplaySubtitleModel[]>(undefined);
    subtitlesRef.current = subtitles;
    const subtitleCollection = useMemo<SubtitleCollection<DisplaySubtitleModel>>(
        () =>
            new SubtitleCollection(subtitles ?? [], {
                returnLastShown: true,
                returnNextToShow: playModes.has(PlayMode.condensed) || playModes.has(PlayMode.fastForward),
                showingCheckRadiusMs: 100,
            }),
        [subtitles, playModes]
    );
    const subtitleFiles = sources?.subtitleFiles;
    const flattenSubtitleFiles = sources?.flattenSubtitleFiles;
    const videoFile = sources?.videoFile;
    const videoFileUrl = sources?.videoFileUrl;
    const playModeEnabled = subtitles && subtitles.length > 0 && Boolean(videoFileUrl);
    const [subtitlePlayerResizing, setSubtitlePlayerResizing] = useState<boolean>(false);
    const [loadingSubtitles, setLoadingSubtitles] = useState<boolean>(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [channelId, setChannelId] = useState<string>();
    const [channel, setChannel] = useState<VideoChannel>();
    const channelRef = useRef<VideoChannel>(undefined);
    channelRef.current = channel;
    const playbackPreferencesRef = useRef<PlaybackPreferences>(undefined);
    playbackPreferencesRef.current = playbackPreferences;
    const [wasPlayingWhenMiningStarted, setWasPlayingWhenMiningStarted] = useState<boolean>();
    const hideSubtitlePlayerRef = useRef<boolean>(undefined);
    hideSubtitlePlayerRef.current = hideSubtitlePlayer;
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [track: number]: boolean }>({});
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const mediaAdapter = useMemo(() => {
        if (videoFileUrl || tab) {
            return new MediaAdapter({ current: channel });
        }

        return new MediaAdapter({ current: undefined });
    }, [channel, videoFileUrl, tab]);
    const clock = useMemo<Clock>(() => new Clock(), []);
    const appBarHeight = useAppBarHeight();
    const classes = useStyles({ appBarHidden, appBarHeight });
    const calculateLength = () => trackLength(channelRef.current, subtitlesRef.current);

    useEffect(() => {
        playModesRef.current = playModes;
    }, [playModes]);

    const seek = useCallback(
        async (time: number, clock: Clock, forwardToMedia: boolean) => {
            clock.setTime(time);

            if (forwardToMedia) {
                await mediaAdapter.seek(time / 1000);
            }

            autoPauseContextRef.current?.clear();
        },
        [mediaAdapter]
    );

    const handleSubtitlePlayerResizeStart = useCallback(() => setSubtitlePlayerResizing(true), []);
    const handleSubtitlePlayerResizeEnd = useCallback(() => setSubtitlePlayerResizing(false), []);

    const handleOnStartedShowingSubtitle = useCallback(() => {
        if (
            !playModes.has(PlayMode.autoPause) ||
            settings.autoPausePreference !== AutoPausePreference.atStart ||
            videoFileUrl // Let VideoPlayer do the auto-pausing
        ) {
            return;
        }

        pause(clock, mediaAdapter, true);
    }, [playModes, clock, mediaAdapter, videoFileUrl, settings.autoPausePreference]);

    const handleOnWillStopShowingSubtitle = useCallback(
        async (subtitle: SubtitleModel) => {
            pendingTimeRef.current = 0;

            const isAutoPauseAtEndEnabled =
                playModes.has(PlayMode.autoPause) && settings.autoPausePreference === AutoPausePreference.atEnd;
            const isAutoPauseAtStartEnabled =
                playModes.has(PlayMode.autoPause) && settings.autoPausePreference === AutoPausePreference.atStart;
            const isRepeatEnabled = playModes.has(PlayMode.repeat);
            const isCondensedEnabled = playModes.has(PlayMode.condensed);

            if (!isAutoPauseAtEndEnabled && !isRepeatEnabled && !isAutoPauseAtStartEnabled) return;

            if (isAutoPauseAtEndEnabled && !videoFileUrl) {
                pause(clock, mediaAdapter, true);
            }

            if (isRepeatEnabled) {
                if (isAutoPauseAtEndEnabled) {
                    pendingTimeRef.current = subtitle.start;
                } else {
                    seek(subtitle.start, clock, true);
                }
                return;
            }

            if (isCondensedEnabled) {
                const slice = subtitleCollection.subtitlesAt(subtitle.end + 1);

                if (slice.nextToShow && slice.nextToShow.length > 0) {
                    const nextSubtitle = slice.nextToShow[0];
                    const timeGap = nextSubtitle.start - subtitle.end;

                    const baseThreshold = lastSeekDurationRef.current || 1000;
                    const safetyBuffer = 500;
                    const seekThreshold = baseThreshold + safetyBuffer;

                    if (timeGap < seekThreshold) {
                        return;
                    }

                    if (isAutoPauseAtEndEnabled) {
                        pendingTimeRef.current = nextSubtitle.start;
                    } else {
                        const wasPlaying = clock.running;

                        if (wasPlaying) clock.stop();

                        const t0 = Date.now();
                        await seek(nextSubtitle.start, clock, true);
                        lastSeekDurationRef.current = Date.now() - t0;

                        if (wasPlaying) clock.start();
                    }
                }
            }
        },
        [playModes, clock, mediaAdapter, videoFileUrl, settings.autoPausePreference, seek, subtitleCollection]
    );

    const autoPauseContext = useMemo(() => {
        const context = new AutoPauseContext();
        context.onStartedShowing = handleOnStartedShowingSubtitle;
        context.onWillStopShowing = handleOnWillStopShowingSubtitle;
        return context;
    }, [handleOnStartedShowingSubtitle, handleOnWillStopShowingSubtitle]);
    const autoPauseContextRef = useRef<AutoPauseContext>(undefined);
    autoPauseContextRef.current = autoPauseContext;

    const updatePlaybackRate = useCallback(
        (playbackRate: number, forwardToMedia: boolean) => {
            if (clock.rate !== playbackRate) {
                clock.rate = playbackRate;
                setPlaybackRate(playbackRate);

                if (forwardToMedia) {
                    mediaAdapter.playbackRate(playbackRate);
                }
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
                    setPlayModes((playModes) =>
                        !subtitles || subtitles.length === 0 ? new Set([PlayMode.normal]) : playModes
                    );
                } catch (e) {
                    onError(e);
                    onSubtitles([]);
                } finally {
                    setLoadingSubtitles(false);
                }
            } else {
                subtitles = undefined;
                setPlayModes(new Set([PlayMode.normal]));
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
            subtitleFiles === undefined ||
            subtitleFiles.length === 0
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
    useEffect(
        () => channel?.onReady(() => channel?.hideSubtitlePlayerToggle(hideSubtitlePlayer)),
        [channel, hideSubtitlePlayer]
    );
    useEffect(() => channel?.ankiSettings(settings), [channel, settings]);
    useEffect(() => channel?.miscSettings(settings), [channel, settings]);
    useEffect(() => channel?.playModes(playModes), [channel, playModes]);
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
        return channel?.onOffset((offset) => applyOffset(Math.max(-calculateLength() || 0, offset), false));
    }, [channel, applyOffset]);
    useEffect(() => channel?.onPlaybackRate(updatePlaybackRate), [channel, updatePlaybackRate]);
    useEffect(
        () =>
            channel?.onCopy(
                (
                    subtitle,
                    surroundingSubtitles,
                    cardTextFieldValues,
                    audio,
                    image,
                    url,
                    postMineAction,
                    id,
                    mediaTimestamp
                ) =>
                    onCopy(
                        {
                            subtitle,
                            surroundingSubtitles,
                            subtitleFileName: subtitle ? (subtitleFiles?.[subtitle.track]?.name ?? '') : '',
                            ...cardTextFieldValues,
                            mediaTimestamp: mediaTimestamp ?? 0,
                            file: videoFile
                                ? {
                                      name: videoFile.name,
                                      blobUrl: createBlobUrl(videoFile),
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
            channel?.onPlayModes((playModes) => {
                setPlayModes(playModes);
                channel?.playModes(playModes);
            }),
        [channel, playModes]
    );
    useEffect(
        () =>
            channel?.onCurrentTime(async (currentTime, forwardToMedia) => {
                const playing = clock.running;
                const currentClockTime = clock.time(calculateLength()) / 1000;
                const timeDifference = Math.abs(currentTime - currentClockTime);

                if (playing) {
                    clock.stop();
                }

                if (timeDifference > 0.5) {
                    pendingTimeRef.current = 0;
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
                const playing = clock.running;

                if (playing) {
                    clock.stop();
                }

                await mediaAdapter.onReady();
                if (playing) {
                    clock.start();
                }

                setSelectedAudioTrack(id);
            }),
        [channel, clock, mediaAdapter]
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
    useEffect(() => channel?.onLoadFiles(() => onLoadFiles?.()), [channel, onLoadFiles]);
    const play = (clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) => {
        if (
            (playModesRef.current.has(PlayMode.repeat) || playModesRef.current.has(PlayMode.autoPause)) &&
            pendingTimeRef.current > 0
        ) {
            seek(pendingTimeRef.current, clock, forwardToMedia);
            pendingTimeRef.current = 0;
        }

        clock.start();

        if (forwardToMedia) {
            mediaAdapter.play();
        }
    };

    function pause(clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) {
        clock.stop();

        if (forwardToMedia) {
            mediaAdapter.pause();
        }
    }

    useEffect(() => {
        return miningContext.onEvent('stopped-mining', () => {
            switch (settings.postMiningPlaybackState) {
                case PostMinePlayback.play:
                    play(clock, mediaAdapter, true);
                    break;
                case PostMinePlayback.pause:
                    pause(clock, mediaAdapter, true);
                    break;
                case PostMinePlayback.remember:
                    if (wasPlayingWhenMiningStarted) {
                        play(clock, mediaAdapter, true);
                    }
                    break;
            }
        });
    }, [miningContext, settings, wasPlayingWhenMiningStarted, clock, mediaAdapter]);

    useEffect(() => {
        return miningContext.onEvent('started-mining', () => {
            if (clock.running) {
                pause(clock, mediaAdapter, true);
                setWasPlayingWhenMiningStarted(true);
            } else {
                setWasPlayingWhenMiningStarted(false);
            }
        });
    }, [miningContext, clock, mediaAdapter]);

    useEffect(() => {
        if (!playModes.has(PlayMode.condensed)) {
            return;
        }

        if (playModes.has(PlayMode.autoPause) || playModes.has(PlayMode.repeat)) return;

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

                const playing = clock.running;

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
    }, [subtitles, subtitleCollection, playModes, clock, seek]);

    useEffect(() => {
        if (!playModes.has(PlayMode.fastForward)) {
            return;
        }

        if (!subtitles || subtitles.length === 0) {
            return;
        }

        const interval = setInterval(async () => {
            const timestamp = clock.time(calculateLength());
            const slice = subtitleCollection.subtitlesAt(timestamp);

            if (
                slice.showing.length === 0 &&
                (slice.nextToShow === undefined ||
                    (slice.nextToShow.length > 0 && slice.nextToShow[0].start - timestamp > 1000))
            ) {
                updatePlaybackRate(settings.fastForwardModePlaybackRate, true);
            } else {
                updatePlaybackRate(1, true);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [updatePlaybackRate, subtitleCollection, clock, subtitles, playModes, settings.fastForwardModePlaybackRate]);

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
            const playing = clock.running;

            if (playing) {
                clock.stop();
            }

            pendingTimeRef.current = 0;
            await seek(progress * calculateLength(), clock, true);

            if (playing) {
                clock.start();
            }
        },
        [clock, seek]
    );

    const handleSeekToTimestamp = useCallback(
        async (time: number, shouldPlay: boolean) => {
            if (!shouldPlay) {
                pause(clock, mediaAdapter, true);
            }

            pendingTimeRef.current = 0;
            await seek(time, clock, true);

            if (shouldPlay && !clock.running) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
            }
        },
        [clock, seek, mediaAdapter]
    );

    const handleCopyFromSubtitlePlayer = useCallback(
        async (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            postMineAction: PostMineAction,
            forceUseGivenSubtitle?: boolean,
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            if (videoFileUrl) {
                if (forceUseGivenSubtitle) {
                    channel?.copy(postMineAction, subtitle, surroundingSubtitles, cardTextFieldValues);
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
                                      blobUrl: createBlobUrl(videoFile),
                                  },
                        ...cardTextFieldValues,
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

            pendingTimeRef.current = 0;
            await seek(0, clock, true);

            if (clock.running) {
                play(clock, mediaAdapter, true);
            }
        },
        [channel, clock, mediaAdapter, seek]
    );

    const handleOffsetChange = useCallback(
        (offset: number) => {
            const length = calculateLength();
            applyOffset(Math.max(-length || 0, offset), true);
        },
        [applyOffset]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            updatePlaybackRate(playbackRate, true);
        },
        [updatePlaybackRate]
    );

    const handlePlayMode = useCallback((targetMode: PlayMode) => {
        setPlayModes((prevModes) => {
            const manager = new PlayModeManager(prevModes);
            return manager.toggle(targetMode);
        });
    }, []);

    const handleToggleSubtitleTrack = useCallback(
        (track: number) =>
            setDisabledSubtitleTracks((tracks) => {
                const newTracks = { ...tracks };
                newTracks[track] = !tracks[track];
                return newTracks;
            }),
        []
    );

    const handleSubtitlesHighlighted = useCallback(
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

                pendingTimeRef.current = 0;
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

                if (clock.running) {
                    pause(clock, mediaAdapter, true);
                } else {
                    play(clock, mediaAdapter, true);
                }
            },
            () => disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, clock, mediaAdapter, disableKeyEvents]);

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
        (event: KeyboardEvent, targetMode: PlayMode) => {
            if (!playModeEnabled) {
                return;
            }

            event.preventDefault();

            setPlayModes((prevModes) => {
                const manager = new PlayModeManager(prevModes);

                if (targetMode === PlayMode.normal && prevModes.has(PlayMode.fastForward)) {
                    updatePlaybackRate(1, true);
                }

                if (targetMode === PlayMode.fastForward && prevModes.has(PlayMode.fastForward)) {
                    updatePlaybackRate(1, true);
                }

                const newModes = manager.toggle(targetMode, ({ shouldResetPlaybackRate }) => {
                    if (shouldResetPlaybackRate) {
                        updatePlaybackRate(1, true);
                    }
                });

                channel?.playModes(newModes);
                onPlayModeChangedViaBind(prevModes, targetMode);

                return newModes;
            });
        },
        [playModeEnabled, updatePlaybackRate, channel, onPlayModeChangedViaBind]
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
        return keyBinder.bindFastForwardPlayback(
            (event) => togglePlayMode(event, PlayMode.fastForward),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindToggleRepeat(
            (event) => {
                const length = calculateLength();
                const timestamp = clock.time(length);
                const slice = subtitleCollection.subtitlesAt(timestamp);

                if (slice.showing.length > 0) {
                    togglePlayMode(event, PlayMode.repeat);
                }
            },
            () => disableKeyEvents
        );
    }, [keyBinder, disableKeyEvents, togglePlayMode, subtitleCollection, clock]);

    useEffect(() => channel?.appBarToggle(appBarHidden), [channel, appBarHidden]);
    useEffect(() => channel?.fullscreenToggle(videoFullscreen), [channel, videoFullscreen]);

    useEffect(() => {
        if (rewindSubtitle?.start === undefined) {
            return;
        }

        pause(clock, mediaAdapter, true);

        pendingTimeRef.current = 0;
        seek(rewindSubtitle.start, clock, true);
    }, [clock, rewindSubtitle?.start, mediaAdapter, seek]);

    useEffect(() => {
        if (!webSocketClient) {
            return;
        }

        webSocketClient.onSeekTimestamp = async ({ body: { timestamp } }: SeekTimestampCommand) => {
            pendingTimeRef.current = 0;
            seek(timestamp * 1000, clock, true);
        };
    }, [webSocketClient, extension, seek, clock]);

    const [windowWidth] = useWindowSize(true);

    const loaded = videoFileUrl || subtitles;
    const videoInWindow = Boolean(loaded && videoFileUrl && !videoPopOut);
    const subtitlePlayerMaxResizeWidth = Math.max(0, windowWidth - minVideoPlayerWidth);
    const notEnoughSpaceForSubtitlePlayer = subtitlePlayerMaxResizeWidth < minSubtitlePlayerWidth;
    const actuallyHideSubtitlePlayer =
        videoInWindow &&
        (hideSubtitlePlayer || !subtitles || subtitles?.length === 0 || notEnoughSpaceForSubtitlePlayer);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            <Grid container direction="row" wrap="nowrap" className={classes.container}>
                {videoInWindow && (
                    <Grid item style={{ flexGrow: 1, minWidth: minVideoPlayerWidth }}>
                        <iframe
                            ref={videoFrameRef}
                            className={classes.videoFrame}
                            style={{
                                pointerEvents: subtitlePlayerResizing ? 'none' : 'auto',
                            }}
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

                <Grid
                    item
                    hidden={actuallyHideSubtitlePlayer}
                    style={{
                        flexGrow: videoInWindow ? 0 : 1,
                        width: 'auto',
                    }}
                >
                    {loaded && !(videoFileUrl && !videoPopOut) && !hideControls && (
                        <Controls
                            mousePositionRef={mousePositionRef}
                            clock={clock}
                            length={calculateLength()}
                            displayLength={trackLength(channel, subtitles, false)}
                            audioTracks={audioTracks}
                            selectedAudioTrack={selectedAudioTrack}
                            tabs={(!videoFileUrl && availableTabs) || undefined}
                            selectedTab={tab}
                            offsetEnabled={true}
                            offset={offset}
                            playbackRate={playbackRate}
                            playbackRateEnabled={!tab || extension.supportsPlaybackRateMessage}
                            onPlaybackRateChange={handlePlaybackRateChange}
                            playModeEnabled={playModeEnabled}
                            playModes={playModes}
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
                        subtitles={subtitles}
                        subtitleCollection={subtitleCollection}
                        clock={clock}
                        extension={extension}
                        length={calculateLength()}
                        jumpToSubtitle={jumpToSubtitle}
                        drawerOpen={drawerOpen}
                        appBarHidden={appBarHidden}
                        compressed={videoInWindow || (forceCompressedMode ?? false)}
                        resizable={videoInWindow}
                        showCopyButton={showCopyButton}
                        loading={loadingSubtitles}
                        displayHelp={(videoPopOut && videoFile?.name) || undefined}
                        disableKeyEvents={disableKeyEvents}
                        // On later versions of the extension, VideoPlayer will receive the mining commands instead
                        disableMiningBinds={extension.supportsVideoPlayerMiningCommands && videoFile !== undefined}
                        lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                        hidden={actuallyHideSubtitlePlayer}
                        disabledSubtitleTracks={disabledSubtitleTracks}
                        onSeek={handleSeekToTimestamp}
                        onCopy={handleCopyFromSubtitlePlayer}
                        onOffsetChange={handleOffsetChange}
                        onToggleSubtitleTrack={handleToggleSubtitleTrack}
                        onSubtitlesHighlighted={handleSubtitlesHighlighted}
                        onResizeStart={handleSubtitlePlayerResizeStart}
                        onResizeEnd={handleSubtitlePlayerResizeEnd}
                        maxResizeWidth={subtitlePlayerMaxResizeWidth}
                        autoPauseContext={autoPauseContext}
                        settings={settings}
                        keyBinder={keyBinder}
                        webSocketClient={webSocketClient}
                    />
                </Grid>
            </Grid>
        </div>
    );
});

export default Player;
