import React, { useCallback, useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Anki, AnkiDialogSliderContext, AudioClip, Image, humanReadableTime, AnkiSettings } from '@project/common';
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
import Slider, { Mark } from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import TagsTextField from './TagsTextField';
import { ExportMode } from '@project/common/src/Anki';

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
}));

function boundaryIntervalFromSliderContext(sliderContext: AnkiDialogSliderContext) {
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

function sliderMarksFromSliderContext(sliderContext: AnkiDialogSliderContext, boundary: number[]): Mark[] {
    const seenTimestamps: any = {};

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
        .filter((mark: Mark | null) => mark !== null)
        .filter((mark: Mark | null) => mark!.value >= boundary[0] && mark!.value <= boundary[1]) as Mark[];
}

function sliderValueLabelFormat(ms: number) {
    return humanReadableTime(ms, true);
}

interface ValueLabelComponentProps {
    children: React.ReactElement;
    open: boolean;
    value: number;
}

function ValueLabelComponent({ children, open, value }: ValueLabelComponentProps) {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="top" title={value}>
            {children}
        </Tooltip>
    );
}

export interface RerecordParams {
    text: string;
    sliderContext: AnkiDialogSliderContext;
    definition: string;
    word: string;
    source: string;
    url: string;
    customFieldValues: { [key: string]: string };
    lastAppliedTimestampIntervalToText: number[];
    timestampInterval: number[];
}

