import React, { useCallback, useEffect, useState, useMemo, useRef, createRef } from 'react';
import { AutoSizer, CellMeasurer, CellMeasurerCache, List } from 'react-virtualized';
import { makeStyles } from '@material-ui/core/styles';
import { keysAreEqual } from '../services/Util';
import { detectCopy } from '../services/KeyEvents';
import { useWindowSize } from '../hooks/useWindowSize';
import { hexToRgb } from '../services/Util'
import FileCopy from '@material-ui/icons/FileCopy';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';

const useSubtitlePlayerStyles = makeStyles((theme) => ({
    container: {
        height: 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: theme.palette.background.default,
        width: ({compressed, windowWidth}) => compressed ? Math.max(350, .25 * windowWidth) : '100%'
    },
    table: {
        backgroundColor: theme.palette.background.default,
        marginBottom: 75, // so the last row doesn't collide with controls
    },
    noSubtitles: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 15,
        textAlign: "center"
    },
}));

const useSubtitleRowStyles = makeStyles((theme) => ({
    subtitleRow: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover
        },
        borderBottomColor: theme.palette.divider,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        boxSizing: 'border-box'
    },
    selectedSubtitleRow: () => {
        const color = hexToRgb(theme.palette.secondary.main);
        return {
            backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${theme.palette.action.selectedOpacity})`,
            '&:hover': {
                backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${theme.palette.action.selectedOpacity})`
            },
        };
    },
    subtitle: {
        fontSize: 20,
        paddingRight: 0,
        minWidth: 200,
        width: '100%',
        overflowWrap: 'anywhere',
        flexGrow: 1,
        display: "flex",
        padding: 16,
        justifyContent: "center",
        flexDirection: "column",
    },
    compressedSubtitle: {
        fontSize: 16,
        paddingRight: 0,
        minWidth: 200,
        width: '100%',
        overflowWrap: 'anywhere',
        display: "flex",
        padding: 16,
        flexGrow: 1,
        justifyContent: "center",
        flexDirection: "column",
    },
    timestamp: {
        fontSize: 14,
        color: '#aaaaaa',
        textAlign: 'right',
        paddingRight: 15,
        paddingLeft: 5,
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
    },
    copyButton: {
        textAlign: 'right',
        padding: 0,
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
    },
}));

const SubtitleRow = React.forwardRef(({index, compressed, selected, subtitle, onClick, onCopy, ...rowProps}, ref) => {
    const classes = useSubtitleRowStyles();
    const className = compressed ? classes.compressedSubtitle : classes.subtitle;
    const rowClassName = selected ? `${classes.subtitleRow} ${classes.selectedSubtitleRow}` : classes.subtitleRow;

    return (
        <Grid
            container
            wrap="nowrap"
            onClick={(e) => {
                console.log("clicked in row " + index);
                onClick(index);
            }}
            className={rowClassName}
            ref={ref}
            {...rowProps}
        >
            <Grid item className={className}>
                <div>
                    <span onClick={(e) => e.stopPropagation()}>
                        {subtitle.text}
                    </span>
                </div>
            </Grid>
            <Grid item className={classes.copyButton}>
                <IconButton onClick={(e) => onCopy(e, index)}>
                    <FileCopy fontSize={compressed ? "small" : "default"} />
                </IconButton>
            </Grid>
            <Grid item className={classes.timestamp}>
                {subtitle.displayTime}
            </Grid>
        </Grid>
    );
});

