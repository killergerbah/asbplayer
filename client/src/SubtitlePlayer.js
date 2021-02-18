import { useCallback, useEffect, useState, useMemo, useRef, createRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { keysAreEqual } from './Util';
import Alert from './Alert';
import FileCopy from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
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
    },
    table: {
        backgroundColor: theme.palette.background.default,
        marginBottom: 75 // so the last row doesn't collide with controls
    },
    selectedSubtitle: {
        fontSize: 20
    },
    subtitle: {
        fontSize: 20,
        width: '100%'
    },
    timestamp: {
        fontSize: 14,
        color: '#aaaaaa',
        textAlign: 'right'
    },
    copyButton: {
        textAlign: 'right',
        padding: 0
    },
    noSubtitles: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
    }
}));

export default function SubtitlePlayer(props) {
    const {clock, onSeek, onCopy, playing, subtitles, length, jumpToSubtitle} = props;
    const clockRef = useRef();
    clockRef.current = clock;
    const subtitleListRef = useRef();
    subtitleListRef.current = subtitles;
    const subtitleRefs = useMemo(() => subtitles
        ? Array(subtitles.length).fill().map((_, i) => createRef())
        : [], [subtitles]);
    const subtitleRefsRef = useRef();
    subtitleRefsRef.current = subtitleRefs;
    const [selectedSubtitleIndexes, setSelectedSubtitleIndexes] = useState({});
    const selectedSubtitleIndexesRef = useRef({});
    const lengthRef = useRef();
    lengthRef.current = props.length;
    const [copyAlertOpen, setCopyAlertOpen] = useState(false);
    const [lastCopiedSubtitle, setLastCopiedSubtitle] = useState(null);
    const lastScrollTimestampRef = useRef(0);
    const requestAnimationRef = useRef();
    const tableRef = createRef();
    const classes = useSubtitlePlayerStyles();

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
                selectedSubtitleIndexesRef.current = currentSubtitleIndexes;
                setSelectedSubtitleIndexes(currentSubtitleIndexes);

                if (smallestIndex !== Number.MAX_SAFE_INTEGER) {
                    const scrollToSubtitleRef = subtitleRefs[smallestIndex];
                    const allowScroll = Date.now() - lastScrollTimestampRef.current > 5000;

                    if (scrollToSubtitleRef?.current && allowScroll) {
                        scrollToSubtitleRef.current.scrollIntoView({
                            block: "center",
                            inline: "nearest",
                            behavior: "smooth"
                        });
                    }
                }
            }

            requestAnimationRef.current = requestAnimationFrame(update);
        };

        requestAnimationRef.current = requestAnimationFrame(update);

        return () => cancelAnimationFrame(requestAnimationRef.current);
    }, []);

    useEffect(() => {
        function handleKey(event) {
            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let newSubtitleIndex;
            const selected = Object.keys(selectedSubtitleIndexes);

            if (event.keyCode === 37) {
                newSubtitleIndex = selected.length > 0
                    ? Math.max(0, Math.min(...selected) - 1)
                    : -1;
            } else if (event.keyCode === 39) {
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

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [onSeek, selectedSubtitleIndexes, subtitles, length]);

    useEffect(() => {
        function handleScroll(event) {
            lastScrollTimestampRef.current = Date.now();
        };

        const table = tableRef.current;
        table?.addEventListener('wheel', handleScroll);

        return () => {
            table?.removeEventListener('wheel', handleScroll);
        };
    }, [tableRef, lastScrollTimestampRef]);

    useEffect(() => {
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
            subtitleRefs[jumpToIndex].current.scrollIntoView({
                 block: "center",
                 inline: "nearest",
                 behavior: "smooth"
            });
        }
    }, [jumpToSubtitle, subtitles, subtitleRefs]);

    const handleClick = useCallback((subtitleIndex) => {
        const progress = subtitles[subtitleIndex].start / length;
        onSeek(progress, !playing && subtitleIndex in selectedSubtitleIndexes);
    }, [subtitles, length, playing, onSeek, selectedSubtitleIndexes]);

    const handleCopy = useCallback((event, subtitleIndex) => {
        event.stopPropagation();
        const subtitle = subtitles[subtitleIndex];
        const text = subtitle.text;
        navigator.clipboard.writeText(text);
        onCopy(subtitle);
        setLastCopiedSubtitle(text);
        setCopyAlertOpen(true);
    }, [subtitles, onCopy]);

    const handleCopyAlertClosed = useCallback(() => {
        setCopyAlertOpen(false);
    }, [setCopyAlertOpen]);

    let subtitleTable;

    if (!subtitles) {
        subtitleTable = (
            <div className={classes.noSubtitles}>
                <Typography>
                    Drag and drop srt, ass, mp3, or mkv files.
                </Typography>
                <Typography>
                    Install the <Link color="secondary" target="_blank" rel="noreferrer" href="https://github.com/killergerbah/asbplayer/releases/tag/v0.2.0">extension</Link> to sync subtitles with videos in other tabs.
                </Typography>
            </div>
        );
    } else if (subtitles.length === 0) {
        subtitleTable = null;
    } else {
        subtitleTable = (
            <TableContainer className={classes.table} ref={tableRef}>
                <Table>
                    <TableBody>
                        {subtitles.map((s, index) => {
                            const selected = index in selectedSubtitleIndexes;
                            const className = selected ? classes.selectedSubtitle : classes.subtitle;

                            if (s.start < 0 && s.end < 0) {
                                return null;
                            }

                            return (
                               <TableRow
                                   onClick={(e) => handleClick(index)}
                                   key={index}
                                   ref={subtitleRefs[index]}
                                   selected={selected}
                               >
                                    <TableCell className={className}>
                                        {s.text}
                                    </TableCell>
                                    <TableCell className={classes.copyButton}>
                                        <IconButton onClick={(e) => handleCopy(e, index)}>
                                            <FileCopy />
                                        </IconButton>
                                    </TableCell>
                                    <TableCell className={classes.timestamp}>
                                        {s.displayTime}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    return (
        <Paper square elevation={0} className={classes.container}>
            {subtitleTable}
            <Alert open={copyAlertOpen} onClose={handleCopyAlertClosed} autoHideDuration={3000} severity="success">
                Copied {lastCopiedSubtitle}
            </Alert>
        </Paper>
    );
}
