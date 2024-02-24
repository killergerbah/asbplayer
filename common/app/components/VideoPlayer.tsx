import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { makeStyles } from '@material-ui/core/styles';
import { useWindowSize } from '../hooks/use-window-size';
import { arrayEquals } from '../services/util';
import {
    SubtitleModel,
    AudioTrackModel,
    PostMineAction,
    PlayMode,
    AutoPausePreference,
    AutoPauseContext,
    OffscreenDomCache,
    CardTextFieldValues,
} from '@project/common';
import {
    MiscSettings,
    SubtitleSettings,
    AnkiSettings,
    AsbplayerSettings,
    SubtitleAlignment,
} from '@project/common/settings';
import {
    surroundingSubtitles,
    mockSurroundingSubtitles,
    computeStyles,
    computeStyleString,
} from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import SubtitleTextImage from '@project/common/components/SubtitleTextImage';
import Clock from '../services/clock';
import Controls, { Point } from './Controls';
import PlayerChannel from '../services/player-channel';
import ChromeExtension from '../services/chrome-extension';
import PlaybackPreferences from '../services/playback-preferences';
import { AnkiDialogFinishedRequest } from './Player';
import { Color } from '@material-ui/lab/Alert';
import Alert from './Alert';
import { useSubtitleDomCache } from '../hooks/use-subtitle-dom-cache';
import { useAppKeyBinder } from '../hooks/use-app-key-binder';
import { Direction, useSwipe } from '../hooks/use-swipe';
import './video-player.css';
import i18n from 'i18next';
import { adjacentSubtitle } from '../../key-binder';
import { usePlaybackPreferences } from '../hooks/use-playback-preferences';

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
        textAlign: 'center',
        whiteSpace: 'pre-wrap',
        lineHeight: 'normal',
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
    playerChannel.ready(element.duration, element.paused, element.playbackRate, tracks, selectedTrack);
}

function errorMessage(element: HTMLVideoElement) {
    let error;
    switch (element.error?.code) {
        case 1:
            error = 'MEDIA_ERR_ABORTED';
            break;
        case 2:
            error = 'MEDIA_ERR_ABORTED';
            break;
        case 3:
            error = 'MEDIA_ERR_DECODE';
            break;
        case 4:
            error = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
            break;
        default:
            error = 'Unknown error';
            break;
    }

    return error + ': ' + (element.error?.message || '<details missing>');
}

const showingSubtitleHtml = (
    subtitle: IndexedSubtitleModel,
    videoRef: MutableRefObject<ExperimentalHTMLVideoElement | undefined>,
    subtitleStyles: string,
    imageBasedSubtitleScaleFactor: number
) => {
    if (subtitle.textImage) {
        const imageScale =
            (imageBasedSubtitleScaleFactor * (videoRef.current?.width ?? window.screen.availWidth)) /
            subtitle.textImage.screen.width;
        const width = imageScale * subtitle.textImage.image.width;

        return `
<div style="max-width:${width}px;">
<img
    style="width:100%;"
    alt="subtitle"
    src="${subtitle.textImage.dataUrl}"
/>
</div>
`;
    }

    return `<span style="${subtitleStyles}">${subtitle.text}</span>`;
};

interface ShowingSubtitleProps {
    subtitle: IndexedSubtitleModel;
    videoRef: MutableRefObject<ExperimentalHTMLVideoElement | undefined>;
    subtitleStyles: any;
    imageBasedSubtitleScaleFactor: number;
}

const ShowingSubtitle = ({
    subtitle,
    videoRef,
    subtitleStyles,
    imageBasedSubtitleScaleFactor,
}: ShowingSubtitleProps) => {
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

    return <div>{content}</div>;
};

interface CachedShowingSubtitleProps {
    index: number;
    domCache: OffscreenDomCache;
}

const CachedShowingSubtitle = React.memo(function CachedShowingSubtitle({
    index,
    domCache,
}: CachedShowingSubtitleProps) {
    return (
        <div
            ref={(ref) => {
                if (!ref) {
                    return;
                }

                while (ref.firstChild) {
                    domCache.return(ref.lastChild! as HTMLElement);
                }

                ref.appendChild(domCache.get(String(index)));
            }}
        />
    );
});

export interface SeekRequest {
    timestamp: number;
}

