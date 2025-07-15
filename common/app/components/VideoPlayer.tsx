import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { makeStyles } from '@mui/styles';
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
    PostMinePlayback,
    ControlType,
} from '@project/common';
import {
    MiscSettings,
    SubtitleSettings,
    AnkiSettings,
    AsbplayerSettings,
    SubtitleAlignment,
    changeForTextSubtitleSetting,
    textSubtitleSettingsForTrack,
    PauseOnHoverMode,
    allTextSubtitleSettings,
} from '@project/common/settings';
import {
    surroundingSubtitles,
    mockSurroundingSubtitles,
    seekWithNudge,
    surroundingSubtitlesAroundInterval,
} from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import SubtitleTextImage from '@project/common/components/SubtitleTextImage';
import Clock from '../services/clock';
import Controls, { Point } from './Controls';
import PlayerChannel from '../services/player-channel';
import ChromeExtension from '../services/chrome-extension';
import { type AlertColor } from '@mui/material/Alert';
import Alert from './Alert';
import { useSubtitleDomCache } from '../hooks/use-subtitle-dom-cache';
import { useAppKeyBinder } from '../hooks/use-app-key-binder';
import { Direction, useSwipe } from '../hooks/use-swipe';
import './video-player.css';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { adjacentSubtitle } from '../../key-binder';
import { usePlaybackPreferences } from '../hooks/use-playback-preferences';
import { MiningContext } from '../services/mining-context';
import { useSubtitleStyles } from '../hooks/use-subtitle-styles';
import { useFullscreen } from '../hooks/use-fullscreen';
import MobileVideoOverlay from '@project/common/components/MobileVideoOverlay';
import { CachedLocalStorage } from '../services/cached-local-storage';
import useLastScrollableControlType from '../../hooks/use-last-scrollable-control-type';
import { type Theme } from '@mui/material/styles';

const overlayContainerHeight = 48;

interface ExperimentalHTMLVideoElement extends HTMLVideoElement {
    readonly audioTracks: any;
}

const useStyles = makeStyles<Theme>((theme) => ({
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
    mobileOverlay: {
        position: 'absolute',
        zIndex: 10,
        bottom: theme.spacing(1.5),
    },
}));

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
    subtitleClasses: string,
    imageBasedSubtitleScaleFactor: number
) => {
    if (subtitle.textImage) {
        const imageScale =
            (imageBasedSubtitleScaleFactor * (videoRef.current?.width ?? window.screen.availWidth)) /
            subtitle.textImage.screen.width;
        const width = imageScale * subtitle.textImage.image.width;
        return `
<div style="max-width:${width}px;margin:auto;">
<img
    style="width:100%;"
    alt="subtitle"
    src="${subtitle.textImage.dataUrl}"
    class="${subtitleClasses}"
/>
</div>
`;
    }

    const lines = subtitle.text.split('\n');
    const allSubtitleClasses = subtitleClasses ? `${subtitleClasses} subtitle-line` : 'subtitle-line';
    const wrappedText = lines
        .map((line) => `<p class="${allSubtitleClasses}" style="${subtitleStyles}">${line}</p>`)
        .join('');
    return wrappedText;
};

interface CachedShowingSubtitleProps {
    index: number;
    domCache: OffscreenDomCache;
    className?: string;
    onMouseOver: React.MouseEventHandler<HTMLDivElement>;
}

