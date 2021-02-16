import { useCallback, useEffect, useState, useMemo, useRef, createRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
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
    const clock = props.clock;
    const subtitles = props.subtitles;
    const subtitleListRef = useRef();
    subtitleListRef.current = subtitles;
    const subtitleRefs = useMemo(() => subtitles
        ? Array(subtitles.length).fill().map((_, i) => createRef())
        : [], [subtitles]);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const selectedSubtitleIndexRef = useRef(0);
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
    // The clock is essentially a singleton, so it is fine as a dependency.
    useEffect(() => {
        const update = (time) => {
            const subtitles = subtitleListRef.current || [];
            const length = lengthRef.current;
            const progress = clock.progress(lengthRef.current);

            let currentSubtitleIndex = -1;
            for (let i = subtitles.length - 1; i >=0; --i) {
                if (progress >= subtitles[i].start / length) {
                    currentSubtitleIndex = i;
                    break;
                }
            }

            if (currentSubtitleIndex !== -1 && currentSubtitleIndex !== selectedSubtitleIndexRef.current) {
                selectedSubtitleIndexRef.current = currentSubtitleIndex;
                setSelectedSubtitleIndex(currentSubtitleIndex);
                const selectedSubtitleRef = subtitleRefs[currentSubtitleIndex];
                const allowScroll = Date.now() - lastScrollTimestampRef.current > 5000;

                if (selectedSubtitleRef.current && allowScroll) {
                    selectedSubtitleRef.current.scrollIntoView({
                        block: "center",
                        inline: "nearest",
                        behavior: "smooth"
                    });
                }
            }

            requestAnimationRef.current = requestAnimationFrame(update);
        };

        requestAnimationRef.current = requestAnimationFrame(update);

        return () => cancelAnimationFrame(requestAnimationRef.current);
    }, [clock, subtitleRefs]);

    useEffect(() => {
        function handleKey(event) {
            if (!subtitles || subtitles.length === 0) {
                return;
            }

            let newSubtitleIndex;

            if (event.keyCode === 37) {
                newSubtitleIndex = Math.max(0, selectedSubtitleIndex - 1);
            } else if (event.keyCode === 39) {
                newSubtitleIndex = Math.min(props.subtitles.length - 1, selectedSubtitleIndex + 1);
            } else {
                return;
            }

            event.preventDefault();
            const progress = props.subtitles[newSubtitleIndex].start / props.length;
            props.onSeek(progress, false);
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [props, selectedSubtitleIndex, subtitles]);

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
        if (!props.jumpToSubtitle || !props.subtitles) {
            return;
        }

        let jumpToIndex = -1;
        let i = 0;

        for (let s of props.subtitles) {
            if (s.start === props.jumpToSubtitle.start && s.text === props.jumpToSubtitle.text) {
                jumpToIndex = i;
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
    }, [props.jumpToSubtitle, props.subtitles, subtitleRefs]);

    const handleClick = useCallback((subtitleIndex) => {
        const progress = props.subtitles[subtitleIndex].start / props.length;
        props.onSeek(progress, !props.playing && subtitleIndex === selectedSubtitleIndex);
    }, [props, selectedSubtitleIndex]);

    const handleCopy = useCallback((event, subtitleIndex) => {
        event.stopPropagation();
        const subtitle = props.subtitles[subtitleIndex];
        const text = subtitle.text;
        navigator.clipboard.writeText(text);
        props.onCopy(text, subtitle.start, subtitle.end);
        setLastCopiedSubtitle(text);
        setCopyAlertOpen(true);
    }, [props]);

    const handleCopyAlertClosed = useCallback(() => {
        setCopyAlertOpen(false);
    }, [setCopyAlertOpen]);

    let subtitleTable;

    if (!props.subtitles) {
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
    } else if (props.subtitles.length === 0) {
        subtitleTable = null;
    } else {
        subtitleTable = (
            <TableContainer className={classes.table} ref={tableRef}>
                <Table>
                    <TableBody>
                        {props.subtitles.map((s, index) => {
                            const selected = index === selectedSubtitleIndex;
                            const className = selected ? classes.selectedSubtitle : classes.subtitle;

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