interface AnkiDialogProps {
    open: boolean;
    disabled: boolean;
    text: string;
    onProceed: (
        text: string,
        definition: string,
        audioClip: AudioClip | undefined,
        image: Image | undefined,
        word: string,
        source: string,
        url: string,
        customFieldValues: { [key: string]: string },
        tags: string[],
        mode: ExportMode
    ) => void;
    onRerecord: (params: RerecordParams) => void;
    onCancel: () => void;
    onViewImage: (image: Image) => void;
    audioClip?: AudioClip;
    image?: Image;
    source: string;
    url: string;
    sliderContext: AnkiDialogSliderContext;
    settingsProvider: AnkiSettings;
    anki: Anki;
    definition: string;
    word: string;
    customFieldValues: {[key: string]: string};
    timestampInterval?: number[];
    lastAppliedTimestampIntervalToText?: number[];
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
    url: initialUrl,
    sliderContext,
    settingsProvider,
    anki,
    definition: initialDefinition,
    word: initialWord,
    customFieldValues: initialCustomFieldValues,
    timestampInterval: initialSelectedTimestampInterval,
    lastAppliedTimestampIntervalToText: initialLastAppliedTimestampIntervalToText,
}: AnkiDialogProps) {
    const classes = useStyles();
    const [definition, setDefinition] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [word, setWord] = useState<string>('');
    const [lastSearchedWord, setLastSearchedWord] = useState<string>();
    const [source, setSource] = useState<string>(initialSource);
    const [tags, setTags] = useState<string[]>(settingsProvider.tags);
    const [url, setUrl] = useState<string>(initialUrl);
    const [duplicateNotes, setDuplicateNotes] = useState<any[]>([]);
    const [wordTimestamp, setWordTimestamp] = useState<number>(0);
    const [customFieldValues, setCustomFieldValues] = useState<{[key: string]: string}>({});
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [initialTimestampInterval, setInitialTimestampInterval] = useState<number[]>();
    const [initialTimestampBoundaryInterval, setInitialTimestampBoundaryInterval] = useState<number[]>();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState<number[]>();
    const [timestampMarks, setTimestampMarks] = useState<Mark[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();

    useEffect(() => {
        const timestampInterval =
            initialSelectedTimestampInterval ||
            (sliderContext && [sliderContext.subtitleStart, sliderContext.subtitleEnd]);
        const timestampBoundaryInterval = (sliderContext && boundaryIntervalFromSliderContext(sliderContext)) || undefined;
        const timestampMarks = (sliderContext && sliderMarksFromSliderContext(sliderContext, timestampBoundaryInterval!)) || undefined;
        setTimestampInterval(timestampInterval);
        setInitialTimestampInterval(timestampInterval);
        setLastAppliedTimestampIntervalToText(initialLastAppliedTimestampIntervalToText || timestampInterval);
        setTimestampBoundaryInterval(timestampBoundaryInterval);
        setInitialTimestampBoundaryInterval(timestampBoundaryInterval);
        setTimestampMarks(timestampMarks);
    }, [sliderContext, initialSelectedTimestampInterval, initialLastAppliedTimestampIntervalToText]);

    useEffect(() => {
        setText(initialText);
        setDefinition(initialDefinition);
        setWord(initialWord);
        setSource(initialSource);
        setUrl(initialUrl);
        setDuplicateNotes([]);
        setCustomFieldValues(initialCustomFieldValues);
        setTags(settingsProvider.tags);
    }, [
        initialText,
        initialSource,
        initialDefinition,
        initialWord,
        initialCustomFieldValues,
        initialUrl,
        settingsProvider.tags,
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
            audioClip!.play();
        },
        [audioClip]
    );

    const handleCustomFieldChange = useCallback(
        (customFieldName: string, value: string) => {
            const newCustomFieldValues: {[key: string]: string} = {};
            Object.assign(newCustomFieldValues, customFieldValues);
            newCustomFieldValues[customFieldName] = value;
            setCustomFieldValues(newCustomFieldValues);
        },
        [customFieldValues]
    );

    let wordHelperText;

    if (word && word.trim() === lastSearchedWord && settingsProvider.wordField) {
        wordHelperText =
            duplicateNotes.length > 0
                ? `Found ${duplicateNotes.length} notes with word "${word}" in field "${settingsProvider.wordField}"`
                : `No notes found with word "${word.trim()}" in field "${settingsProvider.wordField}"`;
    } else {
        wordHelperText = '';
    }

    const handleViewImage = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewImage(image!);
        },
        [image, onViewImage]
    );

    const handleTimestampIntervalChange = useCallback((e, newValue) => {
        setTimestampInterval(newValue);
    }, []);

    const handleApplyTimestampIntervalToText = useCallback(() => {
        if (!timestampInterval) {
            return;
        }

        const intersectingSubtitles = [];
        const interval = timestampInterval;

        for (const s of sliderContext.subtitles) {
            if (
                (s.start >= interval[0] && s.start <= interval[1]) ||
                (s.end >= interval[0] && s.end <= interval[1]) ||
                (interval[0] >= s.start && interval[0] <= s.end) ||
                (interval[1] >= s.start && interval[1] <= s.end)
            ) {
                intersectingSubtitles.push(s.text);
            }
        }

        setText(intersectingSubtitles.join('\n'));
        setLastAppliedTimestampIntervalToText(timestampInterval);
    }, [timestampInterval, sliderContext]);

    const handleApplyTimestampIntervalToAudio = useCallback(
        (e) => {
            if (!lastAppliedTimestampIntervalToText || !timestampInterval) {
                return;
            }

            e.stopPropagation();
            onRerecord({
                text: text,
                sliderContext: sliderContext,
                definition: definition,
                word: word,
                source: source,
                url: url,
                customFieldValues: customFieldValues,
                lastAppliedTimestampIntervalToText: lastAppliedTimestampIntervalToText,
                timestampInterval: timestampInterval,
            });
        },
        [
            onRerecord,
            lastAppliedTimestampIntervalToText,
            timestampInterval,
            text,
            sliderContext,
            definition,
            word,
            source,
            url,
            customFieldValues,
        ]
    );

    const handleResetTimestampInterval = useCallback(() => {
        if (!initialTimestampBoundaryInterval) {
            return;
        }

        setTimestampInterval(initialTimestampInterval);
        setTimestampBoundaryInterval(initialTimestampBoundaryInterval);
        setTimestampMarks(
            sliderContext && sliderMarksFromSliderContext(sliderContext, initialTimestampBoundaryInterval)
        );
    }, [initialTimestampInterval, initialTimestampBoundaryInterval, sliderContext]);

    const handleZoomInTimestampInterval = useCallback(() => {
        if (!timestampBoundaryInterval || !timestampInterval) {
            return;
        }

        const newMin = (timestampBoundaryInterval[0] + timestampInterval[0]) / 2;
        const newMax = (timestampBoundaryInterval[1] + timestampInterval[1]) / 2;
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, sliderContext]);

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
                                                disabled={
                                                    (!timestampInterval || !lastAppliedTimestampIntervalToText) ||
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
                    {Object.keys(settingsProvider.customAnkiFields).map((customFieldName) => (
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
                                            <Tooltip title="Apply Selection (rerecord)">
                                                <span>
                                                    <IconButton
                                                        disabled={
                                                            (!timestampInterval || !initialTimestampInterval) ||
                                                            timestampInterval[0] === initialTimestampInterval[0] &&
                                                            timestampInterval[1] === initialTimestampInterval[1]
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