function SubtitleTable({className, subtitles, subtitleRefs, selectedSubtitleIndexes, scrollToRowIndex, compressed, onClick, onCopy, cache}) {
    console.log("re-render table scrollToRow=" + scrollToRowIndex);
    function rowRenderer({index, isScrolling, key, parent, style}) {
        return (
            <CellMeasurer
                cache={cache}
                columnIndex={0}
                key={key}
                parent={parent}
                rowIndex={index}
            >
                {({registerChild}) => {
                    const selected = index in selectedSubtitleIndexes;

                    return (
                        <SubtitleRow
                            ref={(element) => {
                                registerChild.current = element;
                                subtitleRefs[index].current = element;
                            }}
                            key={index}
                            index={index}
                            compressed={compressed}
                            selected={selected}
                            subtitle={subtitles[index]}
                            onClick={onClick}
                            onCopy={onCopy}
                            style={style}
                        />
                    );
//                    return (
//                        <SubtitleRow
//                            container
//                            direction="row"
//                            wrap="nowrap"
//                            ref={(element) => {
//                                registerChild.current = element;
//                                subtitleRefs[index].current = element;
//                            }}
//                            onClick={(e) => onClick(index)}
//                            key={index}
//                            ref={subtitleRefs[index]}
//                            selected={selected}
//                            className={subtitleRowClass}
//                            style={style}
//                        >
//                            <Grid item className={classes.subtitle}>
//                                {s.text}
//                            </Grid>
//                            <Grid item className={classes.copyButton}>
//                                <IconButton onClick={(e) => onCopy(e, index)}>
//                                    <FileCopy fontSize={compressed ? "small" : "default"} />
//                                </IconButton>
//                            </Grid>
//                            <Grid item className={classes.timestamp}>
//                                {s.displayTime}
//                            </Grid>
//                        </Grid>
//                    )
                }}
            </CellMeasurer>
        )
    }
    return (
                    <AutoSizer className={className}>
                        {({width, height}) => (
                            <List
                                deferredMeasurementCache={cache}
                                width={width}
                                height={height}
                                rowCount={subtitles.length}
                                rowHeight={cache.rowHeight}
                                rowRenderer={rowRenderer}
                                scrollToIndex={scrollToRowIndex}
                                scrollToAlignment="center"
                            />
                        )}
                    </AutoSizer>
    );
//    return (
//        <TableContainer className={className}>
//            <Table>
//                <TableBody>
//                    {subtitles.map((s, index) => {
//                        const selected = index in selectedSubtitleIndexes;
//
//                        return (
//                            <SubtitleRow
//                                key={index}
//                                index={index}
//                                compressed={compressed}
//                                selected={selected}
//                                subtitle={subtitles[index]}
//                                subtitleRef={subtitleRefs[index]}
//                                onClick={onClick}
//                                onCopy={onCopy}
//                            />
//                        );
//                    })}
//                </TableBody>
//            </Table>
//        </TableContainer>
//    );
}

