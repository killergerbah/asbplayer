import React, { useCallback, useEffect, useState, useRef, MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles, withStyles, useTheme } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import CloseIcon from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Popover from '@material-ui/core/Popover';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import AspectRatioIcon from '@material-ui/icons/AspectRatio';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import Slider from '@material-ui/core/Slider';
import TuneIcon from '@material-ui/icons/Tune';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import VerticalAlignTopIcon from '@material-ui/icons/VerticalAlignTop';
import VerticalAlignBottomIcon from '@material-ui/icons/VerticalAlignBottom';
import VideocamIcon from '@material-ui/icons/Videocam';
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import { AudioTrackModel, PlayMode, VideoTabModel } from '@project/common';
import { SubtitleAlignment } from '@project/common/settings';
import Clock from '../services/clock';
import PlaybackPreferences from '../services/playback-preferences';
import Tooltip from '@material-ui/core/Tooltip';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { isMobile } from 'react-device-detect';
const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '50%',
        bottom: 0,
        pointerEvents: 'none',
        color: '#fff',
    },
    buttonContainer: {
        flexDirection: 'row',
    },
    timeDisplay: {
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        cursor: 'default',
        fontSize: 20,
        marginLeft: 10,
        whiteSpace: 'nowrap',
    },
    numberInput: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: 20,
        marginLeft: 10,
        width: 100,
        color: '#fff',
        pointerEvents: 'auto',
    },
    volumeInputContainerShown: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 5,
        pointerEvents: 'auto',
    },
    volumeInputContainerHidden: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 0,
        pointerEvents: 'auto',
    },
    volumeInputHidden: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        width: 0,
        pointerEvents: 'auto',
    },
    volumeInputShown: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        width: 100,
        pointerEvents: 'auto',
    },
    volumeInputThumbHidden: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        opacity: 0,
        pointerEvents: 'auto',
    },
    volumeInputThumbShown: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        opacity: 1,
        pointerEvents: 'auto',
    },
    subContainer: {
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, .4) 40%, rgba(0, 0, 0, 0.7))',
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
    },
    button: {
        pointerEvents: 'auto',
    },
    inactiveButton: {
        color: 'rgba(120, 120, 120, 0.7)',
        pointerEvents: 'auto',
    },
    inactiveTopButton: {
        color: 'rgba(255, 255, 255, 0.5)',
        pointerEvents: 'auto',
    },
    progress: {
        margin: 5,
    },
    topButton: {
        pointerEvents: 'auto',
        color: '#fff',
    },
    gridContainer: {
        pointerEvents: 'auto',
        padding: 2,
    },
}));

const useProgressBarStyles = makeStyles((theme) => ({
    root: {
        height: 10,
    },
    container: {
        height: 10,
        pointerEvents: 'auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        position: 'absolute',
        width: 'calc(100% - 20px)',
        marginLeft: 10,
    },
    mouseEventListener: {
        zIndex: 1,
        height: 10,
        cursor: 'pointer',
        pointerEvents: 'auto',
        position: 'absolute',
        width: '100%',
    },
    fillContainer: {
        background: 'rgba(30,30,30,0.7)',
        width: '100%',
        height: 5,
        position: 'relative',
    },
    fillContainerThick: {
        transition: theme.transitions.create('height', {
            easing: theme.transitions.easing.easeInOut,
            duration: 50,
        }),
        height: 8,
    },
    fill: {
        background: 'linear-gradient(to left, #ff1f62, #49007a)',
        height: '100%',
    },
    handleContainer: {
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        height: '100%',
        bottom: 0,
    },
    handle: {
        borderRadius: '50%',
        width: 16,
        height: 16,
        opacity: 0,
        left: -8,
        background: 'white',
        position: 'absolute',
    },
    handleOn: {
        opacity: 1,
        transition: theme.transitions.create('opacity', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.shortest,
        }),
    },
}));

const VolumeSlider = withStyles((theme) => ({
    root: {
        color: 'white',
        verticalAlign: 'middle',
    },
    thumb: {
        backgroundColor: 'white',
        color: 'white',
        '&:focus': {
            boxShadow: 'inherit',
        },
        '&:hover, &$active': {
            boxShadow: '0px 0px 0px 8px rgba(255, 255, 255, 0.1)',
        },
    },
    active: {
        color: 'white',
    },
}))(Slider);