interface Props {
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    videoFile: string;
    channel: string;
    popOut: boolean;
    ankiDialogFinishedRequest: AnkiDialogFinishedRequest;
    ankiDialogOpen: boolean;
    seekRequest?: SeekRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        timestamp: number
    ) => void;
    onAnkiDialogRewind: () => void;
    onError: (error: string) => void;
    onPlayModeChangedViaBind: (oldPlayMode: PlayMode, newPlayMode: PlayMode) => void;
}

interface IndexedSubtitleModel extends SubtitleModel {
    index: number;
}

interface MinedRecord {
    videoFileUrl: string;
    videoFileName: string;
    selectedAudioTrack: string | undefined;
    playbackRate: number;
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
    timestamp: number;
}

export default function VideoPlayer({
    settings,
    extension,
    videoFile,
    channel,
    popOut,
    ankiDialogFinishedRequest,
    ankiDialogOpen,
    seekRequest,
    onAnkiDialogRequest,
    onError,
    onPlayModeChangedViaBind,
    onAnkiDialogRewind,
}: Props) {
    const classes = useStyles();
    const poppingInRef = useRef<boolean>();
    const videoRef = useRef<ExperimentalHTMLVideoElement>();
    const [windowWidth, windowHeight] = useWindowSize(true);
    if (videoRef.current) {
        videoRef.current.width = windowWidth;
        videoRef.current.height = windowHeight;
    }
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playerChannelSubscribed, setPlayerChannelSubscribed] = useState<boolean>(false);
    const [fullscreen, setFullscreen] = useState<boolean>(false);
    const playing = () => !videoRef.current?.paused ?? false;
    const [length, setLength] = useState<number>(0);
    const [videoFileName, setVideoFileName] = useState<string>();
    const [offset, setOffset] = useState<number>(0);
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [, setResumeOnFinishedAnkiDialogRequest] = useState<boolean>(false);
    const [subtitles, setSubtitles] = useState<IndexedSubtitleModel[]>([]);
    const subtitleCollection = useMemo<SubtitleCollection<IndexedSubtitleModel>>(
        () =>
            new SubtitleCollection<IndexedSubtitleModel>(subtitles, {
                returnLastShown: false,
                showingCheckRadiusMs: 150,
            }),
        [subtitles]
    );
    const [showSubtitles, setShowSubtitles] = useState<IndexedSubtitleModel[]>([]);
    const [miscSettings, setMiscSettings] = useState<MiscSettings>(settings);
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(settings);
    const [ankiSettings, setAnkiSettings] = useState<AnkiSettings>(settings);
    const playbackPreferences = usePlaybackPreferences({ ...miscSettings, ...subtitleSettings }, extension);
    const [displaySubtitles, setDisplaySubtitles] = useState(playbackPreferences.displaySubtitles);
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [index: number]: boolean }>({});
    const [playMode, setPlayMode] = useState<PlayMode>(PlayMode.normal);
    const [subtitlePlayerHidden, setSubtitlePlayerHidden] = useState<boolean>(false);
    const [appBarHidden, setAppBarHidden] = useState<boolean>(playbackPreferences.theaterMode);
    const [subtitleAlignment, setSubtitleAlignment] = useState<SubtitleAlignment>(
        playbackPreferences.subtitleAlignment
    );
    const [subtitlePositionOffset, setSubtitlePositionOffset] = useState<number>(
        playbackPreferences.subtitlePositionOffset
    );
    const showSubtitlesRef = useRef<IndexedSubtitleModel[]>([]);
    showSubtitlesRef.current = showSubtitles;
    const clock = useMemo<Clock>(() => new Clock(), []);
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const [showCursor, setShowCursor] = useState<boolean>(false);
    const lastMouseMovementTimestamp = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertMessage, setAlertMessage] = useState<string>('');
    const [alertSeverity, setAlertSeverity] = useState<Color>('info');
    const [lastMinedRecord, setLastMinedRecord] = useState<MinedRecord>();
    const [, forceRender] = useState<any>();

    useEffect(() => {
        setMiscSettings(settings);
        setSubtitleSettings(settings);
        setAnkiSettings(settings);
    }, [settings]);

    useEffect(() => {
        setSubtitleAlignment(playbackPreferences.subtitleAlignment);
        setSubtitlePositionOffset(playbackPreferences.subtitlePositionOffset);
    }, [playbackPreferences]);

    const autoPauseContext = useMemo(() => {
        const context = new AutoPauseContext();
        context.onStartedShowing = () => {
            if (playMode !== PlayMode.autoPause || miscSettings.autoPausePreference !== AutoPausePreference.atStart) {
                return;
            }

            playerChannel.pause();
        };
        context.onWillStopShowing = () => {
            if (playMode !== PlayMode.autoPause || miscSettings.autoPausePreference !== AutoPausePreference.atEnd) {
                return;
            }

            playerChannel.pause();
        };
        return context;
    }, [playerChannel, miscSettings, playMode]);
    const autoPauseContextRef = useRef<AutoPauseContext>();
    autoPauseContextRef.current = autoPauseContext;

    const keyBinder = useAppKeyBinder(miscSettings.keyBindSet, extension);

    useEffect(() => {
        if (i18n.language !== miscSettings.language) {
            i18n.changeLanguage(miscSettings.language);
        }
    }, [miscSettings]);

    const updatePlayerState = useCallback(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (video.paused) {
            playerChannel.pause(false);
        } else {
            playerChannel.play(false);
        }

        playerChannel.playbackRate(video.playbackRate, false);
        playerChannel.currentTime(video.currentTime, false);
        forceRender({});
    }, [playerChannel]);

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

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

                    if (playing()) {
                        clock.start();
                    }
                };

                videoElement.ontimeupdate = (event) => clock.setTime(element.currentTime * 1000);
                videoElement.onerror = (event) => onErrorRef.current?.(errorMessage(element));
                videoElement.onplay = updatePlayerState;
                videoElement.onpause = updatePlayerState;
                videoElement.onratechange = updatePlayerState;
                videoElement.onseeked = updatePlayerState;
            }
        },
        [clock, playerChannel, updatePlayerState]
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

    const updateSubtitlesWithOffset = useCallback((offset: number) => {
        setOffset(offset);
        setSubtitles((subtitles) =>
            subtitles.map((s, i) => ({
                text: s.text,
                textImage: s.textImage,
                start: s.originalStart + offset,
                originalStart: s.originalStart,
                end: s.originalEnd + offset,
                originalEnd: s.originalEnd,
                track: s.track,
                index: i,
            }))
        );
    }, []);

    const updatePlaybackRate = useCallback(
        (playbackRate: number, forwardToPlayer: boolean) => {
            if (videoRef.current) {
                videoRef.current.playbackRate = playbackRate;
                clock.rate = playbackRate;

                if (forwardToPlayer) {
                    playerChannel.playbackRate(playbackRate);
                }
            }
        },
        [playerChannel, clock]
    );

    useEffect(() => {
        playerChannel.onReady((duration, videoFileName) => {
            setLength(duration);
            setVideoFileName(videoFileName);
        });

        playerChannel.onPlay(async () => {
            await videoRef.current?.play();
            clock.start();
        });

        playerChannel.onPause(() => {
            videoRef.current?.pause();
            clock.stop();
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
            autoPauseContextRef.current?.clear();
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
            setSubtitles(subtitles.map((s, i) => ({ ...s, index: i })));

            if (subtitles && subtitles.length > 0) {
                const s = subtitles[0];
                const offset = s.start - s.originalStart;
                setOffset(offset);
            }

            setShowSubtitles([]);
            autoPauseContextRef.current?.clear();
        });

        playerChannel.onPlayMode((playMode) => setPlayMode(playMode));
        playerChannel.onHideSubtitlePlayerToggle((hidden) => setSubtitlePlayerHidden(hidden));
        playerChannel.onAppBarToggle((hidden) => setAppBarHidden(hidden));
        playerChannel.onFullscreenToggle((fullscreen) => setFullscreen(fullscreen));
        playerChannel.onSubtitleSettings(setSubtitleSettings);
        playerChannel.onMiscSettings(setMiscSettings);
        playerChannel.onAnkiSettings(setAnkiSettings);
        playerChannel.onOffset(updateSubtitlesWithOffset);
        playerChannel.onPlaybackRate((playbackRate) => {
            updatePlaybackRate(playbackRate, false);
        });
        playerChannel.onAlert((message, severity) => {
            if (popOut) {
                setAlertOpen(true);
                setAlertMessage(message);
                setAlertSeverity(severity as Color);
            }
        });

        window.onbeforeunload = (e) => {
            if (!poppingInRef.current) {
                playerChannel.close();
            }
        };

        setPlayerChannelSubscribed(true);
        return () => playerChannel.close();
    }, [clock, playerChannel, updateSubtitlesWithOffset, updatePlaybackRate, popOut]);

    const handlePlay = useCallback(() => {
        if (videoRef.current) {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handlePause = useCallback(() => playerChannel.pause(), [playerChannel]);

    const handleSeek = useCallback(
        (progress: number) => {
            if (playing()) {
                clock.stop();
            }

            const time = progress * length;
            playerChannel.currentTime(time / 1000);
        },
        [length, clock, playerChannel]
    );

    useEffect(() => {
        if (seekRequest !== undefined) {
            handleSeek(seekRequest.timestamp / length);
        }
    }, [handleSeek, seekRequest, length]);

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
            if (playing()) {
                clock.stop();
                playerChannel.pause();
            }

            selectAudioTrack(id);
            setSelectedAudioTrack(id);
            playerChannel.currentTime(0);
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
            let showSubtitles: IndexedSubtitleModel[] = [];
            const slice = subtitleCollection.subtitlesAt(now);

            for (const s of slice.showing) {
                if (!disabledSubtitleTracks[s.track]) {
                    showSubtitles.push(s);
                }
            }

            if (slice.startedShowing && !disabledSubtitleTracks[slice.startedShowing.track]) {
                autoPauseContext.startedShowing(slice.startedShowing);
            }

            if (slice.willStopShowing && !disabledSubtitleTracks[slice.willStopShowing.track]) {
                autoPauseContext.willStopShowing(slice.willStopShowing);
            }

            showSubtitles = showSubtitles.sort((s1, s2) => s1.track - s2.track);

            if (!arrayEquals(showSubtitles, showSubtitlesRef.current, (s1, s2) => s1.index === s2.index)) {
                setShowSubtitles(showSubtitles);
                if (showSubtitles.length > 0 && miscSettings.autoCopyCurrentSubtitle && document.hasFocus()) {
                    navigator.clipboard.writeText(showSubtitles.map((s) => s.text).join('\n')).catch((e) => {
                        // ignore
                    });
                }
            }
        }, 100);

        return () => clearTimeout(interval);
    }, [
        subtitleCollection,
        playerChannel,
        subtitles,
        disabledSubtitleTracks,
        clock,
        length,
        autoPauseContext,
        miscSettings,
        extension,
    ]);

    const handleOffsetChange = useCallback(
        (offset: number) => {
            updateSubtitlesWithOffset(offset);
            playerChannel.offset(offset);
        },
        [playerChannel, updateSubtitlesWithOffset]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            updatePlaybackRate(playbackRate, true);
        },
        [updatePlaybackRate]
    );

    useEffect(() => {
        return keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                playerChannel.currentTime(subtitle.start / 1000);
            },
            () => !videoRef.current,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, playerChannel, subtitles, length, clock]);

    useEffect(() => {
        return keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                playerChannel.currentTime(subtitle.start / 1000);

                if (settings.alwaysPlayOnSubtitleRepeat) {
                    playerChannel.play();
                }
            },
            () => !videoRef.current,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, playerChannel, subtitles, length, clock, settings]);

    useEffect(() => {
        return keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.preventDefault();
                const timestamp = clock.time(length);

                if (forward) {
                    playerChannel.currentTime(Math.min(length / 1000, (timestamp + 10000) / 1000));
                } else {
                    playerChannel.currentTime(Math.max(0, (timestamp - 10000) / 1000));
                }
            },
            () => !videoRef.current
        );
    }, [keyBinder, playerChannel, length, clock]);

    const calculateSurroundingSubtitles = useCallback(
        (index: number) => {
            return surroundingSubtitles(
                subtitles,
                index,
                ankiSettings.surroundingSubtitlesCountRadius,
                ankiSettings.surroundingSubtitlesTimeRadius
            );
        },
        [subtitles, ankiSettings.surroundingSubtitlesCountRadius, ankiSettings.surroundingSubtitlesTimeRadius]
    );

    useEffect(() => {
        return keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                handleOffsetChange(offset);
            },
            () => false,
            () => subtitles
        );
    }, [keyBinder, handleOffsetChange, subtitles]);

    useEffect(() => {
        return keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                handleOffsetChange(0);
            },
            () => false
        );
    }, [keyBinder, handleOffsetChange]);

    useEffect(() => {
        return keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                event.preventDefault();
                const video = videoRef.current;

                if (!video) {
                    return;
                }

                if (increase) {
                    updatePlaybackRate(Math.min(5, video.playbackRate + 0.1), true);
                } else {
                    updatePlaybackRate(Math.max(0.1, video.playbackRate - 0.1), true);
                }
            },
            () => false
        );
    }, [updatePlaybackRate, keyBinder]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitles(
            (event) => {
                event.preventDefault();
                setDisplaySubtitles(!displaySubtitles);
                playbackPreferences.displaySubtitles = !displaySubtitles;
            },
            () => false
        );
    }, [keyBinder, displaySubtitles, playbackPreferences]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                setDisabledSubtitleTracks((tracks) => {
                    const newTracks = { ...tracks };
                    newTracks[track] = !tracks[track];
                    return newTracks;
                });
            },
            () => false
        );
    }, [keyBinder]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                playerChannel.toggleSubtitleTrackInList(track);
            },
            () => false
        );
    }, [keyBinder, playerChannel]);

    useEffect(() => {
        return keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                handleOffsetChange(offset);
            },
            () => false,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, handleOffsetChange, subtitles, clock, length]);

    const extractSubtitles = useCallback(() => {
        if (!subtitles || subtitles.length === 0) {
            const timestamp = clock.time(length);
            const end = Math.min(timestamp + 5000, length);
            const currentSubtitle = {
                text: '',
                start: timestamp,
                originalStart: timestamp,
                end: end,
                originalEnd: end,
                track: 0,
            };

            return { currentSubtitle, surroundingSubtitles: mockSurroundingSubtitles(currentSubtitle, length, 5000) };
        } else if (showSubtitlesRef.current && showSubtitlesRef.current.length > 0) {
            const currentSubtitle = showSubtitlesRef.current[0];
            return { currentSubtitle, surroundingSubtitles: calculateSurroundingSubtitles(currentSubtitle.index) };
        }

        return undefined;
    }, [subtitles, calculateSurroundingSubtitles, length, clock]);

    const mineSubtitle = useCallback(
        (
            postMineAction: PostMineAction,
            videoFileUrl: string,
            videoFileName: string,
            selectedAudioTrack: string | undefined,
            playbackRate: number,
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            cardTextFieldValues: CardTextFieldValues,
            timestamp: number
        ) => {
            switch (postMineAction) {
                case PostMineAction.showAnkiDialog:
                    if (popOut) {
                        playerChannel.copy(
                            subtitle,
                            surroundingSubtitles,
                            cardTextFieldValues,
                            videoFileName ?? '',
                            timestamp,
                            PostMineAction.none
                        );
                        onAnkiDialogRequest(
                            videoFileUrl,
                            videoFileName ?? '',
                            selectedAudioTrack,
                            playbackRate,
                            subtitle,
                            surroundingSubtitles,
                            cardTextFieldValues,
                            timestamp
                        );

                        if (playing()) {
                            playerChannel.pause();
                            setResumeOnFinishedAnkiDialogRequest(true);
                        }
                    } else {
                        playerChannel.copy(
                            subtitle,
                            surroundingSubtitles,
                            cardTextFieldValues,
                            videoFileName ?? '',
                            timestamp,
                            PostMineAction.showAnkiDialog
                        );
                    }
                    break;
                default:
                    playerChannel.copy(
                        subtitle,
                        surroundingSubtitles,
                        cardTextFieldValues,
                        videoFileName ?? '',
                        timestamp,
                        postMineAction
                    );
            }

            setLastMinedRecord({
                videoFileUrl,
                videoFileName: videoFileName ?? '',
                selectedAudioTrack,
                playbackRate,
                subtitle,
                surroundingSubtitles,
                timestamp,
            });
        },
        [onAnkiDialogRequest, playerChannel, popOut]
    );

    const mineCurrentSubtitle = useCallback(
        (
            postMineAction: PostMineAction,
            subtitle?: SubtitleModel,
            surroundingSubtitles?: SubtitleModel[],
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            const video = videoRef.current;

            if (!video) {
                return;
            }

            let mediaTimestamp: number;

            if (subtitle === undefined || surroundingSubtitles === undefined) {
                const extracted = extractSubtitles();

                if (extracted === undefined) {
                    return;
                }

                subtitle = extracted.currentSubtitle;
                surroundingSubtitles = extracted.surroundingSubtitles;
                mediaTimestamp = clock.time(length);
            } else {
                mediaTimestamp = subtitle.start;
            }

            mineSubtitle(
                postMineAction,
                videoFile,
                videoFileName ?? '',
                selectedAudioTrack,
                video.playbackRate,
                subtitle,
                surroundingSubtitles,
                cardTextFieldValues ?? {},
                mediaTimestamp
            );
        },
        [mineSubtitle, extractSubtitles, clock, length, selectedAudioTrack, videoFile, videoFileName]
    );

    useEffect(() => {
        return playerChannel.onCopy(mineCurrentSubtitle);
    }, [playerChannel, mineCurrentSubtitle]);

    useEffect(() => {
        return keyBinder.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                mineCurrentSubtitle(PostMineAction.showAnkiDialog);
            },
            () => false
        );
    }, [mineCurrentSubtitle, keyBinder]);

    useEffect(() => {
        if (ankiDialogFinishedRequest && ankiDialogFinishedRequest.timestamp > 0) {
            setResumeOnFinishedAnkiDialogRequest((resumeOnFinishedAnkiDialogRequest) => {
                if (resumeOnFinishedAnkiDialogRequest && ankiDialogFinishedRequest.resume) {
                    playerChannel.play();
                }

                return false;
            });
        }
    }, [ankiDialogFinishedRequest, playerChannel]);

    useEffect(() => {
        return keyBinder.bindUpdateLastCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                mineCurrentSubtitle(PostMineAction.updateLastCard);
            },
            () => false
        );
    }, [mineCurrentSubtitle, keyBinder]);

    useEffect(() => {
        return keyBinder.bindTakeScreenshot(
            (event) => {
                event.preventDefault();

                if (popOut && ankiDialogOpen) {
                    onAnkiDialogRewind();
                } else if (lastMinedRecord) {
                    const currentTimestamp = clock.time(length);
                    mineSubtitle(
                        PostMineAction.showAnkiDialog,
                        lastMinedRecord.videoFileUrl,
                        lastMinedRecord.videoFileName,
                        lastMinedRecord.selectedAudioTrack,
                        lastMinedRecord.playbackRate,
                        lastMinedRecord.subtitle,
                        lastMinedRecord.surroundingSubtitles,
                        {},
                        currentTimestamp
                    );
                }
            },
            () => false
        );
    }, [clock, length, keyBinder, lastMinedRecord, mineSubtitle, popOut, ankiDialogOpen, onAnkiDialogRewind]);

    useEffect(() => {
        return keyBinder.bindCopy(
            (event, subtitle) => {
                event.preventDefault();
                mineCurrentSubtitle(PostMineAction.none);
            },
            () => false,
            () => {
                const extracted = extractSubtitles();

                if (extracted === undefined) {
                    return undefined;
                }

                return extracted.currentSubtitle;
            }
        );
    }, [extractSubtitles, mineCurrentSubtitle, keyBinder]);

    useEffect(() => {
        return keyBinder.bindPlay(
            (event) => {
                event.preventDefault();

                if (playing()) {
                    playerChannel.pause();
                } else {
                    playerChannel.play();
                }
            },
            () => false
        );
    }, [keyBinder, playerChannel]);

    const togglePlayMode = useCallback(
        (event: KeyboardEvent, togglePlayMode: PlayMode) => {
            if (subtitles.length === 0) {
                return;
            }

            event.preventDefault();
            const newPlayMode = playMode === togglePlayMode ? PlayMode.normal : togglePlayMode;
            playerChannel.playMode(newPlayMode);
            onPlayModeChangedViaBind(playMode, newPlayMode);
        },
        [playMode, playerChannel, subtitles, onPlayModeChangedViaBind]
    );

    useEffect(() => {
        return keyBinder.bindAutoPause(
            (event) => togglePlayMode(event, PlayMode.autoPause),
            () => false
        );
    }, [keyBinder, togglePlayMode]);

    useEffect(() => {
        return keyBinder.bindCondensedPlayback(
            (event) => togglePlayMode(event, PlayMode.condensed),
            () => false
        );
    }, [keyBinder, togglePlayMode]);

    useEffect(() => {
        return keyBinder.bindFastForwardPlayback(
            (event) => togglePlayMode(event, PlayMode.fastForward),
            () => false
        );
    }, [keyBinder, togglePlayMode]);

    useEffect(() => {
        return keyBinder.bindToggleRepeat(
            (event) => {
                if (showSubtitles.length > 0) {
                    togglePlayMode(event, PlayMode.repeat);
                }
            },
            () => false
        );
    }, [keyBinder, togglePlayMode, showSubtitles]);

    const handleSubtitlesToggle = useCallback(() => {
        setDisplaySubtitles(!displaySubtitles);
        playbackPreferences.displaySubtitles = !displaySubtitles;
    }, [displaySubtitles, playbackPreferences]);

    const handleFullscreenToggle = useCallback(() => {
        if (popOut) {
            setFullscreen((fullscreen) => {
                if (fullscreen) {
                    document.exitFullscreen();
                } else {
                    document.documentElement.requestFullscreen();
                }

                return !fullscreen;
            });
        } else {
            playerChannel.fullscreenToggle();
        }
    }, [playerChannel, popOut]);

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

    const handlePlayMode = useCallback(
        (playMode: PlayMode) => {
            playerChannel.playMode(playMode);
        },
        [playerChannel]
    );

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

    const handleSubtitleAlignment = useCallback(
        (alignment: SubtitleAlignment) => {
            setSubtitleAlignment(alignment);
            playbackPreferences.subtitleAlignment = alignment;
        },
        [playbackPreferences]
    );

    useEffect(() => {
        const onWheel = (event: WheelEvent) => {
            if (!displaySubtitles || !showSubtitlesRef.current?.length) {
                return;
            }

            if (Math.abs(event.deltaY) < 10) {
                return;
            }

            let shouldIncreaseOffset: boolean;

            switch (subtitleAlignment) {
                case 'bottom':
                    shouldIncreaseOffset = event.deltaY > 0;
                    break;
                case 'top':
                    shouldIncreaseOffset = event.deltaY < 0;
                    break;
            }

            setSubtitlePositionOffset((offset) => {
                const newOffset = shouldIncreaseOffset ? --offset : ++offset;
                playbackPreferences.subtitlePositionOffset = newOffset;
                return newOffset;
            });
        };

        window.addEventListener('wheel', onWheel);
        return () => window.removeEventListener('wheel', onWheel);
    }, [subtitleAlignment, displaySubtitles, playbackPreferences]);

    const handleClick = useCallback(() => {
        if (playing()) {
            playerChannel.pause();
        } else {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handleDoubleClick = useCallback(() => handleFullscreenToggle(), [handleFullscreenToggle]);

    const {
        subtitleSize,
        subtitleColor,
        subtitleThickness,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleShadowThickness,
        subtitleShadowColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitleCustomStyles,
        imageBasedSubtitleScaleFactor,
    } = subtitleSettings;
    const subtitleStyles = useMemo(
        () =>
            computeStyles({
                subtitleSize,
                subtitleColor,
                subtitleThickness,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleShadowThickness,
                subtitleShadowColor,
                subtitleBackgroundColor,
                subtitleBackgroundOpacity,
                subtitleFontFamily,
                subtitleCustomStyles,
            }),
        [
            subtitleSize,
            subtitleColor,
            subtitleThickness,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleShadowThickness,
            subtitleShadowColor,
            subtitleBackgroundColor,
            subtitleBackgroundOpacity,
            subtitleFontFamily,
            subtitleCustomStyles,
        ]
    );

    const subtitleStylesString = useMemo(
        () =>
            computeStyleString({
                subtitleSize,
                subtitleColor,
                subtitleThickness,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleShadowThickness,
                subtitleShadowColor,
                subtitleBackgroundColor,
                subtitleBackgroundOpacity,
                subtitleFontFamily,
                subtitleCustomStyles,
            }),
        [
            subtitleSize,
            subtitleColor,
            subtitleThickness,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleShadowThickness,
            subtitleShadowColor,
            subtitleBackgroundColor,
            subtitleBackgroundOpacity,
            subtitleFontFamily,
            subtitleCustomStyles,
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

    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const { getSubtitleDomCache } = useSubtitleDomCache(
        subtitles,
        useCallback(
            (subtitle) => showingSubtitleHtml(subtitle, videoRef, subtitleStylesString, imageBasedSubtitleScaleFactor),
            [subtitleStylesString, imageBasedSubtitleScaleFactor]
        )
    );

    const handleSwipe = useCallback(
        (direction: Direction) => {
            const subtitle = adjacentSubtitle(direction === 'right', clock.time(length), subtitles);
            if (subtitle) {
                playerChannel.currentTime(subtitle.start / 1000);
            }
        },
        [clock, length, subtitles, playerChannel]
    );

    useSwipe({
        onSwipe: handleSwipe,
        distance: 50,
        ms: 500,
    });

    // If the video player is taking up the entire screen, then the subtitle player isn't showing
    // This code assumes some behavior in Player, namely that the subtitle player is automatically hidden
    // (and therefore the VideoPlayer takes up all the space) when there isn't enough room for the subtitle player
    // to be displayed.
    const notEnoughRoomForSubtitlePlayer =
        !subtitlePlayerHidden &&
        parent?.document?.body !== undefined &&
        parent.document.body.clientWidth === document.body.clientWidth;

    if (!playerChannelSubscribed) {
        return null;
    }

    return (
        <div ref={containerRef} onMouseMove={handleMouseMove} className={classes.root}>
            <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                {alertMessage}
            </Alert>
            <video
                preload="auto"
                controls={false}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={showCursor ? classes.video : `${classes.cursorHidden} ${classes.video}`}
                ref={videoRefCallback}
                src={videoFile}
            />
            {displaySubtitles && (
                <div
                    style={
                        subtitleAlignment === 'bottom'
                            ? { bottom: subtitlePositionOffset }
                            : { top: subtitlePositionOffset }
                    }
                    className={classes.subtitleContainer}
                >
                    {showSubtitles.map((subtitle, index) => {
                        if (miscSettings.preCacheSubtitleDom) {
                            const domCache = getSubtitleDomCache();
                            return <CachedShowingSubtitle key={index} index={subtitle.index} domCache={domCache} />;
                        }

                        return (
                            <ShowingSubtitle
                                key={index}
                                subtitle={subtitle}
                                subtitleStyles={subtitleStyles}
                                videoRef={videoRef}
                                imageBasedSubtitleScaleFactor={imageBasedSubtitleScaleFactor}
                            />
                        );
                    })}
                </div>
            )}
            <Controls
                mousePositionRef={mousePositionRef}
                clock={clock}
                length={length}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedAudioTrack}
                subtitlesToggle={subtitles && subtitles.length > 0}
                subtitlesEnabled={displaySubtitles}
                offsetEnabled={true}
                offset={offset}
                playbackRate={videoRef.current?.playbackRate ?? 1}
                playbackRateEnabled={true}
                fullscreenEnabled={true}
                fullscreen={fullscreen}
                closeEnabled={!popOut}
                popOut={popOut}
                volumeEnabled={true}
                popOutEnabled={!isMobile}
                playModeEnabled={subtitles && subtitles.length > 0}
                playMode={playMode}
                hideSubtitlePlayerToggleEnabled={
                    subtitles?.length > 0 && !popOut && !fullscreen && !notEnoughRoomForSubtitlePlayer
                }
                subtitlePlayerHidden={subtitlePlayerHidden}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onAudioTrackSelected={handleAudioTrackSelected}
                onSubtitlesToggle={handleSubtitlesToggle}
                onFullscreenToggle={handleFullscreenToggle}
                onVolumeChange={handleVolumeChange}
                onOffsetChange={handleOffsetChange}
                onPlaybackRateChange={handlePlaybackRateChange}
                onPopOutToggle={handlePopOutToggle}
                onPlayMode={handlePlayMode}
                onClose={handleClose}
                onHideSubtitlePlayerToggle={handleHideSubtitlePlayerToggle}
                playbackPreferences={playbackPreferences}
                showOnMouseMovement={false}
                theaterModeToggleEnabled={!popOut && !fullscreen}
                theaterModeEnabled={appBarHidden}
                onTheaterModeToggle={handleTheaterModeToggle}
                subtitleAlignment={subtitleAlignment}
                subtitleAlignmentEnabled={true}
                onSubtitleAlignment={handleSubtitleAlignment}
            />
        </div>
    );
}