export default function SubtitlePlayer({
    clock,
    onSeek,
    onCopy,
    playing,
    subtitles: originalSubtitles,
    length,
    jumpToSubtitle,
    compressed,
    loading,
    drawerOpen,
    displayHelp,
    disableKeyEvents,
    lastJumpToTopTimestamp,
    hidden
    }) {
    const playingRef = useRef();
    playingRef.current = playing;
    const clockRef = useRef();
    clockRef.current = clock;
    const subtitles = useMemo(() => originalSubtitles?.filter(s => s.start >= 0 && s.end >= 0), [originalSubtitles]);
    const subtitleListRef = useRef();
    subtitleListRef.current = subtitles;
    const subtitleRefs = useMemo(() => subtitles
        ? Array(subtitles.length).fill().map((_, i) => createRef())
        : [], [subtitles]);
    const subtitleRefsRef = useRef();
    subtitleRefsRef.current = subtitleRefs;
    const [selectedSubtitleIndexes, setSelectedSubtitleIndexes] = useState({});
    const selectedSubtitleIndexesRef = useRef({});
    const [scrollToRowIndex, setScrollToRowIndex] = useState();
    const lengthRef = useRef();
    lengthRef.current = length;
    const hiddenRef = useRef();
    hiddenRef.current = hidden;
    const lastScrollTimestampRef = useRef(0);
    const requestAnimationRef = useRef();
    const containerRef = useRef();
    const drawerOpenRef = useRef();
    drawerOpenRef.current = drawerOpen;
    const [windowWidth, ] = useWindowSize(true);
    const classes = useSubtitlePlayerStyles({compressed, windowWidth});
    const cellMeasurerCache = useMemo(() => new CellMeasurerCache({
        defaultHeight: 61,
        minHeight: 61,
        fixedWidth: true,
        fixedHeight: true,
        minWidth: 200
    }), [windowWidth]);

    // This effect should be scheduled only once as re-scheduling seems to cause performance issues.
    // Therefore all of the state it operates on is contained in refs.
    useEffect(() => {
        const update = (time) => {
            const subtitles = subtitleListRef.current || [];
            const subtitleRefs = subtitleRefsRef.current;
            const length = lengthRef.current;
            const clock = clockRef.current;
            const progress = clock.progress(lengthRef.current);

            let smallestIndex = Number.MAX_SAFE_INTEGER;
            let fallbackIndex = -1;
            const currentSubtitleIndexes = {};

            for (let i = subtitles.length - 1; i >= 0; --i) {
                const s = subtitles[i];
                const start = s.start / length;
                const end = s.end / length;

                if (progress >= start) {
                    if (progress < end) {
                        smallestIndex = i < smallestIndex ? i : smallestIndex;
                        currentSubtitleIndexes[i] = true;
                    }

                    if (fallbackIndex === -1) {
                        fallbackIndex = i;
                    }
                } else if (smallestIndex !== Number.MAX_SAFE_INTEGER) {
                    break;
                }
            }

            // Attempt to highlight *something* if no subtitles were found at the current timestamp
            if (smallestIndex === Number.MAX_SAFE_INTEGER && fallbackIndex !== -1) {
                currentSubtitleIndexes[fallbackIndex] = true;
            }

            if (!keysAreEqual(currentSubtitleIndexes, selectedSubtitleIndexesRef.current)) {
                console.log(currentSubtitleIndexes);
                selectedSubtitleIndexesRef.current = currentSubtitleIndexes;
                setSelectedSubtitleIndexes(currentSubtitleIndexes);

                if (smallestIndex !== Number.MAX_SAFE_INTEGER) {
                    const scrollToSubtitleRef = subtitleRefs[smallestIndex];
                    const allowScroll = !hiddenRef.current && (Date.now() - lastScrollTimestampRef.current > 5000);

                    if (allowScroll) {
                        setScrollToRowIndex(smallestIndex);
                    }
                }
            }

            requestAnimationRef.current = requestAnimationFrame(update);
        };

        requestAnimationRef.current = requestAnimationFrame(update);

        return () => cancelAnimationFrame(requestAnimationRef.current);
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

        const scrollToSubtitleRef = subtitleRefs[indexes[0]];

        scrollToSubtitleRef?.current?.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "smooth"
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

        document.addEventListener("visibilitychange", scrollIfVisible);

        return () => document.removeEventListener("visibilitychange", scrollIfVisible);
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
            block: "center",
            inline: "nearest",
            behavior: "smooth"
        });
    }, [lastJumpToTopTimestamp]);

    useEffect(() => {
        function handleKey(event) {
            if (disableKeyEvents) {
                return;
            }

            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let newSubtitleIndex;

            if (event.keyCode === 37) {
                const selected = Object.keys(selectedSubtitleIndexes);
                newSubtitleIndex = selected.length > 0
                    ? Math.max(0, Math.min(...selected) - 1)
                    : -1;
            } else if (event.keyCode === 39) {
                const selected = Object.keys(selectedSubtitleIndexes);
                newSubtitleIndex = selected.length > 0
                    ? Math.min(subtitles.length - 1, Math.max(...selected) + 1)
                    : -1;
            } else {
                return;
            }

            if (newSubtitleIndex !== -1) {
                event.preventDefault();
                const progress = subtitles[newSubtitleIndex].start / length;
                onSeek(progress, false);
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => window.removeEventListener('keydown', handleKey);
    }, [onSeek, selectedSubtitleIndexes, subtitles, length, disableKeyEvents]);

    useEffect(() => {
        function handleScroll(event) {
            lastScrollTimestampRef.current = Date.now();
        };

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
                 block: "center",
                 inline: "nearest",
                 behavior: "smooth"
            });
        }
    }, [hidden, jumpToSubtitle, subtitles, subtitleRefs]);

    function copy(event, subtitles, subtitleIndex, onCopy) {
        event.stopPropagation();
        const subtitle = subtitles[subtitleIndex];
        const text = subtitle.text;
        navigator.clipboard.writeText(text);
        onCopy(subtitle);
    }

    useEffect(() => {
        function copySubtitle(event) {
            const subtitleIndexes = Object.keys(selectedSubtitleIndexesRef.current);

            if (subtitleIndexes.length === 0) {
                return;
            }

            if (!detectCopy(event)) {
                return;
            }

            const index = Math.min(...subtitleIndexes);
            copy(event, subtitles, index, onCopy);
        }

        window.addEventListener('keydown', copySubtitle);

        return () => window.removeEventListener('keydown', copySubtitle);
    }, [subtitles, onCopy]);

    const handleClick = useCallback((index) => {
        const progress = subtitles[index].start / length;
        onSeek(progress, !playingRef.current && index in selectedSubtitleIndexes);
    }, [subtitles, length, onSeek, selectedSubtitleIndexes]);

    const handleCopy = useCallback((e, index) => copy(e, subtitles, index, onCopy), [subtitles, onCopy]);

    let subtitleTable;

    if (!subtitles || subtitles.length ===0) {
        subtitleTable = !loading && displayHelp && (
            <div className={classes.noSubtitles}>
                <Typography>
                    {displayHelp}
                </Typography>
            </div>
        );
    } else {
        subtitleTable = (
            <SubtitleTable
                className={classes.table}
                compressed={compressed}
                subtitles={subtitles}
                subtitleRefs={subtitleRefs}
                selectedSubtitleIndexes={selectedSubtitleIndexes}
                onClick={handleClick}
                onCopy={handleCopy}
                cache={cellMeasurerCache}
                scrollToRowIndex={scrollToRowIndex}
            />
        );
    }

    return (
        <Paper
            square
            elevation={0}
            ref={containerRef}
            className={classes.container}
        >
            {subtitleTable}
        </Paper>
    );
}
