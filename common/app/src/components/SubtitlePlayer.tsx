import React, { useCallback, useEffect, useState, useMemo, useRef, createRef, RefObject, ReactNode } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { keysAreEqual } from '../services/util';
import { useResize } from '../hooks/use-resize';
import { useTranslation } from 'react-i18next';
import { PostMineAction, SubtitleModel, AutoPauseContext } from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';
import { surroundingSubtitles, mockSurroundingSubtitles } from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { KeyBinder } from '@project/common/key-binder';
import SubtitleTextImage from '@project/common/components/SubtitleTextImage';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow, { TableRowProps } from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import Clock from '../services/clock';
import { useAppBarHeight } from '../hooks/use-app-bar-height';

let lastKnownWidth: number | undefined;

interface StylesProps {
    resizable: boolean;
    appBarHidden: boolean;
    appBarHeight: number;
}

const useSubtitlePlayerStyles = makeStyles<Theme, StylesProps, string>((theme) => ({
    container: {
        height: ({ appBarHidden, appBarHeight }) => (appBarHidden ? '100vh' : `calc(100vh - ${appBarHeight}px)`),
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: theme.palette.background.default,
        width: ({ resizable }) => (resizable ? 'auto' : '100%'),
    },
    table: {
        backgroundColor: theme.palette.background.default,
        marginBottom: 75, // so the last row doesn't collide with controls
    },
    unselectableTable: {
        userSelect: 'none',
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
        minWidth: 250,
    },
    subtitle: {
        fontSize: 20,
        paddingRight: 0,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
    },
    compressedSubtitle: {
        fontSize: 16,
        paddingRight: 0,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
    },
    disabledSubtitle: {
        color: 'transparent',
        backgroundColor: theme.palette.action.disabledBackground,
        borderRadius: 5,
    },
    unselectableSubtitle: {
        userSelect: 'none',
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
    showCopyButton: boolean;
    copyButtonEnabled: boolean;
    subtitleRef: RefObject<HTMLTableRowElement>;
    onClickSubtitle: (index: number) => void;
    onCopySubtitle: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, index: number) => void;
}

const SubtitleRow = React.memo(function SubtitleRow({
    index,
    selected,
    subtitleRef,
    onClickSubtitle,
    onCopySubtitle,
    compressed,
    disabled,
    subtitle,
    copyButtonEnabled,
    showCopyButton,
    ...tableRowProps
}: SubtitleRowProps) {
    const classes = useSubtitleRowStyles();
    const textRef = useRef<HTMLSpanElement>(null);
    const [textSelected, setTextSelected] = useState<boolean>(false);
    const className = compressed ? classes.compressedSubtitle : classes.subtitle;
    const disabledClassName = disabled ? classes.disabledSubtitle : '';

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
            {showCopyButton && (
                <TableCell className={classes.copyButton}>
                    <IconButton disabled={!copyButtonEnabled} onClick={(e) => onCopySubtitle(e, index)}>
                        <NoteAddIcon fontSize={compressed ? 'small' : 'medium'} />
                    </IconButton>
                </TableCell>
            )}
            <TableCell className={classes.timestamp}>
                <div>{`\n${subtitle.displayTime}\n`}</div>
            </TableCell>
        </TableRow>
    );
});

interface ResizeHandleProps extends React.HTMLAttributes<HTMLDivElement> {
    isResizing: boolean;
}

const ResizeHandle = ({ isResizing, style, ...rest }: ResizeHandleProps) => {
    return (
        <div
            style={{
                ...style,
                position: 'absolute',
                width: isResizing ? 30 : 5,
                left: isResizing ? -15 : -2.5,
                height: '100%',
                cursor: 'col-resize',
            }}
            {...rest}
        />
    );
};

interface SubtitlePlayerProps {
    clock: Clock;
    onSeek: (progress: number, shouldPlay: boolean) => void;
    onCopy: (
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        postMineAction: PostMineAction,
        forceUseGivenSubtitle?: boolean
    ) => void;
    onOffsetChange: (offset: number) => void;
    onToggleSubtitleTrack: (track: number) => void;
    onSubtitlesSelected: (subtitles: SubtitleModel[]) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    autoPauseContext: AutoPauseContext;
    playing: boolean;
    subtitles?: DisplaySubtitleModel[];
    subtitleCollection?: SubtitleCollection<DisplaySubtitleModel>;
    length: number;
    jumpToSubtitle?: SubtitleModel;
    compressed: boolean;
    resizable: boolean;
    showCopyButton: boolean;
    copyButtonEnabled: boolean;
    loading: boolean;
    drawerOpen: boolean;
    appBarHidden: boolean;
    displayHelp?: string;
    disableKeyEvents: boolean;
    disableMiningBinds: boolean;
    lastJumpToTopTimestamp: number;
    hidden: boolean;
    disabledSubtitleTracks: { [track: number]: boolean };
    settings: AsbplayerSettings;
    keyBinder: KeyBinder;
    maxResizeWidth: number;
}

export default function SubtitlePlayer({
    clock,
    onSeek,
    onCopy,
    onOffsetChange,
    onToggleSubtitleTrack,
    onSubtitlesSelected,
    onResizeStart,
    onResizeEnd,
    autoPauseContext,
    playing,
    subtitles,
    subtitleCollection,
    length,
    jumpToSubtitle,
    compressed,
    resizable,
    showCopyButton,
    copyButtonEnabled,
    loading,
    drawerOpen,
    appBarHidden,
    displayHelp,
    disableKeyEvents,
    disableMiningBinds,
    lastJumpToTopTimestamp,
    hidden,
    disabledSubtitleTracks,
    settings,
    keyBinder,
    maxResizeWidth,
}: SubtitlePlayerProps) {
    const { t } = useTranslation();
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
    const appBarHeight = useAppBarHeight();
    const classes = useSubtitlePlayerStyles({ resizable, appBarHidden, appBarHeight });
    const autoPauseContextRef = useRef<AutoPauseContext>();
    autoPauseContextRef.current = autoPauseContext;
    const onSubtitlesSelectedRef = useRef<(subtitles: SubtitleModel[]) => void>();
    onSubtitlesSelectedRef.current = onSubtitlesSelected;

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
                onSubtitlesSelectedRef.current?.(showing);

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
        return keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => subtitles
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents, subtitles]);

    useEffect(() => {
        return keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(0);
            },
            () => disableKeyEvents
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents, clock, subtitles, length]);

    useEffect(() => {
        return keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, playingRef.current ?? false);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length]);

    useEffect(() => {
        return keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, playingRef.current ?? false);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles
        );
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length]);

    useEffect(() => {
        return keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.stopPropagation();
                event.preventDefault();
                if (forward) {
                    onSeek(Math.min(length, clock.time(length) + 10000), playingRef.current ?? false);
                } else {
                    onSeek(Math.max(0, clock.time(length) - 10000), playingRef.current ?? false);
                }
            },
            () => disableKeyEvents
        );
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

    const currentMockSubtitle = useCallback(() => {
        const timestamp = clock.time(length);
        const end = Math.min(timestamp + 5000, length);
        return {
            text: '',
            start: timestamp,
            originalStart: timestamp,
            end: end,
            originalEnd: end,
            track: 0,
        };
    }, [clock, length]);

    const calculateSurroundingSubtitlesForIndex = useCallback(
        (index: number) => {
            if (!subtitles || subtitles.length === 0) {
                return mockSurroundingSubtitles(currentMockSubtitle(), length, 5000);
            }

            return surroundingSubtitles(
                subtitles,
                index,
                settings.surroundingSubtitlesCountRadius,
                settings.surroundingSubtitlesTimeRadius
            );
        },
        [
            length,
            subtitles,
            currentMockSubtitle,
            settings.surroundingSubtitlesCountRadius,
            settings.surroundingSubtitlesTimeRadius,
        ]
    );

    const calculateSurroundingSubtitles = useCallback(() => {
        if (!selectedSubtitleIndexesRef.current) {
            return [];
        }

        const index = Math.min(...Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i)));
        return calculateSurroundingSubtitlesForIndex(index);
    }, [calculateSurroundingSubtitlesForIndex]);

    const calculateCurrentSubtitle = useCallback(() => {
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
            };
        }

        if (!selectedSubtitleIndexesRef.current) {
            return undefined;
        }

        const subtitleIndexes = Object.keys(selectedSubtitleIndexesRef.current).map((i) => Number(i));

        if (subtitleIndexes.length === 0) {
            return undefined;
        }

        const index = Math.min(...subtitleIndexes);
        return subtitles[index];
    }, [clock, subtitles, length]);

    useEffect(() => {
        return keyBinder.bindCopy(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onCopy(subtitle, calculateSurroundingSubtitles(), PostMineAction.none);
            },
            () => disableKeyEvents || disableMiningBinds,
            () => calculateCurrentSubtitle()
        );
    }, [
        keyBinder,
        disableKeyEvents,
        disableMiningBinds,
        calculateCurrentSubtitle,
        calculateSurroundingSubtitles,
        onCopy,
    ]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleSubtitleTrack(track);
            },
            () => disableKeyEvents
        );
    }, [keyBinder, disableKeyEvents, onToggleSubtitleTrack]);

    useEffect(() => {
        return keyBinder.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const currentSubtitle = calculateCurrentSubtitle();

                if (currentSubtitle) {
                    onCopy(currentSubtitle, calculateSurroundingSubtitles(), PostMineAction.showAnkiDialog);
                }
            },
            () => disableKeyEvents || disableMiningBinds
        );
    }, [
        keyBinder,
        onCopy,
        disableKeyEvents,
        disableMiningBinds,
        subtitles,
        calculateCurrentSubtitle,
        calculateSurroundingSubtitles,
    ]);

    useEffect(() => {
        return keyBinder.bindUpdateLastCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                const currentSubtitle = calculateCurrentSubtitle();

                if (currentSubtitle) {
                    onCopy(currentSubtitle, calculateSurroundingSubtitles(), PostMineAction.updateLastCard);
                }
            },
            () => disableKeyEvents || disableMiningBinds
        );
    }, [
        keyBinder,
        onCopy,
        disableKeyEvents,
        disableMiningBinds,
        subtitles,
        calculateCurrentSubtitle,
        calculateSurroundingSubtitles,
    ]);

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

            onCopy(
                subtitles[index],
                calculateSurroundingSubtitlesForIndex(index),
                settings.clickToMineDefaultAction,
                true
            );
        },
        [subtitles, calculateSurroundingSubtitlesForIndex, settings, onCopy]
    );

    const [scrollY, setScrollY] = useState<number>(0);

    const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
        setScrollY((event.target as HTMLElement)?.scrollTop ?? 0);
    }, []);

    const { width, enableResize, isResizing } = useResize({
        initialWidth: lastKnownWidth ?? Math.max(350, 0.25 * window.innerWidth),
        minWidth: 200,
        maxWidth: maxResizeWidth,
        onResizeStart,
        onResizeEnd,
    });

    useEffect(() => {
        lastKnownWidth = width;
    }, [width]);

    let subtitleTable: ReactNode | null = null;

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
                    <Typography variant="h6">{t('landing.noSubtitles')}</Typography>
                </div>
            );
        }
    } else {
        const selectableTableClassName = isResizing ? classes.unselectableTable : '';

        subtitleTable = (
            <TableContainer className={`${classes.table} ${selectableTableClassName}`}>
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
                                    showCopyButton={showCopyButton}
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
        <Paper
            square
            elevation={0}
            ref={containerRef}
            className={classes.container}
            style={{ width: resizable ? width : 'auto' }}
            onScroll={handleScroll}
        >
            {subtitleTable}
            {resizable && <ResizeHandle isResizing={isResizing} onMouseDown={enableResize} style={{ top: scrollY }} />}
        </Paper>
    );
}
