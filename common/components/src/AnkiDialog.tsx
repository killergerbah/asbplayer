import React, { MutableRefObject, useCallback, useState, useEffect } from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import {
    Anki,
    AnkiDialogSliderContext,
    AudioClip,
    Image,
    humanReadableTime,
    AnkiSettings,
    SubtitleModel,
    surroundingSubtitles,
} from '@project/common';
import Button from '@material-ui/core/Button';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DoneIcon from '@material-ui/icons/Done';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import Paper from '@material-ui/core/Paper';
import RestoreIcon from '@material-ui/icons/Restore';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import Slider, { Mark } from '@material-ui/core/Slider';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import ZoomOutIcon from '@material-ui/icons/ZoomOut';
import SubtitleTextImage from './SubtitleTextImage';
import TagsTextField from './TagsTextField';
import { AnkiExportMode } from '@project/common';

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

const boundaryIntervalSubtitleCountRadius = 1;
const boundaryIntervalSubtitleTimeRadius = 5000;

function boundaryIntervalFromSliderContext(sliderContext: AnkiDialogSliderContext) {
    let index = sliderContext.subtitles.findIndex((s) => s.start === sliderContext.subtitleStart);
    index = index === -1 ? sliderContext.subtitles.length / 2 : index;

    const subtitlesToDisplay = surroundingSubtitles(
        sliderContext.subtitles,
        index,
        boundaryIntervalSubtitleCountRadius,
        boundaryIntervalSubtitleTimeRadius
    );

    let min = null;
    let max = null;

    for (const s of subtitlesToDisplay) {
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
        .filter((s) => s.text.trim() !== '' || s.textImage !== undefined)
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

function subtitleIntersectsTimeInterval(subtitle: SubtitleModel, interval: number[]) {
    return (
        (subtitle.start >= interval[0] && subtitle.start <= interval[1]) ||
        (subtitle.end >= interval[0] && subtitle.end <= interval[1]) ||
        (interval[0] >= subtitle.start && interval[0] <= subtitle.end) ||
        (interval[1] >= subtitle.start && interval[1] <= subtitle.end)
    );
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

interface TextImageSetProps {
    selectedSubtitles: SubtitleModel[];
    width: number;
}

const useTextImageSetStyles = makeStyles((theme) => ({
    root: {
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1),
        backgroundColor: theme.palette.action.disabledBackground,
    },
}));

function TextImageSet({ selectedSubtitles, width }: TextImageSetProps) {
    const classes = useTextImageSetStyles();

    if (selectedSubtitles.length === 0 || width <= 0) {
        return null;
    }

    return (
        <Paper elevation={0} className={classes.root}>
            {selectedSubtitles.map((s, index) => {
                return <SubtitleTextImage key={index} availableWidth={width} subtitle={s} scale={1} />;
            })}
        </Paper>
    );
}

const TextFieldEndAdornment = withStyles({
    // Hack to recenter TextField end adornment
    root: {
        transform: 'translateY(-8px)',
    },
})(InputAdornment);

export interface AnkiDialogState {
    text: string;
    sliderContext?: AnkiDialogSliderContext;
    definition: string;
    word: string;
    source: string;
    url: string;
    customFieldValues: { [key: string]: string };
    lastAppliedTimestampIntervalToText?: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
    initialTimestampInterval?: number[];
    timestampBoundaryInterval?: number[];
    timestampInterval?: number[];
}

interface AnkiDialogProps {
    open: boolean;
    disabled: boolean;
    text?: string;
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
        mode: AnkiExportMode
    ) => void;
    onRerecord?: () => void;
    onRewind: () => void;
    onCancel: () => void;
    onViewImage: (image: Image) => void;
    onOpenSettings?: () => void;
    audioClip?: AudioClip;
    image?: Image;
    source?: string;
    url?: string;
    sliderContext?: AnkiDialogSliderContext;
    settingsProvider: AnkiSettings;
    anki: Anki;
    definition?: string;
    word?: string;
    customFields: { [key: string]: string };
    customFieldValues?: { [key: string]: string };
    initialTimestampInterval?: number[];
    timestampBoundaryInterval?: number[];
    timestampInterval?: number[];
    lastAppliedTimestampIntervalToText?: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
    stateRef?: MutableRefObject<AnkiDialogState | undefined>;
}

export function AnkiDialog({
    open,
    disabled,
    text: initialText,
    onProceed,
    onRewind,
    onCancel,
    onViewImage,
    onOpenSettings,
    onRerecord,
    audioClip: initialAudioClip,
    image,
    source: initialSource,
    url: initialUrl,
    sliderContext,
    customFields,
    settingsProvider,
    anki,
    definition: initialDefinition,
    word: initialWord,
    customFieldValues: initialCustomFieldValues,
    timestampInterval: initialSelectedTimestampInterval,
    timestampBoundaryInterval: forceTimestampBoundaryInterval,
    initialTimestampInterval: forceInitialTimestampInterval,
    lastAppliedTimestampIntervalToText: initialLastAppliedTimestampIntervalToText,
    lastAppliedTimestampIntervalToAudio: initialLastAppliedTimestampIntervalToAudio,
    stateRef,
}: AnkiDialogProps) {
    const classes = useStyles();
    const [definition, setDefinition] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [word, setWord] = useState<string>('');
    const [lastSearchedWord, setLastSearchedWord] = useState<string>();
    const [source, setSource] = useState<string>(initialSource ?? '');
    const [tags, setTags] = useState<string[]>(settingsProvider.tags);
    const [url, setUrl] = useState<string>(initialUrl ?? '');
    const [duplicateNotes, setDuplicateNotes] = useState<any[]>([]);
    const [wordTimestamp, setWordTimestamp] = useState<number>(0);
    const [customFieldValues, setCustomFieldValues] = useState<{ [key: string]: string }>({});
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [selectedSubtitles, setSelectedSubtitles] = useState<SubtitleModel[]>([]);
    const [initialTimestampInterval, setInitialTimestampInterval] = useState<number[]>();
    const [initialTimestampBoundaryInterval, setInitialTimestampBoundaryInterval] = useState<number[]>();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState<number[]>();
    const [timestampMarks, setTimestampMarks] = useState<Mark[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();
    const [lastAppliedTimestampIntervalToAudio, setLastAppliedTimestampIntervalToAudio] = useState<number[]>();
    const [width, setWidth] = useState<number>(0);
    const [audioClip, setAudioClip] = useState<AudioClip>();
    const dialogRefCallback = useCallback((element: HTMLElement) => {
        setWidth(element?.getBoundingClientRect().width ?? 0);
    }, []);

    if (stateRef) {
        stateRef.current = {
            text,
            sliderContext,
            definition,
            word,
            source,
            url,
            customFieldValues,
            initialTimestampInterval,
            timestampBoundaryInterval,
            lastAppliedTimestampIntervalToText,
            lastAppliedTimestampIntervalToAudio,
            timestampInterval,
        };
    }

    const textForTimestampInterval = useCallback(
        (timestampInterval: number[]) => {
            return sliderContext!.subtitles
                .filter((s) => subtitleIntersectsTimeInterval(s, timestampInterval))
                .filter((s) => s.text.trim() !== '')
                .map((s) => s.text)
                .join('\n'); 
        },
        [sliderContext]
    );

    useEffect(() => {
        setText(initialText ?? '');
        setDefinition(initialDefinition ?? '');
        setWord(initialWord ?? '');
        setSource(initialSource ?? '');
        setUrl(initialUrl ?? '');
        setDuplicateNotes([]);
        setCustomFieldValues(initialCustomFieldValues ?? {});
    }, [initialText, initialSource, initialDefinition, initialWord, initialCustomFieldValues, initialUrl]);

    useEffect(() => {
        setTags(settingsProvider.tags);
    }, [settingsProvider.tags]);

    useEffect(() => {
        const timestampInterval =
            initialSelectedTimestampInterval ||
            (sliderContext && [sliderContext.subtitleStart, sliderContext.subtitleEnd]) ||
            undefined;
        const timestampBoundaryInterval =
            (sliderContext && boundaryIntervalFromSliderContext(sliderContext)) || undefined;
        const timestampMarks =
            (sliderContext && sliderMarksFromSliderContext(sliderContext, timestampBoundaryInterval!)) || undefined;
        const selectedSubtitles =
            sliderContext === undefined || timestampInterval === undefined
                ? []
                : sliderContext.subtitles.filter((s) => subtitleIntersectsTimeInterval(s, timestampInterval));
        setText(
            initialText ??
                selectedSubtitles
                    .filter((s) => s.text.trim() !== '')
                    .map((s) => s.text)
                    .join('\n')
        );
        setTimestampInterval(timestampInterval);
        setSelectedSubtitles(selectedSubtitles);
        setInitialTimestampInterval(forceInitialTimestampInterval || timestampInterval);
        setLastAppliedTimestampIntervalToText(initialLastAppliedTimestampIntervalToText || timestampInterval);
        setLastAppliedTimestampIntervalToAudio(initialLastAppliedTimestampIntervalToAudio || timestampInterval);
        setTimestampBoundaryInterval(forceTimestampBoundaryInterval ?? timestampBoundaryInterval);
        setInitialTimestampBoundaryInterval(timestampBoundaryInterval);
        setTimestampMarks(timestampMarks);
    }, [
        sliderContext,
        forceInitialTimestampInterval,
        initialSelectedTimestampInterval,
        forceTimestampBoundaryInterval,
        initialLastAppliedTimestampIntervalToText,
        initialLastAppliedTimestampIntervalToAudio,
    ]);

    useEffect(() => {
        if (!initialAudioClip) {
            setAudioClip(undefined);
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
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            audioClip!.play();
        },
        [audioClip]
    );

    const handleCustomFieldChange = useCallback(
        (customFieldName: string, value: string) => {
            const newCustomFieldValues: { [fieldName: string]: string } = {};
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
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            onViewImage(image!);
        },
        [image, onViewImage]
    );

    const handleApplyTimestampIntervalToText = useCallback(() => {
        if (timestampInterval === undefined) {
            return;
        }

        const newText = textForTimestampInterval(timestampInterval);
        setText(newText);
        setLastAppliedTimestampIntervalToText(timestampInterval);
    }, [textForTimestampInterval, timestampInterval]);

    const handleTimestampIntervalChange = useCallback(
        (e: React.ChangeEvent<{}>, newValue: number | number[]) => {
            const newTimestampInterval = newValue as number[];
            setTimestampInterval(newTimestampInterval);
            const selectedSubtitles = sliderContext!.subtitles.filter((s) =>
                subtitleIntersectsTimeInterval(s, newTimestampInterval)
            );
            setSelectedSubtitles(selectedSubtitles);

            if (lastAppliedTimestampIntervalToText !== undefined) {
                const expectedUnchangedText = textForTimestampInterval(lastAppliedTimestampIntervalToText);

                if (text.trim() === expectedUnchangedText.trim()) {
                    const newText = textForTimestampInterval(newTimestampInterval);
                    setText(newText);
                    setLastAppliedTimestampIntervalToText(newTimestampInterval);
                }
            }

            if (onRerecord === undefined && audioClip?.isSliceable() === true) {
                setLastAppliedTimestampIntervalToAudio(newTimestampInterval);
            }
        },
        [sliderContext, text, lastAppliedTimestampIntervalToText, textForTimestampInterval]
    );

    const handleApplyTimestampIntervalToAudio = useCallback(
        (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            if (onRerecord) {
                e.stopPropagation();
                onRerecord();
            } else {
                setLastAppliedTimestampIntervalToAudio(timestampInterval);
            }
        },
        [onRerecord, timestampInterval]
    );

    const handleResetTimestampInterval = useCallback(() => {
        if (!initialTimestampBoundaryInterval) {
            return;
        }

        const selectedSubtitles =
            sliderContext === undefined || initialTimestampInterval === undefined
                ? []
                : sliderContext.subtitles.filter((s) => subtitleIntersectsTimeInterval(s, initialTimestampInterval));
        setSelectedSubtitles(selectedSubtitles);
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

    const handleZoomOutTimestampInterval = useCallback(() => {
        if (!timestampBoundaryInterval || !timestampInterval) {
            return;
        }

        const newMin = Math.max(0, 2 * timestampBoundaryInterval[0] - timestampInterval[0]);
        const newMax = 2 * timestampBoundaryInterval[1] - timestampInterval[1];
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderContext && sliderMarksFromSliderContext(sliderContext, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, sliderContext]);

    const handleCopyImageToClipboard = useCallback(
        async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation();

            if (!image) {
                return;
            }

            navigator.clipboard.write([new ClipboardItem({ 'image/png': await image.pngBlob() })]);
        },
        [image]
    );

    const disableApplyTextSelection =
        !sliderContext || sliderContext.subtitles.filter((s) => s.text.trim() !== '').length === 0;

    let audioActionElement: JSX.Element | undefined = undefined;

    if (onRerecord !== undefined) {
        audioActionElement = (
            <Tooltip title="Apply Selection (rerecord)">
                <span>
                    <IconButton
                        disabled={
                            !timestampInterval ||
                            !lastAppliedTimestampIntervalToAudio ||
                            (timestampInterval[0] === lastAppliedTimestampIntervalToAudio[0] &&
                                timestampInterval[1] === lastAppliedTimestampIntervalToAudio[1])
                        }
                        onClick={handleApplyTimestampIntervalToAudio}
                        edge="end"
                    >
                        <FiberManualRecordIcon />
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    return (
        <Dialog open={open} disableEnforceFocus fullWidth maxWidth="sm" onClose={onCancel}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    Anki Export
                </Typography>
                {onOpenSettings && (
                    <IconButton edge="end" onClick={() => onOpenSettings()}>
                        <SettingsIcon />
                    </IconButton>
                )}
            </Toolbar>
            <DialogContent ref={dialogRefCallback}>
                <form className={classes.root}>
                    {sliderContext && timestampInterval && (
                        <TextImageSet
                            selectedSubtitles={selectedSubtitles.filter((s) => s.textImage !== undefined)}
                            width={width}
                        />
                    )}
                    <TextField
                        variant="filled"
                        color="secondary"
                        multiline
                        fullWidth
                        maxRows={8}
                        label="Sentence"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        InputProps={{
                            endAdornment: timestampInterval && (
                                <TextFieldEndAdornment position="end">
                                    <Tooltip title="Apply Selection">
                                        <span>
                                            <IconButton
                                                disabled={
                                                    !timestampInterval ||
                                                    !lastAppliedTimestampIntervalToText ||
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
                                </TextFieldEndAdornment>
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
                    {Object.keys(customFields).map((customFieldName) => (
                        <TextField
                            key={customFieldName}
                            variant="filled"
                            color="secondary"
                            fullWidth
                            multiline
                            maxRows={8}
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
                                helperText={
                                    onRerecord === undefined &&
                                    !audioClip.isSliceable() &&
                                    'Audio clip cannot be updated because it is pre-recorded'
                                }
                                InputProps={{
                                    endAdornment: audioActionElement && timestampInterval && (
                                        <InputAdornment position="end">{audioActionElement}</InputAdornment>
                                    ),
                                }}
                            />
                        </div>
                    )}
                    {image && (
                        <div className={classes.mediaField} onClick={handleViewImage}>
                            <TextField
                                variant="filled"
                                color="secondary"
                                fullWidth
                                value={image.name}
                                label="Image"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip title="Copy to Clipboard">
                                                <span>
                                                    <IconButton onClick={handleCopyImageToClipboard} edge="end">
                                                        <FileCopyIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                }}
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
                            <Grid item>
                                <Tooltip title="Zoom Out">
                                    <span>
                                        <IconButton
                                            edge="end"
                                            style={{ marginTop: -8 }}
                                            onClick={handleZoomOutTimestampInterval}
                                        >
                                            <ZoomOutIcon />
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
                {sliderContext && (
                    <Button disabled={disabled} onClick={() => onRewind()}>
                        Rewind
                    </Button>
                )}
                <Button
                    disabled={disabled}
                    onClick={() =>
                        onProceed(
                            text,
                            definition,
                            audioClip,
                            image,
                            word,
                            source ?? '',
                            url ?? '',
                            customFieldValues,
                            tags,
                            'gui'
                        )
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
                            source ?? '',
                            url ?? '',
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
                            source ?? '',
                            url ?? '',
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