function displayTime(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsInMinute = seconds % 60;
    return String(minutes) + ':' + String(secondsInMinute).padStart(2, '0');
}

function elementWidth(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
}

interface ProgressBarProps {
    onSeek: (progress: number) => void;
    value: number;
}

function ProgressBar({ onSeek, value }: ProgressBarProps) {
    const classes = useProgressBarStyles();
    const [mouseOver, setMouseOver] = useState(false);
    const containerRef = useRef(null);

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            // Account for margins by subtracting 10 from left/right sides
            const width = rect.right - rect.left - 20;
            const progress = Math.min(1, Math.max(0, (e.pageX - rect.left - 10) / width));
            onSeek(progress);
        },
        [onSeek]
    );

    const handleMouseOver = useCallback(() => setMouseOver(true), []);
    const handleMouseOut = useCallback(() => setMouseOver(false), []);
    const progressWidth = containerRef.current ? (elementWidth(containerRef.current) * value) / 100 : 0;
    const fillStyle = { width: progressWidth };
    const handleStyle = { marginLeft: progressWidth };
    const fillContainerClassName = mouseOver
        ? classes.fillContainer + ' ' + classes.fillContainerThick
        : classes.fillContainer;
    const handleClassName = mouseOver ? classes.handle + ' ' + classes.handleOn : classes.handle;

    return (
        <div className={classes.root}>
            <div ref={containerRef} className={classes.container}>
                <div className={fillContainerClassName}>
                    <div className={classes.fill} style={fillStyle}></div>
                    <div className={classes.handleContainer}>
                        <div className={handleClassName} style={handleStyle} />
                    </div>
                </div>
            </div>
            <div
                className={classes.mouseEventListener}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            ></div>
        </div>
    );
}

interface AudioTrackSelectorProps {
    open: boolean;
    anchorEl?: Element;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    onAudioTrackSelected: (id: string) => void;
    onClose: () => void;
}

