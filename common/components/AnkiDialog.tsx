import React, { MutableRefObject, useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Image, SubtitleModel, CardModel } from '@project/common';
import { AnkiSettings, sortedAnkiFieldModels } from '@project/common/settings';
import {
    humanReadableTime,
    surroundingSubtitlesAroundInterval,
    subtitleIntersectsTimeInterval,
    joinSubtitles,
} from '@project/common/util';
import { AudioClip } from '@project/common/audio-clip';
import Badge from '@material-ui/core/Badge';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import RestoreIcon from '@material-ui/icons/Restore';
import SettingsIcon from '@material-ui/icons/Settings';
import CloseIcon from '@material-ui/icons/Close';
import Slider, { Mark } from '@material-ui/core/Slider';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import ZoomOutIcon from '@material-ui/icons/ZoomOut';
import SubtitleTextImage from './SubtitleTextImage';
import TagsTextField from './TagsTextField';
import { Anki, AnkiExportMode } from '../anki';
import { isFirefox } from '../browser-detection';
import SentenceField from './SentenceField';
import DefinitionField from './DefinitionField';
import WordField from './WorldField';
import CustomField from './CustomField';
import AudioField from './AudioField';
import ImageField from './ImageField';

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

const boundaryIntervalFromCard = (subtitle: SubtitleModel, theSurroundingSubtitles: SubtitleModel[]) => {
    let index = theSurroundingSubtitles.findIndex((s) => s.start === subtitle.start);
    index = index === -1 ? theSurroundingSubtitles.length / 2 : index;

    const { surroundingSubtitles: subtitlesToDisplay } = surroundingSubtitlesAroundInterval(
        theSurroundingSubtitles,
        subtitle.start,
        subtitle.end,
        boundaryIntervalSubtitleCountRadius,
        boundaryIntervalSubtitleTimeRadius
    );

    let min: number | null = null;
    let max: number | null = null;

    for (const s of subtitlesToDisplay ?? []) {
        if (min === null || s.start < min) {
            min = s.start;
        }

        if (max === null || s.end > max) {
            max = s.end;
        }
    }

    return min !== null && max !== null && [min, max];
};

const sliderMarksFromCard = (surroundingSubtitles: SubtitleModel[], boundary: number[]): Mark[] => {
    const seenTimestamps: any = {};

    return surroundingSubtitles
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
};

const sliderValueLabelFormat = (ms: number) => {
    return humanReadableTime(ms, true);
};

interface ValueLabelComponentProps {
    children: React.ReactElement;
    open: boolean;
    value: number;
}

const ValueLabelComponent = ({ children, open, value }: ValueLabelComponentProps) => {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="top" title={value}>
            {children}
        </Tooltip>
    );
};

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

const TextImageSet = ({ selectedSubtitles, width }: TextImageSetProps) => {
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
};

export interface AnkiDialogState {
    text: string;
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
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
    card: CardModel;
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
    onCancel: () => void;
    onViewImage: (image: Image) => void;
    onOpenSettings?: () => void;
    onCopyToClipboard: (blob: Blob) => void;
    settings: AnkiSettings;
    anki: Anki;
    source?: string;
    initialTimestampInterval?: number[];
    timestampBoundaryInterval?: number[];
    timestampInterval?: number[];
    lastAppliedTimestampIntervalToText?: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
    stateRef?: MutableRefObject<AnkiDialogState | undefined>;
    mp3WorkerFactory: () => Worker;
}

