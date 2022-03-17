import { useCallback, useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/styles';
import { humanReadableTime } from '@project/common';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DoneIcon from '@material-ui/icons/Done';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import RestoreIcon from '@material-ui/icons/Restore';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import Slider from '@material-ui/core/Slider';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import TagsTextField from './TagsTextField';
import { speakerRegex, getSubtitleWithoutSpeaker } from '../services/Util.js';
import { Checkbox, FormControlLabel } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
    root: {
        '& .MuiTextField-root': {
            marginBottom: theme.spacing(1),
        },
    },
    title: {
        flexGrow: 1,
    },
    mediaField: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer',
        },
    },
    rangeSelectSlider: {
        '& .MuiSlider-markLabel': {
            transform: 'translateX(-3%)',
        },
    },
    alignRight: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
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

    return min !== null && max !== null && [min, max];
}

function sliderMarksFromSliderContext(sliderContext, boundary) {
    const seenTimestamps = {};

    return sliderContext.subtitles
        .filter((s) => s.text.trim() !== '')
        .map((s) => {
            if (s.start in seenTimestamps) {
                return null;
            }

            seenTimestamps[s.start] = true;

            return {
                value: s.start,
                label: `${s.text.trim().substring(0, Math.min(s.text.length, 3))}...`,
            };
        })
        .filter((mark) => mark !== null)
        .filter((mark) => mark.value >= boundary[0] && mark.value <= boundary[1]);
}

function sliderValueLabelFormat(ms) {
    return humanReadableTime(ms, true);
}

function ValueLabelComponent({ children, open, value }) {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="top" title={value}>
            {children}
        </Tooltip>
    );
}

