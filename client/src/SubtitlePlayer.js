import { useCallback, useEffect, useState, useMemo, useRef, createRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import MuiAlert from '@material-ui/lab/Alert';
import FileCopy from '@material-ui/icons/FileCopy';
import Grow from '@material-ui/core/Grow';
import IconButton from '@material-ui/core/IconButton';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';

const useSubtitlePlayerStyles = makeStyles({
    container: {
        height: 'calc(100vh - 64px)',
        width: '100vw',
        position: 'relative',
        overflowX: 'hidden'
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
        fontSize: 14,
        color: '#aaaaaa',
        textAlign: 'right',
        padding: 0
    }
});

const useAlertStyles = makeStyles({
    root: {
        display: 'flex',
        justifyContent: 'center',
        position: 'fixed',
        top: 80,
        width: '100%',
        pointerEvents: 'none'
    }
});

function Alert(props) {
    const classes = useAlertStyles();

    useEffect(() => {
        if (props.open) {
            const timeout = setTimeout(props.onClose, props.autoHideDuration);
            return () => clearTimeout(timeout);
        }

        return null;
    }, [props.open, props.autoHideDuration, props.onClose]);

    return (
        <div className={classes.root}>
            <Grow in={props.open}>
               <MuiAlert severity="success">
                   {props.children}
               </MuiAlert>
            </Grow>
        </div>
    );
}

export default function SubtitlePlayer(props) {
    const clock = props.clock;
    const subtitles = props.subtitles;
    const subtitleRefs = useMemo(() => Array(subtitles.length).fill().map((_, i) => createRef()), [subtitles]);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const [copyAlertOpen, setCopyAlertOpen] = useState(false);
    const [lastCopiedSubtitle, setLastCopiedSubtitle] = useState(null);
    const lastScrollTimestampRef = useRef(0);
    const tableRef = createRef();
    const classes = useSubtitlePlayerStyles();

    useEffect(() => {
        const interval = setInterval(() => {
            const length = props.length;
            const progress = clock.progress(length);
            let currentSubtitleIndex = -1;

            for (let i = subtitles.length - 1; i >=0; --i) {
                if (progress >= subtitles[i].start / length) {
                    currentSubtitleIndex = i;
                    break;
                }
            }

            if (currentSubtitleIndex !== -1 && currentSubtitleIndex !== selectedSubtitleIndex) {
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
        }, 100);
        return () => clearInterval(interval);
    }, [subtitles, clock, selectedSubtitleIndex, subtitleRefs, props.length])

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

        if (table) {
            table.addEventListener('wheel', handleScroll);
        }

        return () => {
            if (table) {
                table.removeEventListener('wheel', handleScroll);
            }
        };
    }, [tableRef, lastScrollTimestampRef]);


    const handleClick = useCallback((subtitleIndex) => {
        const progress = props.subtitles[subtitleIndex].start / props.length;
        props.onSeek(progress, !props.playing && subtitleIndex === selectedSubtitleIndex);
    }, [props, selectedSubtitleIndex]);

    const handleCopy = useCallback((event, subtitleIndex) => {
        event.stopPropagation();
        const text = props.subtitles[subtitleIndex].text;
        navigator.clipboard.writeText(text);
        props.onCopy(text);
        setLastCopiedSubtitle(text);
        setCopyAlertOpen(true);
    }, [props]);

    const handleCopyAlertClosed = useCallback(() => {
        setCopyAlertOpen(false);
    }, [setCopyAlertOpen]);

    if (subtitles.length === 0) {
        return null;
    }

    return (
        <div>
            <TableContainer ref={tableRef} className={classes.container}>
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
                                    selected={selected}>
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
            <Alert open={copyAlertOpen} onClose={handleCopyAlertClosed} autoHideDuration={3000}>
                Copied {lastCopiedSubtitle}
            </Alert>
        </div>
    );
}