const AnkiDialog = ({
    open,
    disabled,
    card,
    onProceed,
    onCancel,
    onViewImage,
    onOpenSettings,
    onRerecord,
    onCopyToClipboard,
    settings,
    anki,
    source: initialSource,
    timestampInterval: initialSelectedTimestampInterval,
    timestampBoundaryInterval: forceTimestampBoundaryInterval,
    initialTimestampInterval: forceInitialTimestampInterval,
    lastAppliedTimestampIntervalToText: initialLastAppliedTimestampIntervalToText,
    lastAppliedTimestampIntervalToAudio: initialLastAppliedTimestampIntervalToAudio,
    stateRef,
    mp3WorkerFactory,
}: AnkiDialogProps) => {
    const classes = useStyles();
    const [definition, setDefinition] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [word, setWord] = useState<string>('');
    const [lastSearchedWord, setLastSearchedWord] = useState<string>();
    const [source, setSource] = useState<string>('');
    const [tags, setTags] = useState<string[]>(settings.tags);
    const [url, setUrl] = useState<string>(card.url ?? '');
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
    const [ankiIsAvailable, setAnkiIsAvailable] = useState<boolean>(true);
    const dialogRefCallback = useCallback((element: HTMLElement) => {
        setWidth(element?.getBoundingClientRect().width ?? 0);
    }, []);
    const { t } = useTranslation();

    if (stateRef) {
        stateRef.current = {
            text,
            subtitle: card.subtitle,
            surroundingSubtitles: card.surroundingSubtitles,
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
            return joinSubtitles(
                card.surroundingSubtitles.filter((s) => subtitleIntersectsTimeInterval(s, timestampInterval))
            );
        },
        [card.surroundingSubtitles]
    );

    const {
        text: initialText,
        definition: initialDefinition,
        word: initialWord,
        customFieldValues: initialCustomFieldValues,
    } = card;

    useEffect(() => {
        setText(initialText ?? card.subtitle.text ?? '');
        setDefinition(initialDefinition ?? '');
        setWord(initialWord ?? '');
        setSource(initialSource ?? `${card.subtitleFileName} (${humanReadableTime(card.subtitle.start)})`);
        setUrl(card.url ?? '');
        setDuplicateNotes([]);
        setCustomFieldValues(initialCustomFieldValues ?? {});
    }, [
        card.subtitle,
        card.url,
        card.subtitleFileName,
        initialText,
        initialSource,
        initialDefinition,
        initialWord,
        initialCustomFieldValues,
    ]);

    useEffect(() => {
        anki.version()
            .then(() => {
                setAnkiIsAvailable(true);
            })
            .catch(() => {
                setAnkiIsAvailable(false);
            });
    }, [anki]);

    useEffect(() => {
        setTags(settings.tags);
    }, [settings.tags]);

    useEffect(() => {
        const timestampInterval =
            initialSelectedTimestampInterval || [card.subtitle.start, card.subtitle.end] || undefined;
        const timestampBoundaryInterval =
            boundaryIntervalFromCard(card.subtitle, card.surroundingSubtitles) || undefined;
        const timestampMarks = sliderMarksFromCard(card.surroundingSubtitles, timestampBoundaryInterval!) || undefined;
        const selectedSubtitles =
            timestampInterval === undefined
                ? []
                : card.surroundingSubtitles.filter((s) => subtitleIntersectsTimeInterval(s, timestampInterval));
        setText(initialText ?? joinSubtitles(selectedSubtitles) ?? card.subtitle.text);
        setTimestampInterval(timestampInterval);
        setSelectedSubtitles(selectedSubtitles);
        setInitialTimestampInterval(forceInitialTimestampInterval || timestampInterval);
        setLastAppliedTimestampIntervalToText(initialLastAppliedTimestampIntervalToText || timestampInterval);
        setLastAppliedTimestampIntervalToAudio(initialLastAppliedTimestampIntervalToAudio || timestampInterval);
        setTimestampBoundaryInterval(forceTimestampBoundaryInterval ?? timestampBoundaryInterval);
        setInitialTimestampBoundaryInterval(timestampBoundaryInterval);
        setTimestampMarks(timestampMarks);
    }, [
        card.subtitle,
        card.surroundingSubtitles,
        initialText,
        forceInitialTimestampInterval,
        initialSelectedTimestampInterval,
        forceTimestampBoundaryInterval,
        initialLastAppliedTimestampIntervalToText,
        initialLastAppliedTimestampIntervalToAudio,
    ]);

    const initialAudioClip = useMemo(
        () => AudioClip.fromCard(card, settings.audioPaddingStart, settings.audioPaddingEnd),
        [card, settings.audioPaddingStart, settings.audioPaddingEnd]
    );

    useEffect(() => {
        if (!initialAudioClip) {
            setAudioClip(undefined);
            return;
        }

        let newAudioClip = initialAudioClip;

        if (settings.preferMp3) {
            newAudioClip = newAudioClip.toMp3(mp3WorkerFactory);
        }

        if (lastAppliedTimestampIntervalToAudio) {
            newAudioClip = newAudioClip.slice(
                Math.max(0, Math.round(lastAppliedTimestampIntervalToAudio[0]) - settings.audioPaddingStart),
                Math.round(lastAppliedTimestampIntervalToAudio[1]) + settings.audioPaddingEnd
            );
        }

        setAudioClip(newAudioClip);
    }, [
        mp3WorkerFactory,
        initialAudioClip,
        settings.preferMp3,
        lastAppliedTimestampIntervalToAudio,
        settings.audioPaddingStart,
        settings.audioPaddingEnd,
    ]);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [word]);

    useEffect(() => {
        if (!word || !settings.wordField) {
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
    }, [word, wordTimestamp, lastSearchedWord, anki, settings.wordField]);

    const handlePlayAudio = useCallback(
        async (e: React.MouseEvent<HTMLDivElement>) => {
            if (audioClip?.error !== undefined) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            audioClip!.play().catch(console.info);
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

    if (word && word.trim() === lastSearchedWord && settings.wordField) {
        wordHelperText =
            duplicateNotes.length > 0
                ? t('ankiDialog.foundDuplicateNotes', {
                      count: duplicateNotes.length,
                      word: word,
                      field: settings.wordField,
                  })
                : t('ankiDialog.foundNoDuplicateNote', { word: word, field: settings.wordField });
    } else {
        wordHelperText = '';
    }

    const image = useMemo(
        () => Image.fromCard(card, settings.maxImageWidth, settings.maxImageHeight),
        [card, settings.maxImageWidth, settings.maxImageHeight]
    );

    const handleViewImage = useCallback(
        async (e: React.MouseEvent<HTMLDivElement>) => {
            if (!image?.isAvailable()) {
                return;
            }

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
            const selectedSubtitles = card.surroundingSubtitles.filter((s) =>
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
        [
            card.surroundingSubtitles,
            audioClip,
            onRerecord,
            text,
            lastAppliedTimestampIntervalToText,
            textForTimestampInterval,
        ]
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
            initialTimestampInterval == undefined
                ? []
                : card.surroundingSubtitles.filter((s) => subtitleIntersectsTimeInterval(s, initialTimestampInterval));
        setSelectedSubtitles(selectedSubtitles);
        setTimestampInterval(initialTimestampInterval);
        setTimestampBoundaryInterval(initialTimestampBoundaryInterval);
        setTimestampMarks(sliderMarksFromCard(card.surroundingSubtitles, initialTimestampBoundaryInterval));
    }, [initialTimestampInterval, initialTimestampBoundaryInterval, card.surroundingSubtitles]);

    const handleZoomInTimestampInterval = useCallback(() => {
        if (!timestampBoundaryInterval || !timestampInterval) {
            return;
        }

        const newMin = (timestampBoundaryInterval[0] + timestampInterval[0]) / 2;
        const newMax = (timestampBoundaryInterval[1] + timestampInterval[1]) / 2;
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderMarksFromCard(card.surroundingSubtitles, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, card.surroundingSubtitles]);

    const handleZoomOutTimestampInterval = useCallback(() => {
        if (!timestampBoundaryInterval || !timestampInterval) {
            return;
        }

        const currentLength = timestampBoundaryInterval[1] - timestampBoundaryInterval[0];
        const minimumChange = currentLength / 4;
        const newMin = Math.max(
            0,
            Math.min(
                timestampBoundaryInterval[0] - minimumChange,
                2 * timestampBoundaryInterval[0] - timestampInterval[0]
            )
        );
        const newMax = Math.max(
            timestampBoundaryInterval[1] + minimumChange,
            2 * timestampBoundaryInterval[1] - timestampInterval[1]
        );
        const newTimestampBoundaryInterval = [newMin, newMax];
        setTimestampBoundaryInterval(newTimestampBoundaryInterval);
        setTimestampMarks(sliderMarksFromCard(card.surroundingSubtitles, newTimestampBoundaryInterval));
    }, [timestampBoundaryInterval, timestampInterval, card.surroundingSubtitles]);

    const handleCopyImageToClipboard = useCallback(
        async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation();

            if (!image) {
                return;
            }

            onCopyToClipboard(await image.pngBlob());
        },
        [image, onCopyToClipboard]
    );

    const disableApplyTextSelection = card.surroundingSubtitles.filter((s) => s.text.trim() !== '').length === 0;

    let audioActionElement: JSX.Element | undefined = undefined;

    if (onRerecord !== undefined) {
        audioActionElement = (
            <Tooltip title={t('ankiDialog.rerecord')!}>
                <span>
                    <IconButton
                        disabled={audioClip?.error !== undefined}
                        onClick={handleApplyTimestampIntervalToAudio}
                        edge="end"
                    >
                        <FiberManualRecordIcon />
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    const ankiFieldModels = sortedAnkiFieldModels(settings);

    useEffect(() => {
        if (!open) {
            audioClip?.stop();
        }
    }, [open, audioClip]);

    return (
        <Dialog open={open} disableEnforceFocus fullWidth maxWidth="sm" onClose={onCancel}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    {t('ankiDialog.title')}
                </Typography>
                {onOpenSettings && (
                    <IconButton edge="end" onClick={() => onOpenSettings()}>
                        <Badge invisible={ankiIsAvailable} badgeContent={'!'} color="error">
                            <SettingsIcon />
                        </Badge>
                    </IconButton>
                )}
                {onCancel && (
                    <IconButton edge="end" onClick={() => onCancel()}>
                        <CloseIcon />
                    </IconButton>
                )}
            </Toolbar>
            <DialogContent ref={dialogRefCallback}>
                <form className={classes.root}>
                    {ankiFieldModels.map((model) => {
                        const key = model.custom ? `custom_${model.key}` : `standard_${model.key}`;

                        return (
                            <React.Fragment key={key}>
                                {!model.custom && model.key === 'sentence' && model.field.display && (
                                    <SentenceField
                                        text={text}
                                        width={width}
                                        onChangeText={setText}
                                        selectedSubtitles={selectedSubtitles}
                                        applySelectedRangeDisabled={
                                            !timestampInterval ||
                                            !lastAppliedTimestampIntervalToText ||
                                            (timestampInterval[0] === lastAppliedTimestampIntervalToText[0] &&
                                                timestampInterval[1] === lastAppliedTimestampIntervalToText[1]) ||
                                            disableApplyTextSelection
                                        }
                                        onApplySelectedRangeToText={handleApplyTimestampIntervalToText}
                                    />
                                )}
                                {!model.custom && model.key === 'definition' && model.field.display && (
                                    <DefinitionField text={definition} onTextChange={setDefinition} />
                                )}
                                {!model.custom && model.key === 'word' && model.field.display && (
                                    <WordField
                                        anki={anki}
                                        disabled={disabled}
                                        text={word}
                                        onText={setWord}
                                        wordField={settings.wordField}
                                    />
                                )}
                                {image && !model.custom && model.key === 'image' && model.field.display && (
                                    <ImageField
                                        onViewImage={handleViewImage}
                                        image={image}
                                        onCopyImageToClipboard={handleCopyImageToClipboard}
                                        copyEnabled={!isFirefox}
                                    />
                                )}
                                {audioClip && !model.custom && model.key === 'audio' && model.field.display && (
                                    <AudioField
                                        audioClip={audioClip}
                                        onRerecord={onRerecord}
                                        onPlayAudio={handlePlayAudio}
                                    />
                                )}
                                {!model.custom && model.key === 'source' && model.field.display && (
                                    <TextField
                                        variant="filled"
                                        color="secondary"
                                        fullWidth
                                        label={t('ankiDialog.source')}
                                        value={source}
                                        onChange={(e) => setSource(e.target.value)}
                                    />
                                )}
                                {!model.custom && model.key === 'url' && model.field.display && (
                                    <TextField
                                        variant="filled"
                                        color="secondary"
                                        fullWidth
                                        label={t('ankiDialog.url')}
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                    />
                                )}
                                {model.custom && model.field.display && (
                                    <CustomField
                                        name={model.key}
                                        text={customFieldValues[model.key] || ''}
                                        onTextChange={handleCustomFieldChange}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                    <TagsTextField
                        variant="filled"
                        label="Tags"
                        helperText={t('ankiDialog.tagList')}
                        fullWidth
                        color="secondary"
                        tags={tags}
                        onTagsChange={(newTags) => setTags(newTags)}
                    />
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
                                <Tooltip title={t('ankiDialog.resetSlider')!}>
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
                                <Tooltip title={t('ankiDialog.zoomIn')!}>
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
                                <Tooltip title={t('ankiDialog.zoomOut')!}>
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
                    {t('ankiDialog.openInAnki')}
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
                    {t('ankiDialog.updateLastCard')}
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
                    {t('ankiDialog.export')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AnkiDialog;