export default function AnkiDialog({
    open,
    disabled,
    text: initialText,
    onProceed,
    onCancel,
    onViewImage,
    onOpenSettings,
    audioClip: initialAudioClip,
    image,
    source: initialSource,
    url: initialUrl,
    sliderContext,
    customFields,
    settingsProvider,
    anki,
}) {
    const classes = useStyles();
    const [definition, setDefinition] = useState('');
    const [isSpeakerTextHidden, setIsSpeakerTextHidden] = useState(false);
    const [text, setText] = useState();
    const [originalText, setOriginalText] = useState();
    const [isTextChanged, setIsTextChanged] = useState(false);
    const [word, setWord] = useState();
    const [lastSearchedWord, setLastSearchedWord] = useState();
    const [source, setSource] = useState(initialSource);
    const [tags, setTags] = useState(settingsProvider.tags);
    const [url, setUrl] = useState(initialUrl);
    const [duplicateNotes, setDuplicateNotes] = useState([]);
    const [wordTimestamp, setWordTimestamp] = useState(0);
    const [customFieldValues, setCustomFieldValues] = useState({});
    const [timestampInterval, setTimestampInterval] = useState();
    const [initialTimestampInterval, setInitialTimestampInterval] = useState();
    const [initialTimestampBoundaryInterval, setInitialTimestampBoundaryInterval] = useState();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState();
    const [timestampMarks, setTimestampMarks] = useState();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState();
    const [lastAppliedTimestampIntervalToAudio, setLastAppliedTimestampIntervalToAudio] = useState();
    const [audioClip, setAudioClip] = useState();

    useEffect(() => {
        setText(initialText);
        setOriginalText(initialText);
        handleToggleSpeakerText(true);
        setIsTextChanged(false);
        setDefinition('');
        setWord('');
        setSource(initialSource);
        setUrl(initialUrl);
        setDuplicateNotes([]);
        setCustomFieldValues({});
        setTags(settingsProvider.tags);
    }, [initialText, initialSource, initialUrl, settingsProvider.tags]);

    useEffect(() => {
        const timestampInterval = sliderContext && [sliderContext.subtitleStart, sliderContext.subtitleEnd];
        const timestampBoundaryInterval = sliderContext && boundaryIntervalFromSliderContext(sliderContext);
        setTimestampInterval(timestampInterval);
        setInitialTimestampInterval(timestampInterval);
        setLastAppliedTimestampIntervalToText(timestampInterval);
        setLastAppliedTimestampIntervalToAudio(timestampInterval);
        setTimestampBoundaryInterval(timestampBoundaryInterval);
        setInitialTimestampBoundaryInterval(timestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, timestampBoundaryInterval));
    }, [sliderContext]);

    useEffect(() => {
        if (!initialAudioClip) {
            setAudioClip(null);
            return;
        }

        let newAudioClip = initialAudioClip;

        if (settingsProvider.preferMp3) {
            newAudioClip = newAudioClip.toMp3();
        }

        if (lastAppliedTimestampIntervalToAudio) {
            newAudioClip = newAudioClip.slice(
                Math.max(0, Math.round(lastAppliedTimestampIntervalToAudio[0]) - settingsProvider.audioPaddingStart),
                Math.round(lastAppliedTimestampIntervalToAudio[1]) + settingsProvider.audioPaddingEnd
            );
        }

        setAudioClip(newAudioClip);
    }, [
        initialAudioClip,
        settingsProvider.preferMp3,
        lastAppliedTimestampIntervalToAudio,
        settingsProvider.audioPaddingStart,
        settingsProvider.audioPaddingEnd,
    ]);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [word]);

    useEffect(() => {
        if (!word || !settingsProvider.wordField) {
            return;
        }

        const trimmedWord = word.trim();

        if (trimmedWord === '' || trimmedWord === lastSearchedWord) {
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

    const handlePlayAudio = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            audioClip.play();
        },
        [audioClip]
    );

    const handleViewImage = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewImage(image);
        },
        [image, onViewImage]
    );

    const handleTimestampIntervalChange = useCallback((e, newValue) => {
        setTimestampInterval(newValue);
    }, []);

    const handleApplyTimestampIntervalToText = useCallback(() => {
        const intersectingSubtitles = [];

        for (const s of sliderContext.subtitles) {
            if (
                (s.start >= timestampInterval[0] && s.start <= timestampInterval[1]) ||
                (s.end >= timestampInterval[0] && s.end <= timestampInterval[1]) ||
                (timestampInterval[0] >= s.start && timestampInterval[0] <= s.end) ||
                (timestampInterval[1] >= s.start && timestampInterval[1] <= s.end)
            ) {
                intersectingSubtitles.push(s.text);
            }
        }

        setText(intersectingSubtitles.join('\n'));
        setLastAppliedTimestampIntervalToText(timestampInterval);
    }, [timestampInterval, sliderContext]);

    const handleApplyTimestampIntervalToAudio = useCallback(
        (e) => {
            e.stopPropagation();
            setLastAppliedTimestampIntervalToAudio(timestampInterval);
        },
        [timestampInterval]
    );

    const handleResetTimestampInterval = useCallback(() => {
        setTimestampInterval(initialTimestampInterval);
        setTimestampBoundaryInterval(initialTimestampBoundaryInterval);
        setTimestampMarks(
            sliderContext && sliderMarksFromSliderContext(sliderContext, initialTimestampBoundaryInterval)
        );
    }, [initialTimestampInterval, initialTimestampBoundaryInterval, sliderContext]);

    const handleZoomInTimestampInterval = useCallback(() => {
        const newMin = (timestampBoundaryInterval[0] + timestampInterval[0]) / 2;
        const newMax = (timestampBoundaryInterval[1] + timestampInterval[1]) / 2;
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, sliderContext]);

    const handleCustomFieldChange = useCallback(
        (customFieldName, value) => {
            const newCustomFieldValues = {};
            Object.assign(newCustomFieldValues, customFieldValues);
            newCustomFieldValues[customFieldName] = value;
            setCustomFieldValues(newCustomFieldValues);
        },
        [customFieldValues]
    );

    const handleChangeText = (e) => {
        setIsTextChanged(true);
        return setText(e.target.value);
    };

    const handleToggleSpeakerText = (showSpeakerText) => {
        if (showSpeakerText) {
            setText(getSubtitleWithoutSpeaker(originalText));
        } else {
            setText(originalText);
        }
        setIsSpeakerTextHidden(showSpeakerText);
    };

    let wordHelperText;

    if (word && word.trim() === lastSearchedWord && settingsProvider.wordField) {
        wordHelperText =
            duplicateNotes.length > 0
                ? `Found ${duplicateNotes.length} notes with word "${word}" in field "${settingsProvider.wordField}"`
                : `No notes found with word "${word.trim()}" in field "${settingsProvider.wordField}"`;
    } else {
        wordHelperText = '';
    }

    const disableApplyTextSelection =
        !sliderContext || sliderContext.subtitles.filter((s) => s.text.trim() !== '').length === 0;

    return (
        <Dialog
            open={open}
            disableEnforceFocus
            fullWidth
            maxWidth="sm"
            onBackdropClick={onCancel}
            onEscapeKeyDown={onCancel}
        >
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    Anki Export
                </Typography>
                <IconButton edge="end" onClick={() => onOpenSettings()}>
                    <SettingsIcon />
                </IconButton>
            </Toolbar>
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
                        onChange={handleChangeText}
                        InputProps={{
                            endAdornment: timestampInterval && (
                                <InputAdornment position="end">
                                    <Tooltip title="Apply Selection">
                                        <span>
                                            <IconButton
                                                disabled={
                                                    (timestampInterval[0] === lastAppliedTimestampIntervalToText[0] &&
                                                        timestampInterval[1] ===
                                                            lastAppliedTimestampIntervalToText[1]) ||
                                                    disableApplyTextSelection
                                                }
                                                onClick={handleApplyTimestampIntervalToText}
                                                edge="end"
                                            >
                                                <DoneIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <div className={classes.alignRight}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isSpeakerTextHidden}
                                    onChange={(e) => handleToggleSpeakerText(e.target.checked)}
                                />
                            }
                            label="Hide Speakers"
                            disabled={isTextChanged}
                        />
                    </div>
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
                                                disabled={
                                                    disabled ||
                                                    !settingsProvider.wordField ||
                                                    !word ||
                                                    word.trim() === ''
                                                }
                                                onClick={() => anki.findNotesWithWordGui(word.trim())}
                                                edge="end"
                                            >
                                                <SearchIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        }}
                    />
                    {Object.keys(customFields).map((customFieldName) => (
                        <TextField
                            key={customFieldName}
                            variant="filled"
                            color="secondary"
                            fullWidth
                            multiline
                            rowsMax={8}
                            label={customFieldName}
                            value={customFieldValues[customFieldName] || ''}
                            onChange={(e) => handleCustomFieldChange(customFieldName, e.target.value)}
                        />
                    ))}
                    {audioClip && (
                        <div className={classes.mediaField} onClick={handlePlayAudio}>
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={audioClip.name}
                                label="Audio"
                                InputProps={{
                                    endAdornment: timestampInterval && (
                                        <InputAdornment position="end">
                                            <Tooltip title="Apply Selection">
                                                <span>
                                                    <IconButton
                                                        disabled={
                                                            (timestampInterval[0] ===
                                                                lastAppliedTimestampIntervalToAudio[0] &&
                                                                timestampInterval[1] ===
                                                                    lastAppliedTimestampIntervalToAudio[1]) ||
                                                            !audioClip.isSliceable(
                                                                timestampInterval[0],
                                                                timestampInterval[1]
                                                            )
                                                        }
                                                        onClick={handleApplyTimestampIntervalToAudio}
                                                        edge="end"
                                                    >
                                                        <DoneIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </div>
                    )}
                    {image && (
                        <div className={classes.mediaField} onClick={handleViewImage}>
                            <TextField variant="filled" color="secondary" fullWidth value={image.name} label="Image" />
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
                    {initialUrl && (
                        <TextField
                            variant="filled"
                            color="secondary"
                            fullWidth
                            label="URL"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    )}
                    {settingsProvider.tags.length > 0 && (
                        <TagsTextField
                            variant="filled"
                            label="Tags"
                            helperText="Comma-separated list of strings"
                            fullWidth
                            color="secondary"
                            tags={tags}
                            onTagsChange={(newTags) => setTags(newTags)}
                        />
                    )}
                    {timestampInterval && timestampBoundaryInterval && timestampMarks && (
                        <Grid container direction="row">
                            <Grid item style={{ flexGrow: 1 }}>
                                <Slider
                                    ValueLabelComponent={ValueLabelComponent}
                                    value={timestampInterval}
                                    valueLabelFormat={sliderValueLabelFormat}
                                    onChange={handleTimestampIntervalChange}
                                    min={timestampBoundaryInterval[0]}
                                    max={timestampBoundaryInterval[1]}
                                    marks={timestampMarks}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    className={classes.rangeSelectSlider}
                                    color="secondary"
                                />
                            </Grid>
                            <Grid item>
                                <Tooltip title="Reset">
                                    <span>
                                        <IconButton
                                            edge="end"
                                            style={{ marginTop: -8 }}
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
                                            style={{ marginTop: -8 }}
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
                <Button disabled={disabled} onClick={() => onCancel()}>
                    Cancel
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() =>
                        onProceed(text, definition, audioClip, image, word, source, url, customFieldValues, tags, 'gui')
                    }
                >
                    Open in Anki
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() =>
                        onProceed(
                            text,
                            definition,
                            audioClip,
                            image,
                            word,
                            source,
                            url,
                            customFieldValues,
                            tags,
                            'updateLast'
                        )
                    }
                >
                    Update Last Card
                </Button>
                <Button
                    disabled={disabled}
                    onClick={() =>
                        onProceed(
                            text,
                            definition,
                            audioClip,
                            image,
                            word,
                            source,
                            url,
                            customFieldValues,
                            tags,
                            'default'
                        )
                    }
                >
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}
