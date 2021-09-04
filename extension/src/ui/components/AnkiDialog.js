import React, { useCallback, useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DoneIcon from '@material-ui/icons/Done';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import RestoreIcon from '@material-ui/icons/Restore';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import Slider from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';
import ZoomInIcon from '@material-ui/icons/ZoomIn';

const useStyles = makeStyles((theme) => ({
    root: {
        '& .MuiTextField-root': {
            marginBottom: theme.spacing(1),
        },
    },
    title: {
        flexGrow: 1
    },
    mediaField: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer'
        }
    },
    rangeSelectSlider: {
        '& .MuiSlider-markLabel': {
            transform: 'translateX(-3%)'
        }
    }
}));

function boundaryIntervalFromSliderContext(sliderContext) {
    let min = null;
    let max = null;

    for (const s of sliderContext.subtitles) {
        if (min === null || s.start < min) {
            min = s.start;
        }

        if (max === null || s.end > max) {
            max = s.end;
        }
    }

    return min && max && [min, max];
}

function sliderMarksFromSliderContext(sliderContext, boundary) {
    const seenTimestamps = {};

    return sliderContext.subtitles
        .filter((s) => s.text.trim() !== "")
        .map((s) => {
            if (s.start in seenTimestamps) {
                return null;
            }

            seenTimestamps[s.start] = true;

            return {
                value: s.start,
                label: `${s.text.trim().substring(0, Math.min(s.text.length, 3))}...`
            };
        })
        .filter(mark => mark !== null)
        .filter(mark => mark.value >= boundary[0] && mark.value <= boundary[1]);
}

