import React, { useCallback, useEffect, useState, useMemo, useRef, createRef, RefObject } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { keysAreEqual } from '../services/util';
import { useWindowSize } from '../hooks/useWindowSize';
import {
    AsbplayerSettingsProvider,
    PostMineAction,
    surroundingSubtitles,
    SubtitleModel,
    SubtitleCollection,
    KeyBinder,
    AutoPauseContext,
} from '@project/common';
import { SubtitleTextImage } from '@project/common/components';
import FileCopy from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow, { TableRowProps } from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import Clock from '../services/Clock';

interface StylesProps {
    compressed: boolean;
    appBarHidden: boolean;
    windowWidth: number;
}

const useSubtitlePlayerStyles = makeStyles<Theme, StylesProps, string>((theme) => ({
    container: {
        height: ({ appBarHidden }) => (appBarHidden ? '100vh' : 'calc(100vh - 64px)'),
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: theme.palette.background.default,
        width: ({ compressed, windowWidth }) => (compressed ? Math.max(350, 0.25 * windowWidth) : '100%'),
    },
    table: {
        backgroundColor: theme.palette.background.default,
        marginBottom: 75, // so the last row doesn't collide with controls
    },
    noSubtitles: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        textAlign: 'center',
    },
}));

const useSubtitleRowStyles = makeStyles((theme) => ({
    subtitleRow: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
    },
    subtitle: {
        fontSize: 20,
        paddingRight: 0,
        minWidth: 200,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
    },
    compressedSubtitle: {
        fontSize: 16,
        paddingRight: 0,
        minWidth: 200,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
    },
    disabledSubtitle: {
        color: 'transparent',
        backgroundColor: theme.palette.action.disabledBackground,
        borderRadius: 5,
    },
    timestamp: {
        fontSize: 14,
        color: '#aaaaaa',
        textAlign: 'right',
        paddingRight: 15,
        paddingLeft: 5,
    },
    copyButton: {
        textAlign: 'right',
        padding: 0,
    },
}));

export interface DisplaySubtitleModel extends SubtitleModel {
    displayTime: string;
    index: number;
}

interface SubtitleRowProps extends TableRowProps {
    index: number;
    compressed: boolean;
    selected: boolean;
    disabled: boolean;
    subtitle: DisplaySubtitleModel;
    copyButtonEnabled: boolean;
    subtitleRef: RefObject<HTMLTableRowElement>;
    onClickSubtitle: (index: number) => void;
    onCopySubtitle: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, index: number) => void;
}

const SubtitleRow = React.memo((props: SubtitleRowProps) => {
    const {
        index,
        selected,
        subtitleRef,
        onClickSubtitle,
        onCopySubtitle,
        compressed,
        disabled,
        subtitle,
        copyButtonEnabled,
        ...tableRowProps
    } = props;
    const classes = useSubtitleRowStyles();
    const textRef = useRef<HTMLSpanElement>(null);
    const [textSelected, setTextSelected] = useState<boolean>(false);
    let className = compressed ? classes.compressedSubtitle : classes.subtitle;
    let disabledClassName = disabled ? classes.disabledSubtitle : '';

    if (subtitle.start < 0 || subtitle.end < 0) {
        return null;
    }

    function handleMouseUp() {
        const selection = document.getSelection();
        const selected =
            selection?.type === 'Range' && textRef.current?.isSameNode(selection.anchorNode?.parentNode ?? null);
        setTextSelected(selected ?? false);
    }

    const content = subtitle.textImage ? (
        <SubtitleTextImage availableWidth={window.screen.availWidth / 2} subtitle={subtitle} scale={1} />
    ) : (
        <span ref={textRef} className={disabledClassName}>
            {subtitle.text}
        </span>
    );

    return (
        <TableRow
            onClick={() => !textSelected && onClickSubtitle(index)}
            onMouseUp={handleMouseUp}
            ref={subtitleRef}
            className={classes.subtitleRow}
            selected={selected}
            {...tableRowProps}
        >
            <TableCell className={className}>{content}</TableCell>
            {copyButtonEnabled && (
                <TableCell className={classes.copyButton}>
                    <IconButton onClick={(e) => onCopySubtitle(e, index)}>
                        <FileCopy fontSize={compressed ? 'small' : 'medium'} />
                    </IconButton>
                </TableCell>
            )}
            <TableCell className={classes.timestamp}>{subtitle.displayTime}</TableCell>
        </TableRow>
    );
});