const CachedShowingSubtitle = React.memo(function CachedShowingSubtitle({
    index,
    domCache,
    className,
    onMouseOver,
}: CachedShowingSubtitleProps) {
    return (
        <div
            className={className ? className : ''}
            onMouseOver={onMouseOver}
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

const useSubtitleContainerStyles = makeStyles(() => ({
    subtitleContainer: {
        position: 'absolute',
        paddingLeft: 20,
        paddingRight: 20,
        textAlign: 'center',
        whiteSpace: 'normal',
        lineHeight: 'inherit',
    },
}));

interface SubtitleContainerProps {
    subtitleSettings: SubtitleSettings;
    alignment: SubtitleAlignment;
    baseOffset: number;
    children: React.ReactNode;
}

const SubtitleContainer = React.forwardRef<HTMLDivElement, SubtitleContainerProps>(function SubtitleContainer(
    { subtitleSettings, alignment, baseOffset, children }: SubtitleContainerProps,
    ref
) {
    const classes = useSubtitleContainerStyles();

    return (
        <div
            ref={ref}
            className={classes.subtitleContainer}
            style={{
                ...(alignment === 'bottom'
                    ? { bottom: subtitleSettings.subtitlePositionOffset + baseOffset }
                    : { top: subtitleSettings.topSubtitlePositionOffset + baseOffset }),
                ...(subtitleSettings.subtitlesWidth === -1 ? {} : { width: `${subtitleSettings.subtitlesWidth}%` }),
            }}
        >
            {children}
        </div>
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
    miningContext: MiningContext;
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
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
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

const allSubtitleAlignments = (subtitleSettings: SubtitleSettings) => {
    return allTextSubtitleSettings(subtitleSettings).map((s) => s.subtitleAlignment);
};

const lastControlTypeKey = 'lastScrollableControlType';
const storage = new CachedLocalStorage();

const fetchLastControlType = async (): Promise<ControlType | undefined> => {
    const val = storage.get(lastControlTypeKey);

    if (val == null) {
        return undefined;
    }

    return parseInt(val) as ControlType;
};

const saveLastControlType = (controlType: ControlType): void => {
    storage.set(lastControlTypeKey, String(controlType));
};

export default function VideoPlayer({
    settings,
    extension,
    videoFile,
    channel,
    popOut,
    miningContext,
    ankiDialogOpen,
    seekRequest,
    onAnkiDialogRequest,
    onError,
    onPlayModeChangedViaBind,
    onAnkiDialogRewind,
    onSettingsChanged,
}: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    const poppingInRef = useRef<boolean>();
    const videoRef = useRef<ExperimentalHTMLVideoElement>();
    const [windowWidth, windowHeight] = useWindowSize(true);
    if (videoRef.current) {
        videoRef.current.width = windowWidth;
        videoRef.current.height = windowHeight;
    }
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playerChannelSubscribed, setPlayerChannelSubscribed] = useState<boolean>(false);
    const { fullscreen, requestFullscreen } = useFullscreen();
    const playing = () => !videoRef.current?.paused || false;
    const [length, setLength] = useState<number>(0);
    const [videoFileName, setVideoFileName] = useState<string>();
    const [offset, setOffset] = useState<number>(0);
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [wasPlayingOnAnkiDialogRequest, setWasPlayingOnAnkiDialogRequest] = useState<boolean>(false);
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
    const [subtitleAlignments, setSubtitleAlignments] = useState<SubtitleAlignment[]>(
        allSubtitleAlignments(subtitleSettings)
    );
    const [, setBottomSubtitlePositionOffset] = useState<number>(subtitleSettings.subtitlePositionOffset);
    const [, setTopSubtitlePositionOffset] = useState<number>(subtitleSettings.topSubtitlePositionOffset);
    const showSubtitlesRef = useRef<IndexedSubtitleModel[]>([]);
    showSubtitlesRef.current = showSubtitles;
    const clock = useMemo<Clock>(() => new Clock(), []);
    const mousePositionRef = useRef<Point | undefined>(undefined);
    const [showCursor, setShowCursor] = useState<boolean>(isMobile);
    const lastMouseMovementTimestamp = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertMessage, setAlertMessage] = useState<string>('');
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>('info');
    const [alertDisableAutoHide, setAlertDisableAutoHide] = useState<boolean>(false);
    const [lastMinedRecord, setLastMinedRecord] = useState<MinedRecord>();
    const [trackCount, setTrackCount] = useState<number>(0);
    const [, forceRender] = useState<any>();
    const [mineIntervalStartTimestamp, setMineIntervalStartTimestamp] = useState<number>();
    const mobileOverlayRef = useRef<HTMLDivElement>(null);
    const bottomSubtitleContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMiscSettings(settings);
        setSubtitleSettings(settings);
        setAnkiSettings(settings);
    }, [settings]);

    useEffect(() => {
        setSubtitleAlignments(allSubtitleAlignments(subtitleSettings));
        setBottomSubtitlePositionOffset(subtitleSettings.subtitlePositionOffset);
        setTopSubtitlePositionOffset(subtitleSettings.topSubtitlePositionOffset);
    }, [subtitleSettings]);

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

        if (!video.paused) {
            isPausedDueToHoverRef.current = false;
        }
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
                    videoElement.onloadeddata = () =>
                        notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
                    videoElement.ondurationchange = () =>
                        notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
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

                if (isMobile) {
                    // Force volume to 1 on mobile - users can control device volume
                    videoRef.current.volume = 1;
                }
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
            let actualCurrentTime = currentTime;

            if (videoRef.current) {
                actualCurrentTime = seekWithNudge(videoRef.current, currentTime);
            }

            if (videoRef.current?.readyState === 4) {
                playerChannel.readyState(4);
            }

            clock.stop();
            clock.setTime(actualCurrentTime * 1000);
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
            setTrackCount(Math.max(...subtitles.map((s) => s.track)) + 1);

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
        playerChannel.onFullscreenToggle((fullscreen) => requestFullscreen(fullscreen));
        playerChannel.onSubtitleSettings(setSubtitleSettings);
        playerChannel.onMiscSettings(setMiscSettings);
        playerChannel.onAnkiSettings(setAnkiSettings);
        playerChannel.onOffset(updateSubtitlesWithOffset);
        playerChannel.onPlaybackRate((playbackRate) => {
            updatePlaybackRate(playbackRate, false);
        });
        playerChannel.onAlert((message, severity) => {
            setAlertOpen(true);
            setAlertMessage(message);
            setAlertSeverity(severity as AlertColor);
        });

        window.onbeforeunload = (e) => {
            if (!poppingInRef.current) {
                playerChannel.close();
            }
        };

        setPlayerChannelSubscribed(true);
        return () => playerChannel.close();
    }, [clock, playerChannel, requestFullscreen, updateSubtitlesWithOffset, updatePlaybackRate]);

    const handlePlay = useCallback(() => {
        if (videoRef.current) {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handlePause = useCallback(() => playerChannel.pause(), [playerChannel]);

    const handleSeek = useCallback(
        (progress: number) => {
            if (!Number.isFinite(length)) {
                return;
            }

            if (playing()) {
                clock.stop();
            }

            const time = progress * length;
            playerChannel.currentTime(time / 1000);
        },
        [length, clock, playerChannel]
    );

    const handleSeekByTimestamp = useCallback(
        (timestampMs: number) => {
            playerChannel.currentTime(timestampMs / 1000);
        },
        [playerChannel]
    );

    useEffect(() => {
        if (seekRequest !== undefined) {
            handleSeek(seekRequest.timestamp / length);
        }
    }, [handleSeek, seekRequest, length]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        lastMouseMovementTimestamp.current = Date.now();

        if (!containerRef.current) {
            return;
        }

        var bounds = containerRef.current.getBoundingClientRect();
        mousePositionRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    }, []);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        mousePositionRef.current = undefined;
    }, []);

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

    const handleLoadFiles = useCallback(() => {
        playerChannel.loadFiles();
    }, [playerChannel]);

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

        return () => clearInterval(interval);
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
                const seekDuration = miscSettings.seekDuration * 1000;

                if (forward) {
                    playerChannel.currentTime(Math.min(length / 1000, (timestamp + seekDuration) / 1000));
                } else {
                    playerChannel.currentTime(Math.max(0, (timestamp - seekDuration) / 1000));
                }
            },
            () => !videoRef.current
        );
    }, [keyBinder, playerChannel, length, clock, miscSettings]);

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
                    updatePlaybackRate(Math.min(5, video.playbackRate + miscSettings.speedChangeStep), true);
                } else {
                    updatePlaybackRate(Math.max(0.1, video.playbackRate - miscSettings.speedChangeStep), true);
                }
            },
            () => false
        );
    }, [updatePlaybackRate, keyBinder, miscSettings]);

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
        return keyBinder.bindUnblurTrack(
            (event, targetTrack) => {
                event.preventDefault();
                let newSubtitleSettings = { ...subtitleSettings };

                for (let currentTrack = 0; currentTrack < trackCount; ++currentTrack) {
                    const originalValue = textSubtitleSettingsForTrack(subtitleSettings, currentTrack).subtitleBlur!;
                    const targetValue = currentTrack === targetTrack ? !originalValue : originalValue;
                    const change = changeForTextSubtitleSetting(
                        { subtitleBlur: targetValue },
                        newSubtitleSettings,
                        currentTrack
                    );
                    newSubtitleSettings = { ...newSubtitleSettings, ...change };
                }

                onSettingsChanged(newSubtitleSettings);
                setSubtitleSettings(newSubtitleSettings);
            },
            () => false
        );
    }, [keyBinder, subtitleSettings, trackCount, onSettingsChanged]);

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
                        setWasPlayingOnAnkiDialogRequest(true);
                    } else {
                        setWasPlayingOnAnkiDialogRequest(false);
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
        [onAnkiDialogRequest, playerChannel]
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

    const toggleSelectMiningInterval = useCallback(
        (postMineAction: PostMineAction, cardTextFieldValues?: CardTextFieldValues) => {
            if (mineIntervalStartTimestamp === undefined) {
                setMineIntervalStartTimestamp(clock.time(length));

                if (!playing()) {
                    playerChannel.play();
                }

                if (!isMobile) {
                    setAlertSeverity('info');
                    setAlertMessage(t('info.manualMiningIntervalPrompt')!);
                    setAlertDisableAutoHide(true);
                    setAlertOpen(true);
                }
            } else {
                setAlertDisableAutoHide(false);
                setAlertOpen(false);
                const video = videoRef.current;

                if (!video) {
                    return;
                }

                const endTimestamp = clock.time(length);

                if (endTimestamp > mineIntervalStartTimestamp) {
                    let currentSubtitle: SubtitleModel = {
                        text: '',
                        start: mineIntervalStartTimestamp,
                        originalStart: mineIntervalStartTimestamp,
                        end: endTimestamp,
                        originalEnd: endTimestamp,
                        track: 0,
                    };
                    let surroundingSubtitles: SubtitleModel[];

                    if (subtitles.length === 0) {
                        surroundingSubtitles = mockSurroundingSubtitles(currentSubtitle, length, 5000);
                    } else {
                        const calculated = surroundingSubtitlesAroundInterval(
                            subtitles,
                            mineIntervalStartTimestamp,
                            endTimestamp,
                            settings.surroundingSubtitlesCountRadius,
                            settings.surroundingSubtitlesTimeRadius
                        );
                        currentSubtitle = {
                            ...currentSubtitle,
                            text: calculated.subtitle?.text ?? '',
                        };
                        surroundingSubtitles = calculated.surroundingSubtitles ?? [];
                    }

                    mineSubtitle(
                        postMineAction,
                        videoFile,
                        videoFileName ?? '',
                        selectedAudioTrack,
                        video.playbackRate,
                        currentSubtitle,
                        surroundingSubtitles,
                        cardTextFieldValues ?? {},
                        mineIntervalStartTimestamp
                    );
                }

                setMineIntervalStartTimestamp(undefined);
            }
        },
        [
            t,
            mineSubtitle,
            playerChannel,
            mineIntervalStartTimestamp,
            clock,
            length,
            selectedAudioTrack,
            videoFile,
            videoFileName,
            subtitles,
            settings.surroundingSubtitlesCountRadius,
            settings.surroundingSubtitlesTimeRadius,
        ]
    );

    const inferAndExecuteMiningBehavior = useCallback(
        (
            postMineAction: PostMineAction,
            subtitle?: SubtitleModel,
            surroundingSubtitles?: SubtitleModel[],
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            if (!subtitle && !surroundingSubtitles && subtitles.length === 0) {
                toggleSelectMiningInterval(postMineAction, cardTextFieldValues);
            } else {
                if (mineIntervalStartTimestamp !== undefined) {
                    // Edge case: user started manually recording but are now using an "automatic" mining shortcut
                    // Cancel the "recording" operation
                    setAlertDisableAutoHide(false);
                    setAlertOpen(false);
                    setMineIntervalStartTimestamp(undefined);
                }

                mineCurrentSubtitle(postMineAction, subtitle, surroundingSubtitles, cardTextFieldValues);
            }
        },
        [mineCurrentSubtitle, toggleSelectMiningInterval, mineIntervalStartTimestamp, subtitles]
    );

    useEffect(() => {
        return playerChannel.onCopy(inferAndExecuteMiningBehavior);
    }, [playerChannel, inferAndExecuteMiningBehavior]);

    useEffect(() => {
        return keyBinder.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.showAnkiDialog);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return miningContext.onEvent('stopped-mining', () => {
            switch (miscSettings.postMiningPlaybackState) {
                case PostMinePlayback.play:
                    playerChannel.play();
                    break;
                case PostMinePlayback.pause:
                    playerChannel.pause();
                    break;
                case PostMinePlayback.remember:
                    if (wasPlayingOnAnkiDialogRequest) {
                        playerChannel.play();
                    }
                    break;
            }
        });
    }, [miningContext, wasPlayingOnAnkiDialogRequest, miscSettings, playerChannel]);

    useEffect(() => {
        return keyBinder.bindUpdateLastCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.updateLastCard);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return keyBinder.bindExportCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.exportCard);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return keyBinder.bindTakeScreenshot(
            (event) => {
                event.preventDefault();

                if (ankiDialogOpen) {
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
        return keyBinder.bindToggleRecording(
            (event) => {
                event.preventDefault();
                toggleSelectMiningInterval(PostMineAction.showAnkiDialog);
            },
            () => false
        );
    }, [keyBinder, toggleSelectMiningInterval]);

    useEffect(() => {
        return keyBinder.bindCopy(
            (event, subtitle) => {
                event.preventDefault();
                inferAndExecuteMiningBehavior(PostMineAction.none);
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
    }, [extractSubtitles, inferAndExecuteMiningBehavior, keyBinder]);

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
        requestFullscreen(!fullscreen);
    }, [fullscreen, requestFullscreen]);

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
            let change: Partial<SubtitleSettings> = {};

            for (let track = 0; track < subtitleAlignments.length; ++track) {
                change = {
                    ...change,
                    ...changeForTextSubtitleSetting({ subtitleAlignment: alignment }, subtitleSettings, track),
                };
            }

            const newSubtitleSettings = { ...subtitleSettings, ...change };
            setSubtitleAlignments([alignment]);
            onSettingsChanged(newSubtitleSettings);
            setSubtitleSettings(newSubtitleSettings);
        },
        [onSettingsChanged, subtitleSettings, subtitleAlignments]
    );

    const handleClick = useCallback(() => {
        if (playing()) {
            playerChannel.pause();
        } else {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handleDoubleClick = useCallback(() => handleFullscreenToggle(), [handleFullscreenToggle]);

    useEffect(() => {
        if (isMobile) {
            return;
        }

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

    const handleAlertClosed = useCallback(() => {
        setAlertDisableAutoHide(false);
        setAlertOpen(false);
    }, []);
    const trackStyles = useSubtitleStyles(subtitleSettings, trackCount ?? 1);
    const { getSubtitleDomCache } = useSubtitleDomCache(
        subtitles,
        useCallback(
            (subtitle) =>
                showingSubtitleHtml(
                    subtitle,
                    videoRef,
                    trackStyles[subtitle.track]?.styleString ?? trackStyles[0].styleString,
                    trackStyles[subtitle.track]?.classes ?? trackStyles[0].classes,
                    subtitleSettings.imageBasedSubtitleScaleFactor
                ),
            [trackStyles, subtitleSettings.imageBasedSubtitleScaleFactor]
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

    const isPausedDueToHoverRef = useRef<boolean>();

    const handleSubtitleMouseOver = useCallback(() => {
        if (miscSettings.pauseOnHoverMode !== PauseOnHoverMode.disabled && videoRef.current?.paused === false) {
            playerChannel.pause();
            isPausedDueToHoverRef.current = true;
        }
    }, [miscSettings.pauseOnHoverMode, playerChannel]);

    const inBetweenMobileOverlayAndBottomSubtitles = (e: React.MouseEvent<HTMLVideoElement>) => {
        if (!mobileOverlayRef.current || !bottomSubtitleContainerRef.current || !videoRef.current) {
            return;
        }

        const mobileOverlayRect = mobileOverlayRef.current.getBoundingClientRect();
        const subtitleContainerRect = bottomSubtitleContainerRef.current.getBoundingClientRect();
        const videoRect = videoRef.current.getBoundingClientRect();
        const bottom = videoRect.height + videoRect.y;
        const top = subtitleContainerRect.y;
        const left = Math.min(subtitleContainerRect.x, mobileOverlayRect.x);
        const right = Math.max(
            subtitleContainerRect.x + subtitleContainerRect.width,
            mobileOverlayRect.x + mobileOverlayRect.width
        );
        return e.clientY <= bottom && e.clientY >= top && e.clientX >= left && e.clientX <= right;
    };

    const handleVideoMouseOver = useCallback(
        (e: React.MouseEvent<HTMLVideoElement>) => {
            if (
                miscSettings.pauseOnHoverMode === PauseOnHoverMode.inAndOut &&
                isPausedDueToHoverRef.current &&
                !inBetweenMobileOverlayAndBottomSubtitles(e)
            ) {
                playerChannel.play();
                isPausedDueToHoverRef.current = false;
            }
        },
        [miscSettings.pauseOnHoverMode, playerChannel]
    );

    const { lastControlType, setLastControlType } = useLastScrollableControlType({
        isMobile,
        fetchLastControlType,
        saveLastControlType,
    });

    // If the video player is taking up the entire screen, then the subtitle player isn't showing
    // This code assumes some behavior in Player, namely that the subtitle player is automatically hidden
    // (and therefore the VideoPlayer takes up all the space) when there isn't enough room for the subtitle player
    // to be displayed.
    const notEnoughRoomForSubtitlePlayer =
        !subtitlePlayerHidden &&
        parent?.document?.body !== undefined &&
        parent.document.body.clientWidth === document.body.clientWidth;

    const subtitleAlignmentForTrack = (track: number) => subtitleAlignments[track] ?? subtitleAlignments[0];
    const elementForSubtitle = (subtitle: IndexedSubtitleModel, index: number) => (
        <CachedShowingSubtitle
            key={index}
            index={subtitle.index}
            domCache={getSubtitleDomCache()}
            onMouseOver={handleSubtitleMouseOver}
        />
    );

    const subtitleElementsWithAlignment = (alignment: SubtitleAlignment) =>
        showSubtitles.filter((s) => subtitleAlignmentForTrack(s.track) === alignment).map(elementForSubtitle);
    const topSubtitleElements = displaySubtitles ? subtitleElementsWithAlignment('top') : [];
    const bottomSubtitleElements = displaySubtitles ? subtitleElementsWithAlignment('bottom') : [];
    const mobileOverlayModel = () => {
        if (!isMobile || (playing() && mineIntervalStartTimestamp === undefined)) {
            return undefined;
        }

        const timestamp = clock.time(length);

        return {
            offset,
            playbackRate: videoRef.current?.playbackRate ?? 1,
            emptySubtitleTrack: subtitles.length === 0,
            recordingEnabled: true,
            recording: mineIntervalStartTimestamp !== undefined,
            previousSubtitleTimestamp: adjacentSubtitle(false, timestamp, subtitles)?.originalStart ?? undefined,
            nextSubtitleTimestamp: adjacentSubtitle(true, timestamp, subtitles)?.originalStart ?? undefined,
            currentTimestamp: timestamp,
            postMineAction: settings.clickToMineDefaultAction,
            subtitleDisplaying: showSubtitles.length > 0,
            subtitlesAreVisible: displaySubtitles,
            playMode,
            themeType: settings.themeType,
        };
    };
    const baseBottomSubtitleOffset = !playing() && isMobile ? overlayContainerHeight : 0;
    const alertAnchor = subtitleAlignments[0] === 'top' ? 'bottom' : 'top';

    if (!playerChannelSubscribed || lastControlType === undefined) {
        return null;
    }

    return (
        <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className={classes.root}>
            <Alert
                open={alertOpen}
                disableAutoHide={alertDisableAutoHide}
                onClose={handleAlertClosed}
                autoHideDuration={3000}
                severity={alertSeverity}
                anchor={alertAnchor}
            >
                {alertMessage}
            </Alert>
            <MobileVideoOverlay
                ref={mobileOverlayRef}
                model={mobileOverlayModel()}
                className={classes.mobileOverlay}
                anchor={'bottom'}
                tooltipsEnabled={true}
                initialControlType={lastControlType}
                onScrollToControlType={setLastControlType}
                onMineSubtitle={() => inferAndExecuteMiningBehavior(settings.clickToMineDefaultAction)}
                onOffset={handleOffsetChange}
                onPlaybackRate={handlePlaybackRateChange}
                onPlayModeSelected={handlePlayMode}
                onSeek={handleSeekByTimestamp}
                onToggleSubtitles={handleSubtitlesToggle}
            />
            <video
                preload="auto"
                controls={false}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={showCursor ? classes.video : `${classes.cursorHidden} ${classes.video}`}
                ref={videoRefCallback}
                src={videoFile}
                onMouseOver={handleVideoMouseOver}
            />
            {topSubtitleElements.length > 0 && (
                <SubtitleContainer alignment={'top'} subtitleSettings={subtitleSettings} baseOffset={0}>
                    {topSubtitleElements}
                </SubtitleContainer>
            )}
            {bottomSubtitleElements.length > 0 && (
                <SubtitleContainer
                    ref={bottomSubtitleContainerRef}
                    alignment={'bottom'}
                    subtitleSettings={subtitleSettings}
                    baseOffset={baseBottomSubtitleOffset}
                >
                    {bottomSubtitleElements}
                </SubtitleContainer>
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
                subtitleAlignment={subtitleAlignments[0]}
                subtitleAlignmentEnabled={subtitleAlignments.length === 1}
                onSubtitleAlignment={handleSubtitleAlignment}
                hideToolbar={isMobile}
                onLoadFiles={popOut ? undefined : handleLoadFiles}
            />
        </div>
    );
}