export default function AnkiDialog({
    open,
    disabled,
    text: initialText,
    onProceed,
    onRerecord,
    onCancel,
    onViewImage,
    audioClip,
    image,
    source: initialSource,
    sliderContext,
    settingsProvider,
    anki,
    definition: initialDefinition,
    word: initialWord,
    customFieldValues: initialCustomFieldValues,
    timestampInterval: initialSelectedTimestampInterval,
    lastAppliedTimestampIntervalToText: initialLastAppliedTimestampIntervalToText,
    }) {
    const classes = useStyles();
    const [definition, setDefinition] = useState("");
    const [text, setText] = useState();
    const [word, setWord] = useState();
    const [lastSearchedWord, setLastSearchedWord] = useState();
    const [source, setSource] = useState(initialSource);
    const [duplicateNotes, setDuplicateNotes] = useState([]);
    const [wordTimestamp, setWordTimestamp] = useState(0);
    const [customFieldValues, setCustomFieldValues] = useState({});
    const [timestampInterval, setTimestampInterval] = useState();
    const [initialTimestampInterval, setInitialTimestampInterval] = useState();
    const [initialTimestampBoundaryInterval, setInitialTimestampBoundaryInterval] = useState();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState();
    const [timestampMarks, setTimestampMarks] = useState();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState();

    useEffect(() => {
        const timestampInterval = initialSelectedTimestampInterval || (sliderContext && [sliderContext.subtitleStart, sliderContext.subtitleEnd]);
        const timestampBoundaryInterval = sliderContext && boundaryIntervalFromSliderContext(sliderContext);
        setTimestampInterval(timestampInterval);
        setInitialTimestampInterval(timestampInterval);
        setLastAppliedTimestampIntervalToText(initialLastAppliedTimestampIntervalToText || timestampInterval);
        setTimestampBoundaryInterval(timestampBoundaryInterval);
        setInitialTimestampBoundaryInterval(timestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, timestampBoundaryInterval));
    }, [sliderContext, initialSelectedTimestampInterval, initialLastAppliedTimestampIntervalToText]);

    useEffect(() => {
        setText(initialText);
        setDefinition(initialDefinition);
        setWord(initialWord);
        setSource(initialSource);
        setDuplicateNotes([]);
        setCustomFieldValues(initialCustomFieldValues);
    }, [initialText, initialSource, initialDefinition, initialWord, initialCustomFieldValues]);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [word]);

    useEffect(() => {
        if (!word || !settingsProvider.wordField) {
            return;
        }

        const trimmedWord = word.trim();

        if (trimmedWord === "" || trimmedWord === lastSearchedWord) {
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                setDuplicateNotes(await anki.findNotesWithWord(trimmedWord));
                setLastSearchedWord(trimmedWord);
            } catch (e) {
                console.error(e);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [word, wordTimestamp, lastSearchedWord, anki, settingsProvider.wordField]);

    const handlePlayAudio = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        audioClip.play();
    }, [audioClip]);

    const handleCustomFieldChange = useCallback((customFieldName, value) => {
        const newCustomFieldValues = {};
        Object.assign(newCustomFieldValues, customFieldValues);
        newCustomFieldValues[customFieldName] = value;
        setCustomFieldValues(newCustomFieldValues);
    }, [customFieldValues]);

    let wordHelperText;

    if (word && word.trim() === lastSearchedWord && settingsProvider.wordField) {
        wordHelperText = duplicateNotes.length > 0
            ? `Found ${duplicateNotes.length} notes with word "${word}" in field "${settingsProvider.wordField}"`
            : `No notes found with word "${word.trim()}" in field "${settingsProvider.wordField}"`;
    } else {
        wordHelperText = "";
    }

    const handleViewImage = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onViewImage(image);
    }, [image, onViewImage]);

    const handleTimestampIntervalChange = useCallback((e, newValue) => {
        setTimestampInterval(newValue);
    }, []);

    const handleApplyTimestampIntervalToText = useCallback(() => {
        const intersectingSubtitles = [];

        for (const s of sliderContext.subtitles) {
            if ((s.start >= timestampInterval[0] && s.start <= timestampInterval[1])
                || (s.end >= timestampInterval[0] && s.end <= timestampInterval[1])
                || (timestampInterval[0] >= s.start && timestampInterval[0] <= s.end)
                || (timestampInterval[1] >= s.start && timestampInterval[1] <= s.end)) {
                    intersectingSubtitles.push(s.text);
            }
        }

        setText(intersectingSubtitles.join("\n"));
        setLastAppliedTimestampIntervalToText(timestampInterval);
    }, [timestampInterval, sliderContext]);

    const handleApplyTimestampIntervalToAudio = useCallback((e) => {
        e.stopPropagation();
        onRerecord({
            text: text,
            sliderContext: sliderContext,
            definition: definition,
            word: word,
            source: source,
            customFieldValues: customFieldValues,
            lastAppliedTimestampIntervalToText: lastAppliedTimestampIntervalToText,
            timestampInterval: timestampInterval,
        });
    }, [onRerecord, lastAppliedTimestampIntervalToText, timestampInterval, text, sliderContext, definition, word, source, customFieldValues]);

    const handleResetTimestampInterval = useCallback(() => {
        setTimestampInterval(initialTimestampInterval);
        setTimestampBoundaryInterval(initialTimestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, initialTimestampBoundaryInterval));
    }, [initialTimestampInterval, initialTimestampBoundaryInterval, sliderContext]);

    const handleZoomInTimestampInterval = useCallback(() => {
        const newMin = (timestampBoundaryInterval[0] + timestampInterval[0]) / 2;
        const newMax = (timestampBoundaryInterval[1] + timestampInterval[1]) / 2;
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, sliderContext]);

    const disableApplyTextSelection = !sliderContext || sliderContext.subtitles.filter(s => s.text.trim() !== "").length === 0;

    return (
        <Dialog
            open={open}
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
            onBackdropClick={onCancel}
            onEscapeKeyDown={onCancel}
        >
            <DialogTitle>Anki Export</DialogTitle>
            <DialogContent>
                <form className={classes.root}>
                    <TextField
                        variant="filled"
                        color="secondary"
                        multiline
                        fullWidth
                        rowsMax={8}
                        label="Sentence"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        InputProps={{
                            endAdornment: timestampInterval && (
                                <InputAdornment position="end">
                                    <Tooltip title="Apply Selection">
                                        <span>
                                            <IconButton
                                                disabled={(timestampInterval[0] === lastAppliedTimestampIntervalToText[0]
                                                    && timestampInterval[1] === lastAppliedTimestampIntervalToText[1])
                                                    || disableApplyTextSelection}
                                                onClick={handleApplyTimestampIntervalToText}
                                                edge="end"
                                            >
                                                <DoneIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }}
                    />
                    <TextField
                        variant="filled"
                        color="secondary"
                        multiline
                        fullWidth
                        rows={8}
                        label="Definition"
                        value={definition}
                        onChange={(e) => setDefinition(e.target.value)}
                    />
                    <TextField
                        variant="filled"
                        color="secondary"
                        fullWidth
                        label="Word"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        helperText={wordHelperText}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title="Search in Anki">
                                        <span>
                                            <IconButton
                                                disabled={disabled || !settingsProvider.wordField || !word || word.trim() === ""}
                                                onClick={() => anki.findNotesWithWordGui(word.trim())}
                                                edge="end"
                                            >
                                                <SearchIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }}
                    />
                    {Object.keys(settingsProvider.customAnkiFields).map((customFieldName) => (
                        <TextField
                            key={customFieldName}
                            variant="filled"
                            color="secondary"
                            fullWidth
                            multiline
                            rowsMax={8}
                            label={customFieldName}
                            value={customFieldValues[customFieldName] || ""}
                            onChange={(e) => handleCustomFieldChange(customFieldName, e.target.value)}
                        />
                    ))}
                    {audioClip && (
                        <div
                            className={classes.mediaField}
                            onClick={handlePlayAudio}
                        >
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={audioClip.name}
                                label="Audio"
                                InputProps={{
                                    endAdornment: timestampInterval && (
                                        <InputAdornment position="end">
                                            <Tooltip title="Apply Selection (rerecord)">
                                                <span>
                                                    <IconButton
                                                        disabled={(timestampInterval[0] === initialTimestampInterval[0]
                                                            && timestampInterval[1] === initialTimestampInterval[1])}
                                                        onClick={handleApplyTimestampIntervalToAudio}
                                                        edge="end"
                                                    >
                                                        <DoneIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </div>
                    )}
                    {image && (
                        <div
                            className={classes.mediaField}
                            onClick={handleViewImage}
                        >
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={image.name}
                                label="Image"
                            />
                        </div>
                    )}
                    <TextField
                        variant="filled"
                        color="secondary"
                        fullWidth
                        label="Source"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                    />
                    {timestampInterval && timestampBoundaryInterval && timestampMarks && (
                        <Grid container direction="row">
                            <Grid item style={{flexGrow: 1}}>
                                <Slider
                                    value={timestampInterval}
                                    onChange={handleTimestampIntervalChange}
                                    min={timestampBoundaryInterval[0]}
                                    max={timestampBoundaryInterval[1]}
                                    marks={timestampMarks}
                                    step={1}
                                    valueLabelDisplay="off"
                                    className={classes.rangeSelectSlider}
                                    color="secondary"
                                />
                            </Grid>
                            <Grid item>
                                <Tooltip title="Reset">
                                    <span>
                                        <IconButton
                                            edge="end"
                                            style={{marginTop: -8}}
                                            onClick={handleResetTimestampInterval}
                                        >
                                            <RestoreIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Grid>
                            <Grid item>
                                <Tooltip title="Zoom In">
                                    <span>
                                        <IconButton
                                            edge="end"
                                            style={{marginTop: -8}}
                                            onClick={handleZoomInTimestampInterval}
                                        >
                                            <ZoomInIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Grid>
                        </Grid>
                    )}
                </form>
            </DialogContent>
            <DialogActions>
                <Button
                    disabled={disabled}
                    onClick={() => onCancel()}>
                    Cancel
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'gui')}
                >
                    Open in Anki
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'updateLast')}
                >
                    Update Last Card
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() => onProceed(text, definition, audioClip, image, word, source, customFieldValues, 'default')}
                >
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}