function AudioTrackSelector({
    open,
    anchorEl,
    audioTracks,
    selectedAudioTrack,
    onAudioTrackSelected,
    onClose,
}: AudioTrackSelectorProps) {
    if (!audioTracks || audioTracks.length === 0) {
        return null;
    }

    const list = audioTracks.map((t) => {
        return (
            <ListItem
                key={t.id}
                selected={t.id === selectedAudioTrack}
                button
                onClick={() => onAudioTrackSelected(t.id)}
            >
                {t.language} {t.label}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
            >
                <List>{list}</List>
            </Popover>
        </div>
    );
}

interface TabSelectorProps {
    open: boolean;
    anchorEl?: Element;
    tabs?: VideoTabModel[];
    selectedTab?: VideoTabModel;
    onTabSelected: (tab: VideoTabModel) => void;
    onClose: () => void;
}

function TabSelector({ open, anchorEl, onClose, tabs, selectedTab, onTabSelected }: TabSelectorProps) {
    if (!tabs || tabs.length === 0) {
        return null;
    }

    const list = tabs.map((t) => {
        return (
            <ListItem
                key={`${t.id}:${t.src}`}
                selected={selectedTab && t.id === selectedTab.id && t.src === selectedTab.src}
                button
                onClick={() => onTabSelected(t)}
            >
                {t.id} {t.title} {t.src}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
            >
                <List>{list}</List>
            </Popover>
        </div>
    );
}

interface MediaUnloaderProps {
    open: boolean;
    anchorEl?: Element;
    file?: string;
    onUnload: () => void;
    onClose: () => void;
}

function MediaUnloader({ open, anchorEl, onUnload, onClose, file }: MediaUnloaderProps) {
    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
            >
                <List>
                    <ListItem button onClick={(e) => onUnload()}>
                        Unload {file}
                    </ListItem>
                </List>
            </Popover>
        </div>
    );
}

interface PlayModeSelectorProps {
    open: boolean;
    anchorEl?: Element;
    selectedPlayMode?: PlayMode;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
}

function PlayModeSelector({ open, anchorEl, selectedPlayMode, onPlayMode, onClose }: PlayModeSelectorProps) {
    const { t } = useTranslation();

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
            >
                <List>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.normal}
                        button
                        onClick={(e) => onPlayMode(PlayMode.normal)}
                    >
                        {t('controls.normalMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.condensed}
                        button
                        onClick={(e) => onPlayMode(PlayMode.condensed)}
                    >
                        {t('controls.condensedMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.fastForward}
                        button
                        onClick={(e) => onPlayMode(PlayMode.fastForward)}
                    >
                        {t('controls.fastForwardMode')}
                    </ListItem>
                    <ListItem
                        selected={selectedPlayMode === PlayMode.autoPause}
                        button
                        onClick={(e) => onPlayMode(PlayMode.autoPause)}
                    >
                        {t('controls.autoPauseMode')}
                    </ListItem>
                </List>
            </Popover>
        </div>
    );
}

interface ResponsiveButtonGroupProps {
    children: React.ReactNode[];
}

const ResponsiveButtonGroup = ({ children }: ResponsiveButtonGroupProps) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down(600));
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement>();

    const handleCloseMenu = () => {
        setAnchorEl(undefined);
    };

    const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setAnchorEl(e.currentTarget);
    };

    const anchorExists = anchorEl !== undefined && document.body.contains(anchorEl);
    const definedChildren = children.filter((c) => c !== undefined && c !== false);

    if (isSmallScreen && definedChildren.length > 1) {
        return (
            <>
                <Grid item>
                    <IconButton color="inherit" onClick={handleOpenMenu}>
                        <MoreVertIcon />
                    </IconButton>
                </Grid>
                <Menu anchorEl={anchorExists ? anchorEl : undefined} open={anchorExists} onClose={handleCloseMenu}>
                    {definedChildren.map((child, i) => {
                        return <MenuItem key={i}>{child}</MenuItem>;
                    })}
                </Menu>
            </>
        );
    }

    return (
        <>
            {children.map((child, i) => {
                return (
                    <Grid item key={i}>
                        {child}
                    </Grid>
                );
            })}
        </>
    );
};

export interface Point {
    x: number;
    y: number;
}

interface ControlsProps {
    clock: Clock;
    length: number;
    offsetEnabled?: boolean;
    displayLength?: number;
    offset: number;
    playbackRate: number;
    playbackRateEnabled?: boolean;
    onAudioTrackSelected: (id: string) => void;
    onSeek: (progress: number) => void;
    mousePositionRef: MutableRefObject<Point>;
    onShow?: (show: boolean) => void;
    onPause: () => void;
    onPlay: () => void;
    onTabSelected?: (tab: VideoTabModel) => void;
    onUnloadVideo?: () => void;
    onOffsetChange: (offset: number) => void;
    onPlaybackRateChange: (playbackRate: number) => void;
    onVolumeChange?: (volume: number) => void;
    disableKeyEvents?: boolean;
    playbackPreferences: PlaybackPreferences;
    closeEnabled?: boolean;
    onClose?: () => void;
    volumeEnabled?: boolean;
    playMode?: PlayMode;
    playModeEnabled?: boolean;
    onPlayMode?: (playMode: PlayMode) => void;
    subtitlesEnabled?: boolean;
    subtitlesToggle?: boolean;
    onSubtitlesToggle?: () => void;
    videoFile?: string;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    tabs?: VideoTabModel[];
    selectedTab?: VideoTabModel;
    popOutEnabled?: boolean;
    popOut?: boolean;
    onPopOutToggle?: () => void;
    fullscreenEnabled?: boolean;
    fullscreen?: boolean;
    onFullscreenToggle?: () => void;
    hideSubtitlePlayerToggleEnabled?: boolean;
    subtitlePlayerHidden?: boolean;
    onHideSubtitlePlayerToggle?: () => void;
    showOnMouseMovement: boolean;
    theaterModeToggleEnabled?: boolean;
    theaterModeEnabled?: boolean;
    onTheaterModeToggle?: () => void;
    subtitleAlignmentEnabled?: boolean;
    subtitleAlignment?: SubtitleAlignment;
    onSubtitleAlignment?: (alignment: SubtitleAlignment) => void;
}

export default function Controls({
    clock,
    length,
    offsetEnabled,
    displayLength,
    offset,
    playbackRate,
    playbackRateEnabled,
    onAudioTrackSelected,
    onSeek,
    mousePositionRef,
    onShow,
    onPause,
    onPlay,
    onTabSelected,
    onUnloadVideo,
    onOffsetChange,
    onPlaybackRateChange,
    onVolumeChange,
    disableKeyEvents,
    playbackPreferences,
    closeEnabled,
    onClose,
    volumeEnabled,
    playMode,
    playModeEnabled,
    onPlayMode,
    subtitlesEnabled,
    subtitlesToggle,
    onSubtitlesToggle,
    videoFile,
    audioTracks,
    selectedAudioTrack,
    tabs,
    selectedTab,
    popOutEnabled,
    popOut,
    onPopOutToggle,
    fullscreenEnabled,
    fullscreen,
    onFullscreenToggle,
    hideSubtitlePlayerToggleEnabled,
    subtitlePlayerHidden,
    onHideSubtitlePlayerToggle,
    showOnMouseMovement,
    theaterModeToggleEnabled,
    theaterModeEnabled,
    onTheaterModeToggle,
    subtitleAlignment,
    subtitleAlignmentEnabled,
    onSubtitleAlignment,
}: ControlsProps) {
    const classes = useControlStyles();
    const { t } = useTranslation();
    const [show, setShow] = useState<boolean>(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState<boolean>(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState<Element>();
    const [tabSelectorOpen, setTabSelectorOpen] = useState<boolean>(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState<Element>();
    const [videoUnloaderOpen, setVideoUnloaderOpen] = useState<boolean>(false);
    const [videoUnloaderAnchorEl, setVideoUnloaderAnchorEl] = useState<Element>();
    const [playModeSelectorOpen, setPlayModeSelectorOpen] = useState<boolean>(false);
    const [playModeSelectorAnchorEl, setPlayModeSelectorAnchorEl] = useState<Element>();
    const [showVolumeBar, setShowVolumeBar] = useState<boolean>(false);
    const [volume, setVolume] = useState<number>(100);
    const [lastCommittedVolume, setLastCommittedVolume] = useState<number>(100);
    const theme = useTheme();
    const isReallySmallScreen = useMediaQuery(theme.breakpoints.down(380));
    const lastMousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const lastShowTimestampRef = useRef<number>(Date.now());
    const lastNumberInputChangeTimestampRef = useRef<number>(Date.now());
    const lastShowRef = useRef<boolean>(true);
    const forceShowRef = useRef<boolean>(false);
    const [offsetInputWidth, setOffsetInputWidth] = useState<number>(5);
    const [playbackRateInputWidth, setPlaybackRateInputWidth] = useState<number>(5);
    const offsetInputRef = useRef<HTMLInputElement>();
    const playbackRateInputRef = useRef<HTMLInputElement>();
    const containerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [, updateState] = useState<any>();
    const forceUpdate = useCallback(() => updateState({}), []);

    const handleSeek = useCallback(
        (progress: number) => {
            onSeek(progress);
        },
        [onSeek]
    );

    function handleMouseOver() {
        forceShowRef.current = true;
    }

    function handleMouseOut() {
        forceShowRef.current = false;
    }

    useEffect(() => {
        const savedVolume = Number(playbackPreferences.volume);
        setVolume(savedVolume);
        onVolumeChange?.(savedVolume / 100);

        if (savedVolume > 0) {
            setLastCommittedVolume(savedVolume);
        }
    }, [playbackPreferences, onVolumeChange]);

    const [playing, setPlaying] = useState<boolean>(clock.running);
    useEffect(() => {
        clock.onEvent('start', () => setPlaying(true));
        setPlaying(clock.running);
    }, [clock]);
    useEffect(() => {
        clock.onEvent('stop', () => setPlaying(false));
        setPlaying(clock.running);
    }, [clock]);

    useEffect(() => {
        const interval = setInterval(() => {
            let currentShow: boolean;

            if (showOnMouseMovement) {
                currentShow =
                    Date.now() - lastShowTimestampRef.current < 2000 ||
                    Math.pow(mousePositionRef.current.x - lastMousePositionRef.current.x, 2) +
                        Math.pow(mousePositionRef.current.y - lastMousePositionRef.current.y, 2) >
                        100;
            } else {
                currentShow =
                    ((containerRef.current && mousePositionRef.current.y > containerRef.current.offsetTop - 20) ||
                        (closeButtonRef.current &&
                            mousePositionRef.current.y < closeButtonRef.current.offsetHeight + 20)) ??
                    false;
            }

            currentShow =
                currentShow ||
                forceShowRef.current ||
                offsetInputRef.current === document.activeElement ||
                playbackRateInputRef.current === document.activeElement ||
                (!playing && isMobile) ||
                Date.now() - lastNumberInputChangeTimestampRef.current < 2000;

            if (currentShow && !lastShowRef.current) {
                lastShowTimestampRef.current = Date.now();
                setShow(currentShow);
            } else if (!currentShow && lastShowRef.current) {
                setShow(currentShow);
            }

            lastShowRef.current = currentShow;
            lastMousePositionRef.current.x = mousePositionRef.current.x;
            lastMousePositionRef.current.y = mousePositionRef.current.y;
        }, 100);
        return () => clearInterval(interval);
    }, [mousePositionRef, showOnMouseMovement, playing]);

    useEffect(() => onShow?.(show), [onShow, show]);

    const updateOffset = useCallback((offset: number) => {
        if (offsetInputRef.current) {
            if (offset === 0) {
                offsetInputRef.current.value = '';
                setOffsetInputWidth(5);
            } else {
                const offsetSeconds = offset / 1000;
                const value = offsetSeconds >= 0 ? '+' + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
                offsetInputRef.current.value = value;
                lastNumberInputChangeTimestampRef.current = Date.now();
                setOffsetInputWidth(value.length);
            }
            offsetInputRef.current.blur();
        }
    }, []);

    const updatePlaybackRate = useCallback((playbackRate: number) => {
        if (playbackRateInputRef.current) {
            if (playbackRate === 1) {
                playbackRateInputRef.current.value = '';
                setPlaybackRateInputWidth(5);
            } else {
                const value = '×' + String(playbackRate.toFixed(2));
                playbackRateInputRef.current.value = value;
                lastNumberInputChangeTimestampRef.current = Date.now();
                setPlaybackRateInputWidth(value.length);
            }
            playbackRateInputRef.current.blur();
        }
    }, []);

    useEffect(() => {
        if (disableKeyEvents) {
            return;
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Enter') {
                if (offsetInputRef.current === document.activeElement) {
                    const newOffset = Number(offsetInputRef.current.value);

                    if (newOffset === offset) {
                        updateOffset(offset);
                        return;
                    }

                    if (Number.isNaN(newOffset)) {
                        return;
                    }

                    onOffsetChange(newOffset * 1000);
                } else if (playbackRateInputRef.current === document.activeElement) {
                    const newPlaybackRate = Number(playbackRateInputRef.current.value);

                    if (playbackRate === newPlaybackRate) {
                        updatePlaybackRate(playbackRate);
                        return;
                    }

                    if (Number.isNaN(newPlaybackRate) || newPlaybackRate < 0.1 || newPlaybackRate > 5) {
                        return;
                    }

                    onPlaybackRateChange(newPlaybackRate);
                }
            }
        }

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [
        onOffsetChange,
        onPlaybackRateChange,
        updateOffset,
        updatePlaybackRate,
        offset,
        playbackRate,
        disableKeyEvents,
    ]);

    const handleNumberInputClicked = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
        const inputElement = e.target as HTMLInputElement;
        inputElement.setSelectionRange(0, inputElement.value?.length || 0);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate();
        }, 100);

        return () => clearInterval(interval);
    }, [forceUpdate]);

    useEffect(() => {
        updateOffset(offset);
    }, [offset, updateOffset]);

    useEffect(() => {
        updatePlaybackRate(playbackRate);
    }, [playbackRate, updatePlaybackRate]);

    const handleAudioTrackSelectorClosed = useCallback(() => {
        setAudioTrackSelectorAnchorEl(undefined);
        setAudioTrackSelectorOpen(false);
    }, []);

    const handleAudioTrackSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setAudioTrackSelectorAnchorEl(e.currentTarget);
        setAudioTrackSelectorOpen(true);
    }, []);

    const handleAudioTrackSelected = useCallback(
        (id: string) => {
            onAudioTrackSelected(id);
            setAudioTrackSelectorAnchorEl(undefined);
            setAudioTrackSelectorOpen(false);
        },
        [onAudioTrackSelected]
    );

    const handleTabSelectorClosed = useCallback(() => {
        setTabSelectorAnchorEl(undefined);
        setTabSelectorOpen(false);
    }, []);

    const handleTabSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setTabSelectorAnchorEl(e.currentTarget);
        setTabSelectorOpen(true);
    }, []);

    const handleTabSelected = useCallback(
        (tab: VideoTabModel) => {
            onTabSelected?.(tab);
            setTabSelectorAnchorEl(undefined);
            setTabSelectorOpen(false);
        },
        [onTabSelected]
    );

    const handleVideoUnloaderClosed = useCallback(() => {
        setVideoUnloaderAnchorEl(undefined);
        setVideoUnloaderOpen(false);
    }, []);

    const handleVideoUnloaderOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setVideoUnloaderAnchorEl(e.currentTarget);
        setVideoUnloaderOpen(true);
    }, []);

    const handleUnloadVideo = useCallback(() => {
        onUnloadVideo?.();
        setVideoUnloaderOpen(false);
    }, [onUnloadVideo]);

    const handlePlayModeSelectorClosed = useCallback(() => {
        setPlayModeSelectorAnchorEl(undefined);
        setPlayModeSelectorOpen(false);
    }, []);

    const handlePlayModeSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setPlayModeSelectorAnchorEl(e.currentTarget);
        setPlayModeSelectorOpen(true);
    }, []);

    const handlePlayModeSelected = useCallback(
        (playMode: PlayMode) => {
            onPlayMode?.(playMode);
            setPlayModeSelectorAnchorEl(undefined);
            setPlayModeSelectorOpen(false);
        },
        [onPlayMode]
    );

    const handleVolumeMouseOut = useCallback(() => setShowVolumeBar(false), []);
    const handleVolumeMouseOver = useCallback(() => setShowVolumeBar(true), []);

    const handleVolumeChange = useCallback(
        (e: React.ChangeEvent<{}>, value: number | number[]) => {
            if (typeof value !== 'number') {
                return;
            }

            setVolume(value);
            onVolumeChange?.(value / 100);
        },
        [onVolumeChange]
    );

    const handleVolumeChangeCommitted = useCallback(
        (e: React.ChangeEvent<{}>, value: number | number[]) => {
            if (typeof value !== 'number') {
                return;
            }

            if (value > 0) {
                setLastCommittedVolume(value);
            }

            playbackPreferences.volume = value;
        },
        [playbackPreferences]
    );

    const handleVolumeToggle = useCallback(() => {
        setVolume((volume) => {
            const newVolume = volume > 0 ? 0 : lastCommittedVolume;
            onVolumeChange?.(newVolume / 100);
            return newVolume;
        });
    }, [onVolumeChange, lastCommittedVolume]);

    const handleSubtitleAlignment = useCallback(() => {
        if (!subtitleAlignmentEnabled || subtitleAlignment === undefined || onSubtitleAlignment === undefined) {
            return;
        }

        const newAlignment = subtitleAlignment === 'top' ? 'bottom' : 'top';
        onSubtitleAlignment(newAlignment);
    }, [subtitleAlignment, subtitleAlignmentEnabled, onSubtitleAlignment]);

    const progress = clock.progress(length);

    return (
        <React.Fragment>
            <Fade in={show} timeout={200}>
                <Grid container style={{ position: 'absolute', top: 0 }}>
                    <Grid item style={{ flexGrow: 1 }}>
                        {closeEnabled && (
                            <Tooltip title={t('controls.unloadVideo')!}>
                                <IconButton
                                    ref={closeButtonRef}
                                    color="inherit"
                                    className={classes.topButton}
                                    onClick={onClose}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Grid>
                    <Grid item>
                        {theaterModeToggleEnabled && (
                            <Tooltip title={t('controls.toggleTheaterMode')!}>
                                <IconButton
                                    color="inherit"
                                    className={theaterModeEnabled ? classes.topButton : classes.inactiveTopButton}
                                    onClick={onTheaterModeToggle}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    <AspectRatioIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                        {hideSubtitlePlayerToggleEnabled && (
                            <Tooltip
                                title={
                                    subtitlePlayerHidden
                                        ? t('controls.showSubtitlePlayer')!
                                        : t('controls.hideSubtitlePlayer')!
                                }
                            >
                                <IconButton
                                    color="inherit"
                                    className={classes.topButton}
                                    onClick={onHideSubtitlePlayerToggle}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    {subtitlePlayerHidden ? <ArrowBackIcon /> : <ArrowForwardIcon />}
                                </IconButton>
                            </Tooltip>
                        )}
                    </Grid>
                </Grid>
            </Fade>
            <div
                ref={containerRef}
                className={classes.container}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            >
                <Fade in={show} timeout={200}>
                    <div className={classes.subContainer}>
                        <ProgressBar onSeek={handleSeek} value={progress * 100} />
                        <Grid container className={classes.gridContainer} direction="row" wrap="nowrap">
                            <Grid item>
                                <IconButton color="inherit" onClick={() => (playing ? onPause() : onPlay())}>
                                    {playing ? (
                                        <PauseIcon className={classes.button} />
                                    ) : (
                                        <PlayArrowIcon className={classes.button} />
                                    )}
                                </IconButton>
                            </Grid>
                            {volumeEnabled && (
                                <Grid
                                    item
                                    onMouseOver={handleVolumeMouseOver}
                                    onMouseOut={handleVolumeMouseOut}
                                    className={
                                        showVolumeBar
                                            ? classes.volumeInputContainerShown
                                            : classes.volumeInputContainerHidden
                                    }
                                >
                                    <Grid container spacing={0} direction="row" wrap="nowrap">
                                        <Grid item>
                                            <IconButton color="inherit" onClick={handleVolumeToggle}>
                                                {volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
                                            </IconButton>
                                        </Grid>
                                        <Grid
                                            item
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <VolumeSlider
                                                onChange={handleVolumeChange}
                                                onChangeCommitted={handleVolumeChangeCommitted}
                                                value={volume}
                                                defaultValue={100}
                                                classes={{
                                                    root: showVolumeBar
                                                        ? classes.volumeInputShown
                                                        : classes.volumeInputHidden,
                                                    thumb: showVolumeBar
                                                        ? classes.volumeInputThumbShown
                                                        : classes.volumeInputThumbHidden,
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>
                            )}
                            <Grid item>
                                <div className={classes.timeDisplay}>
                                    {displayTime(progress * length)} / {displayTime(displayLength || length)}
                                </div>
                            </Grid>
                            {offsetEnabled && !showVolumeBar && !isReallySmallScreen && (
                                <Grid item>
                                    <Tooltip title={t('controls.subtitleOffset')!}>
                                        <Input
                                            style={{
                                                width: `${offsetInputWidth}ch`,
                                            }}
                                            inputRef={offsetInputRef}
                                            disableUnderline={true}
                                            className={classes.numberInput}
                                            placeholder={'±' + Number(0).toFixed(2)}
                                            onClick={handleNumberInputClicked}
                                            onChange={(e) => setOffsetInputWidth(Math.max(5, e.target.value.length))}
                                        />
                                    </Tooltip>
                                </Grid>
                            )}
                            {playbackRateEnabled && !showVolumeBar && !isReallySmallScreen && (
                                <Grid item>
                                    <Tooltip title={t('controls.playbackRate')!}>
                                        <Input
                                            style={{
                                                width: `${playbackRateInputWidth}ch`,
                                                marginLeft: 4,
                                            }}
                                            inputRef={playbackRateInputRef}
                                            disableUnderline={true}
                                            className={classes.numberInput}
                                            placeholder={'×' + Number(1).toFixed(2)}
                                            onClick={handleNumberInputClicked}
                                            onChange={(e) =>
                                                setPlaybackRateInputWidth(Math.max(5, e.target.value.length))
                                            }
                                        />
                                    </Tooltip>
                                </Grid>
                            )}
                            <Grid item style={{ flexGrow: 1 }}></Grid>
                            <ResponsiveButtonGroup>
                                {subtitleAlignmentEnabled && subtitleAlignment !== undefined && (
                                    <Tooltip title={t('controls.subtitleAlignment')!}>
                                        <IconButton color="inherit" onClick={handleSubtitleAlignment}>
                                            {subtitleAlignment === 'top' ? (
                                                <VerticalAlignTopIcon />
                                            ) : (
                                                <VerticalAlignBottomIcon />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {subtitlesToggle && (
                                    <Tooltip title={t('controls.toggleSubtitles')!}>
                                        <IconButton color="inherit" onClick={onSubtitlesToggle}>
                                            <SubtitlesIcon
                                                className={subtitlesEnabled ? classes.button : classes.inactiveButton}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {videoFile && (
                                    <Tooltip title={t('controls.unloadVideo')!}>
                                        <IconButton color="inherit" onClick={handleVideoUnloaderOpened}>
                                            <VideocamIcon className={classes.button} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {audioTracks && audioTracks.length > 1 && (
                                    <Tooltip title={t('controls.selectAudioTrack')!}>
                                        <IconButton color="inherit" onClick={handleAudioTrackSelectorOpened}>
                                            <QueueMusicIcon className={classes.button} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {tabs && tabs.length > 0 && (
                                    <Tooltip title={t('controls.selectVideoElement')!}>
                                        <IconButton color="inherit" onClick={handleTabSelectorOpened}>
                                            <VideocamIcon
                                                className={selectedTab ? classes.button : classes.inactiveButton}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {playModeEnabled && (
                                    <Tooltip title={t('controls.playbackMode')!}>
                                        <IconButton color="inherit" onClick={handlePlayModeSelectorOpened}>
                                            <TuneIcon
                                                className={playModeEnabled ? classes.button : classes.inactiveButton}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {popOutEnabled && (
                                    <Tooltip title={popOut ? t('controls.popIn')! : t('controls.popOut')!}>
                                        <IconButton color="inherit" onClick={onPopOutToggle}>
                                            <OpenInNewIcon
                                                className={classes.button}
                                                style={popOut ? { transform: 'rotateX(180deg)' } : {}}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {fullscreenEnabled && (
                                    <Tooltip title={t('controls.toggleFullscreen')!}>
                                        <IconButton color="inherit" onClick={onFullscreenToggle}>
                                            {fullscreen ? (
                                                <FullscreenExitIcon className={classes.button} />
                                            ) : (
                                                <FullscreenIcon className={classes.button} />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </ResponsiveButtonGroup>
                        </Grid>
                    </div>
                </Fade>
                <TabSelector
                    open={tabSelectorOpen && show}
                    anchorEl={tabSelectorAnchorEl}
                    tabs={tabs}
                    selectedTab={selectedTab}
                    onClose={handleTabSelectorClosed}
                    onTabSelected={handleTabSelected}
                />
                <AudioTrackSelector
                    open={audioTrackSelectorOpen && show}
                    anchorEl={audioTrackSelectorAnchorEl}
                    audioTracks={audioTracks}
                    selectedAudioTrack={selectedAudioTrack}
                    onClose={handleAudioTrackSelectorClosed}
                    onAudioTrackSelected={handleAudioTrackSelected}
                />
                <MediaUnloader
                    open={videoUnloaderOpen}
                    anchorEl={videoUnloaderAnchorEl}
                    file={videoFile}
                    onClose={handleVideoUnloaderClosed}
                    onUnload={handleUnloadVideo}
                />
                <PlayModeSelector
                    open={playModeSelectorOpen && show}
                    anchorEl={playModeSelectorAnchorEl}
                    selectedPlayMode={playMode}
                    onClose={handlePlayModeSelectorClosed}
                    onPlayMode={handlePlayModeSelected}
                />
            </div>
        </React.Fragment>
    );
}