interface SubtitlePlayerProps {
    clock: Clock;
    onSeek: (progress: number, shouldPlay: boolean) => void;
    onCopy: (
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        postMineAction: PostMineAction,
        preventDuplicate: boolean
    ) => void;
    onOffsetChange: (offset: number) => void;
    onToggleSubtitleTrack: (track: number) => void;
    autoPauseContext: AutoPauseContext;
    playing: boolean;
    subtitles?: DisplaySubtitleModel[];
    subtitleCollection?: SubtitleCollection<DisplaySubtitleModel>;
    length: number;
    jumpToSubtitle?: SubtitleModel;
    compressed: boolean;
    copyButtonEnabled: boolean;
    loading: boolean;
    drawerOpen: boolean;
    appBarHidden: boolean;
    displayHelp?: string;
    disableKeyEvents: boolean;
    lastJumpToTopTimestamp: number;
    hidden: boolean;
    disabledSubtitleTracks: { [track: number]: boolean };
    settingsProvider: AsbplayerSettingsProvider;
    keyBinder: KeyBinder;
}

export default function SubtitlePlayer({
    clock,
    onSeek,
    onCopy,
    onOffsetChange,
    onToggleSubtitleTrack,
    autoPauseContext,
    playing,
    subtitles,
    subtitleCollection,
    length,
    jumpToSubtitle,
    compressed,
    copyButtonEnabled,
    loading,
    drawerOpen,
    appBarHidden,
    displayHelp,
    disableKeyEvents,
    lastJumpToTopTimestamp,
    hidden,
    disabledSubtitleTracks,
    settingsProvider,
    keyBinder,
}: SubtitlePlayerProps) {
    const playingRef = useRef<boolean>();
    playingRef.current = playing;
    const clockRef = useRef<Clock>(clock);
    clockRef.current = clock;
    const subtitleListRef = useRef<DisplaySubtitleModel[]>();
    subtitleListRef.current = subtitles;
    const subtitleRefs = useMemo<RefObject<HTMLTableRowElement>[]>(
        () =>
            subtitles
                ? Array(subtitles.length)
                      .fill(undefined)
                      .map((_) => createRef<HTMLTableRowElement>())
                : [],
        [subtitles]
    );
    const subtitleCollectionRef = useRef<SubtitleCollection<DisplaySubtitleModel>>(
        SubtitleCollection.empty<DisplaySubtitleModel>()
    );
    subtitleCollectionRef.current = subtitleCollection ?? SubtitleCollection.empty<DisplaySubtitleModel>();
    const subtitleRefsRef = useRef<RefObject<HTMLTableRowElement>[]>([]);
    subtitleRefsRef.current = subtitleRefs;
    const disableKeyEventsRef = useRef<boolean>();
    disableKeyEventsRef.current = disableKeyEvents;
    const [selectedSubtitleIndexes, setSelectedSubtitleIndexes] = useState<{ [index: number]: boolean }>({});
    const selectedSubtitleIndexesRef = useRef<{ [index: number]: boolean }>({});
    const lengthRef = useRef<number>(0);
    lengthRef.current = length;
    const hiddenRef = useRef<boolean>(false);
    hiddenRef.current = hidden;
    const lastScrollTimestampRef = useRef<number>(0);
    const requestAnimationRef = useRef<number>();
    const containerRef = useRef<HTMLElement>();
    const drawerOpenRef = useRef<boolean>();
    drawerOpenRef.current = drawerOpen;
    const [windowWidth] = useWindowSize(true);
    const classes = useSubtitlePlayerStyles({ compressed, windowWidth, appBarHidden });
    const autoPauseContextRef = useRef<AutoPauseContext>();
    autoPauseContextRef.current = autoPauseContext;

    // This effect should be scheduled only once as re-scheduling seems to cause performance issues.
    // Therefore all of the state it operates on is contained in refs.
    useEffect(() => {
        const update = () => {
            const subtitleRefs = subtitleRefsRef.current;
            const clock = clockRef.current;
            const currentSubtitleIndexes: { [index: number]: boolean } = {};
            const timestamp = clock.time(lengthRef.current);

            let slice = subtitleCollectionRef.current.subtitlesAt(timestamp);
            const showing = slice.showing.length === 0 ? slice.lastShown ?? [] : slice.showing;
            let smallestIndex: number | undefined;

            for (const s of showing) {
                currentSubtitleIndexes[s.index] = true;

                if (smallestIndex === undefined || s.index < smallestIndex) {
                    smallestIndex = s.index;
                }
            }

            if (!keysAreEqual(currentSubtitleIndexes, selectedSubtitleIndexesRef.current)) {
                selectedSubtitleIndexesRef.current = currentSubtitleIndexes;
                setSelectedSubtitleIndexes(currentSubtitleIndexes);

                if (smallestIndex !== undefined) {
                    const scrollToSubtitleRef = subtitleRefs[smallestIndex];
                    const allowScroll = !hiddenRef.current && Date.now() - lastScrollTimestampRef.current > 5000;

                    if (scrollToSubtitleRef?.current && allowScroll) {
                        scrollToSubtitleRef.current.scrollIntoView({
                            block: 'center',
                            inline: 'nearest',
                            behavior: 'smooth',
                        });
                    }
                }
            }

            if (slice.startedShowing !== undefined) {
                autoPauseContextRef.current?.startedShowing(slice.startedShowing);
            }

            if (slice.willStopShowing !== undefined) {
                autoPauseContextRef.current?.willStopShowing(slice.willStopShowing);
            }

            requestAnimationRef.current = requestAnimationFrame(update);
        };

        requestAnimationRef.current = requestAnimationFrame(update);

        return () => {
            if (requestAnimationRef.current !== undefined) {
                cancelAnimationFrame(requestAnimationRef.current);
            }
        };
    }, []);

    const scrollToCurrentSubtitle = useCallback(() => {
        const selectedSubtitleIndexes = selectedSubtitleIndexesRef.current;

        if (!selectedSubtitleIndexes) {
            return;
        }

        const indexes = Object.keys(selectedSubtitleIndexes);

        if (indexes.length === 0) {
            return;
        }

        const scrollToSubtitleRef = subtitleRefs[Number(indexes[0])];

        scrollToSubtitleRef?.current?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth',
        });
    }, [subtitleRefs]);

    useEffect(() => {
        if (hidden) {
            return;
        }

        function scrollIfVisible() {
            if (document.visibilityState === 'visible') {
                scrollToCurrentSubtitle();
            }
        }

        document.addEventListener('visibilitychange', scrollIfVisible);

        return () => document.removeEventListener('visibilitychange', scrollIfVisible);
    }, [hidden, selectedSubtitleIndexes, subtitleRefs, scrollToCurrentSubtitle]);

    useEffect(() => {
        if (!hidden) {
            scrollToCurrentSubtitle();
        }
    }, [hidden, scrollToCurrentSubtitle]);

    useEffect(() => {
        if (hiddenRef.current) {
            return;
        }

        const subtitleRefs = subtitleRefsRef.current;

        if (!subtitleRefs || subtitleRefs.length === 0) {
            return;
        }

        const firstSubtitleRef = subtitleRefs[0];
        firstSubtitleRef?.current?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth',
        });
    }, [lastJumpToTopTimestamp]);

    useEffect(() => {
        const unbind = keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => subtitles
        );

        return () => unbind();
    }, [keyBinder, onOffsetChange, disableKeyEvents, subtitles]);

    useEffect(() => {
        const unbind = keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [keyBinder, onOffsetChange, disableKeyEvents, clock, subtitles, length]);

    useEffect(() => {
        const unbind = keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, false);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length]);

    useEffect(() => {
        const unbind = keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, false);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );

        return () => unbind();
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length]);

    useEffect(() => {
        const unbind = keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.stopPropagation();
                event.preventDefault();
                if (forward) {
                    onSeek(Math.min(length, clock.time(length) + 10000), false);
                } else {
                    onSeek(Math.max(0, clock.time(length) - 10000), false);
                }
            },
            () => disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, clock, length, disableKeyEvents, onSeek]);

    useEffect(() => {
        function handleScroll() {
            lastScrollTimestampRef.current = Date.now();
        }

        const table = containerRef.current;
        table?.addEventListener('wheel', handleScroll);

        return () => table?.removeEventListener('wheel', handleScroll);
    }, [containerRef, lastScrollTimestampRef]);

    useEffect(() => {
        if (hidden) {
            return;
        }

        if (!jumpToSubtitle || !subtitles) {
            return;
        }

        let jumpToIndex = -1;
        let i = 0;

        for (let s of subtitles) {
            if (s.originalStart === jumpToSubtitle.originalStart && s.text === jumpToSubtitle.text) {
                jumpToIndex = i;
                break;
            }

            ++i;
        }

        if (jumpToIndex !== -1) {
            subtitleRefs[jumpToIndex]?.current?.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [hidden, jumpToSubtitle, subtitles, subtitleRefs]);

    const calculateSurroundingSubtitlesForIndex = useCallback(
        (index: number) => {
            if (!selectedSubtitleIndexesRef.current || !subtitles) {
                return [];
            }

            return surroundingSubtitles(
                subtitles,
                index,
                settingsProvider.surroundingSubtitlesCountRadius,
                settingsProvider.surroundingSubtitlesTimeRadius
            );
        },
        [subtitles, settingsProvider.surroundingSubtitlesCountRadius, settingsProvider.surroundingSubtitlesTimeRadius]
    );

    const calculateSurroundingSubtitles = useCallback(() => {
        if (!selectedSubtitleIndexesRef.current) {
            return [];
        }
        const index = Math.min(...Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i)));
        return calculateSurroundingSubtitlesForIndex(index);
    }, [calculateSurroundingSubtitlesForIndex]);

    const calculateCurrentSubtitle = useCallback(() => {
        const subtitleIndexes = Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i));

        if (!subtitles || !subtitleIndexes || subtitleIndexes.length === 0) {
            return undefined;
        }

        const index = Math.min(...subtitleIndexes);
        return subtitles[index];
    }, [subtitles]);

    useEffect(() => {
        const unbind = keyBinder.bindCopy(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onCopy(subtitle, calculateSurroundingSubtitles(), PostMineAction.none, false);
            },
            () => disableKeyEventsRef.current ?? false,
            () => calculateCurrentSubtitle()
        );

        return () => unbind();
    }, [keyBinder, calculateCurrentSubtitle, calculateSurroundingSubtitles, onCopy]);

    useEffect(() => {
        const unbind = keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleSubtitleTrack(track);
            },
            () => disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, disableKeyEvents, onToggleSubtitleTrack]);

    useEffect(() => {
        const unbind = keyBinder.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                const subtitleIndexes = Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i));

                if (subtitles && subtitleIndexes && subtitleIndexes.length > 0) {
                    const index = Math.min(...subtitleIndexes);
                    onCopy(
                        subtitles[index],
                        calculateSurroundingSubtitlesForIndex(index),
                        PostMineAction.showAnkiDialog,
                        true
                    );
                }
            },
            () => !subtitles || subtitles.length === 0 || disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, onCopy, disableKeyEvents, subtitles, calculateSurroundingSubtitlesForIndex]);

    useEffect(() => {
        const unbind = keyBinder.bindUpdateLastCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                const subtitleIndexes = Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i));

                if (subtitles && subtitleIndexes && subtitleIndexes.length > 0) {
                    const index = Math.min(...subtitleIndexes);
                    onCopy(
                        subtitles[index],
                        calculateSurroundingSubtitlesForIndex(index),
                        PostMineAction.updateLastCard,
                        true
                    );
                }
            },
            () => !subtitles || subtitles.length === 0 || disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, onCopy, disableKeyEvents, subtitles, calculateSurroundingSubtitlesForIndex]);

    const handleClick = useCallback(
        (index: number) => {
            if (!subtitles) {
                return;
            }

            const selectedSubtitleIndexes = selectedSubtitleIndexesRef.current || {};
            onSeek(subtitles[index].start, !playingRef.current && index in selectedSubtitleIndexes);
        },
        [subtitles, onSeek]
    );

    const handleCopy = useCallback(
        (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, index: number) => {
            e.preventDefault();
            e.stopPropagation();

            if (!subtitles) {
                return;
            }

            onCopy(subtitles[index], calculateSurroundingSubtitlesForIndex(index), PostMineAction.none, false);
        },
        [subtitles, calculateSurroundingSubtitlesForIndex, onCopy]
    );

    let subtitleTable = null;

    if (!subtitles || subtitles.length === 0) {
        if (!loading && displayHelp) {
            subtitleTable = !loading && displayHelp && (
                <div className={classes.noSubtitles}>
                    <Typography variant="h6">{displayHelp}</Typography>
                </div>
            );
        } else if (subtitles && subtitles.length === 0) {
            subtitleTable = (
                <div className={classes.noSubtitles}>
                    <Typography variant="h6">No subtitles</Typography>
                </div>
            );
        }
    } else {
        subtitleTable = (
            <TableContainer className={classes.table}>
                <Table>
                    <TableBody>
                        {subtitles.map((s: SubtitleModel, index: number) => {
                            const selected = index in selectedSubtitleIndexes;

                            return (
                                <SubtitleRow
                                    key={index}
                                    index={index}
                                    compressed={compressed}
                                    selected={selected}
                                    copyButtonEnabled={copyButtonEnabled}
                                    disabled={disabledSubtitleTracks[s.track]}
                                    subtitle={subtitles[index]}
                                    subtitleRef={subtitleRefs[index]}
                                    onClickSubtitle={handleClick}
                                    onCopySubtitle={handleCopy}
                                />
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    return (
        <Paper square elevation={0} ref={containerRef} className={classes.container}>
            {subtitleTable}
        </Paper>
    );
}
