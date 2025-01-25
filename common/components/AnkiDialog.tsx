import React, { MutableRefObject, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Image, SubtitleModel, CardModel, AnkiExportMode } from '@project/common';
import { AnkiSettings, Profile, sortedAnkiFieldModels } from '@project/common/settings';
import {
    humanReadableTime,
    surroundingSubtitlesAroundInterval,
    subtitleIntersectsTimeInterval,
    joinSubtitles,
    extractText,
} from '@project/common/util';
import { AudioClip } from '@project/common/audio-clip';
import Badge from '@material-ui/core/Badge';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import RestoreIcon from '@material-ui/icons/Restore';
import SettingsIcon from '@material-ui/icons/Settings';
import CloseIcon from '@material-ui/icons/Close';
import Slider, { Mark } from '@material-ui/core/Slider';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import ZoomOutIcon from '@material-ui/icons/ZoomOut';
import DoneIcon from '@material-ui/icons/Done';
import TagsTextField from './TagsTextField';
import { Anki, ExportParams } from '../anki';
import { isFirefox } from '../browser-detection';
import SentenceField from './SentenceField';
import DefinitionField from './DefinitionField';
import WordField from './WorldField';
import CustomField from './CustomField';
import AudioField from './AudioField';
import ImageField from './ImageField';
import ImageDialog from './ImageDialog';
import MiniProfileSelector from './MiniProfileSelector';
import type { ButtonBaseActions } from '@material-ui/core';

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
            background: theme.palette.type === 'dark' ? '#222' : '#ddd',
            borderRadius: theme.spacing(1),
            paddingLeft: theme.spacing(1),
            paddingRight: theme.spacing(1),
            color: theme.palette.text.disabled,
        },
        '& .MuiSlider-markLabelActive': {
            opacity: 1,
            color: theme.palette.text.primary,
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

export interface AnkiDialogState {
    text: string;
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
    definition: string;
    word: string;
    source: string;
    url: string;
    track1: string;
    track2: string;
    track3: string;
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
    onProceed: (params: ExportParams) => void;
    onRerecord?: () => void;
    onCancel: () => void;
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
    mp3Encoder: (blob: Blob, extension: string) => Promise<Blob>;
    profiles?: Profile[];
    activeProfile?: string;
    onSetActiveProfile?: (profile: string | undefined) => void;
    lastSelectedExportMode?: AnkiExportMode;
}

const AnkiDialog = ({
    open,
    disabled,
    card,
    onProceed,
    onCancel,
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
    mp3Encoder,
    profiles,
    activeProfile,
    onSetActiveProfile,
    lastSelectedExportMode,
}: AnkiDialogProps) => {
    const classes = useStyles();
    const [definition, setDefinition] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [word, setWord] = useState<string>('');
    const [source, setSource] = useState<string>('');
    const [tags, setTags] = useState<string[]>(settings.tags);
    const [url, setUrl] = useState<string>(card.url ?? '');
    const [track1, setTrack1] = useState<string>('');
    const [track2, setTrack2] = useState<string>('');
    const [track3, setTrack3] = useState<string>('');
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
    const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false);
    const [image, setImage] = useState<Image>();
    const dialogRef = useRef<HTMLDivElement>();
    const dialogRefCallback = useCallback((element: HTMLDivElement) => {
        dialogRef.current = element;
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
            track1,
            track2,
            track3,
            customFieldValues,
            initialTimestampInterval,
            timestampBoundaryInterval,
            lastAppliedTimestampIntervalToText,
            lastAppliedTimestampIntervalToAudio,
            timestampInterval,
        };
    }

    const textForTimestampInterval = useCallback(
        (timestampInterval: number[], track?: number) => {
            return joinSubtitles(
                card.surroundingSubtitles
                    .filter((s) => subtitleIntersectsTimeInterval(s, timestampInterval))
                    .filter((s) => track === undefined || s.track === track)
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
        setText(initialText ?? extractText(card.subtitle, card.surroundingSubtitles) ?? '');
        setDefinition(initialDefinition ?? '');
        setWord(initialWord ?? '');
        setSource(initialSource ?? `${card.subtitleFileName} (${humanReadableTime(card.subtitle.start)})`);
        setUrl(card.url ?? '');
        setTrack1(extractText(card.subtitle, card.surroundingSubtitles, 0));
        setTrack2(extractText(card.subtitle, card.surroundingSubtitles, 1));
        setTrack3(extractText(card.subtitle, card.surroundingSubtitles, 2));
        setCustomFieldValues(initialCustomFieldValues ?? {});
    }, [
        card.subtitle,
        card.surroundingSubtitles,
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
        setText(initialText ?? joinSubtitles(selectedSubtitles));
        const trackText = (track: number) => joinSubtitles(selectedSubtitles.filter((s) => s.track === track));
        setTrack1(trackText(0));
        setTrack2(trackText(1));
        setTrack3(trackText(2));
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
        () =>
            AudioClip.fromCard(
                card,
                settings.audioPaddingStart,
                settings.audioPaddingEnd,
                settings.recordWithAudioPlayback
            ),
        [card, settings.audioPaddingStart, settings.audioPaddingEnd, settings.recordWithAudioPlayback]
    );

    useEffect(() => {
        if (!initialAudioClip) {
            setAudioClip(undefined);
            return;
        }

        let newAudioClip = initialAudioClip;

        if (settings.preferMp3) {
            newAudioClip = newAudioClip.toEncoded(mp3Encoder, 'mp3');
        }

        if (lastAppliedTimestampIntervalToAudio) {
            newAudioClip = newAudioClip.slice(
                Math.max(0, Math.round(lastAppliedTimestampIntervalToAudio[0]) - settings.audioPaddingStart),
                Math.round(lastAppliedTimestampIntervalToAudio[1]) + settings.audioPaddingEnd
            );
        }

        setAudioClip(newAudioClip);
    }, [
        mp3Encoder,
        initialAudioClip,
        settings.preferMp3,
        lastAppliedTimestampIntervalToAudio,
        settings.audioPaddingStart,
        settings.audioPaddingEnd,
    ]);

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

    useEffect(() => {
        setImage(Image.fromCard(card, settings.maxImageWidth, settings.maxImageHeight));
    }, [card, settings.maxImageWidth, settings.maxImageHeight]);

    useEffect(() => {
        if (!open && image) {
            image.dispose();
            setImage(undefined);
        }
    }, [open, image]);

    const handleViewImage = useCallback(
        async (e: React.MouseEvent<HTMLDivElement>) => {
            if (image?.error !== undefined) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            setImageDialogOpen(true);
        },
        [image]
    );

    const handleCloseImageDialog = useCallback(() => setImageDialogOpen(false), []);

    const handleImageTimestampChange = useCallback((timestamp: number) => {
        setImage((image) => {
            if (!image) {
                return;
            }

            return image.atTimestamp(timestamp);
        });
    }, []);

    const applyTimestampIntervalToTrack = useCallback(
        (
            newTimestampInterval: number[],
            currentText: string,
            changeText: (newText: string) => void,
            track?: number,
            force?: boolean
        ) => {
            const expectedUnchangedText =
                lastAppliedTimestampIntervalToText === undefined
                    ? undefined
                    : textForTimestampInterval(lastAppliedTimestampIntervalToText, track);

            if (force || expectedUnchangedText === undefined || currentText.trim() === expectedUnchangedText.trim()) {
                const newText = textForTimestampInterval(newTimestampInterval, track);
                changeText(newText);
            }
        },
        [textForTimestampInterval, lastAppliedTimestampIntervalToText]
    );

    const applyTimestampIntervalToAllTracks = useCallback(
        (newTimestampInterval: number[], force?: boolean) => {
            applyTimestampIntervalToTrack(newTimestampInterval, text, setText, undefined, force);
            applyTimestampIntervalToTrack(newTimestampInterval, track1, setTrack1, 0, force);
            applyTimestampIntervalToTrack(newTimestampInterval, track2, setTrack2, 1, force);
            applyTimestampIntervalToTrack(newTimestampInterval, track3, setTrack3, 2, force);
        },
        [applyTimestampIntervalToTrack, text, track1, track2, track3]
    );

    const handleApplyTimestampIntervalToText = useCallback(() => {
        if (timestampInterval === undefined) {
            return;
        }

        applyTimestampIntervalToAllTracks(timestampInterval, true);
        setLastAppliedTimestampIntervalToText(timestampInterval);
    }, [applyTimestampIntervalToAllTracks, timestampInterval]);

    const handleTimestampIntervalChange = useCallback(
        (e: React.ChangeEvent<{}>, newValue: number | number[]) => {
            const newTimestampInterval = newValue as number[];
            setTimestampInterval(newTimestampInterval);
            const selectedSubtitles = card.surroundingSubtitles.filter((s) =>
                subtitleIntersectsTimeInterval(s, newTimestampInterval)
            );
            setSelectedSubtitles(selectedSubtitles);
            applyTimestampIntervalToAllTracks(newTimestampInterval);
            setLastAppliedTimestampIntervalToText(newTimestampInterval);

            if (onRerecord === undefined && audioClip?.isSliceable() === true) {
                setLastAppliedTimestampIntervalToAudio(newTimestampInterval);
            }
        },
        [card.surroundingSubtitles, audioClip, onRerecord, applyTimestampIntervalToAllTracks]
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

        if (initialTimestampInterval !== undefined) {
            applyTimestampIntervalToAllTracks(initialTimestampInterval, true);
            setLastAppliedTimestampIntervalToText(initialTimestampInterval);
        }
    }, [
        initialTimestampInterval,
        initialTimestampBoundaryInterval,
        card.surroundingSubtitles,
        applyTimestampIntervalToAllTracks,
    ]);

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
    const ankiFieldModels = sortedAnkiFieldModels(settings);

    useEffect(() => {
        if (!open) {
            audioClip?.stop();
        }
    }, [open, audioClip]);

    const handleSentenceTextChange = useCallback((text: string) => {
        setText(text);
        setLastAppliedTimestampIntervalToText(undefined);
    }, []);

    const handleTrack1TextChange = useCallback((text: string) => {
        setTrack1(text);
        setLastAppliedTimestampIntervalToText(undefined);
    }, []);

    const handleTrack2TextChange = useCallback((text: string) => {
        setTrack2(text);
        setLastAppliedTimestampIntervalToText(undefined);
    }, []);

    const handleTrack3TextChange = useCallback((text: string) => {
        setTrack3(text);
        setLastAppliedTimestampIntervalToText(undefined);
    }, []);

    const updateLastButtonRef = useRef<HTMLButtonElement>(null);
    const openInAnkiButtonRef = useRef<HTMLButtonElement>(null);
    const exportButtonRef = useRef<HTMLButtonElement>(null);
    const updateLastButtonActionRef = useRef<ButtonBaseActions>(null);
    const openInAnkiButtonActionRef = useRef<ButtonBaseActions>(null);
    const exportButtonActionRef = useRef<ButtonBaseActions>(null);
    const lastSelectedExportModeRef = useRef<AnkiExportMode>();
    lastSelectedExportModeRef.current = lastSelectedExportMode;

    const focusOnPreferredAction = useCallback(() => {
        const preferredExportMode = lastSelectedExportModeRef.current;

        if (preferredExportMode === undefined) {
            return;
        }

        let actionRef: React.RefObject<ButtonBaseActions | null>;

        switch (preferredExportMode) {
            case 'default':
                actionRef = exportButtonActionRef;
                break;
            case 'gui':
                actionRef = openInAnkiButtonActionRef;
                break;
            case 'updateLast':
                actionRef = updateLastButtonActionRef;
                break;
        }

        if (!actionRef.current) {
            const timeout = setTimeout(() => actionRef.current?.focusVisible(), 10);
            return () => clearTimeout(timeout);
        }

        actionRef.current.focusVisible();
    }, []);

    const doFocusedAction = useCallback(() => {
        const activeElement = document.activeElement;

        if (!activeElement) {
            return;
        }

        for (const buttonRef of [exportButtonRef, openInAnkiButtonRef, updateLastButtonRef]) {
            if (buttonRef.current === activeElement) {
                buttonRef.current.click();
            }
        }
    }, []);

    useEffect(() => {
        if (open && !disabled) {
            focusOnPreferredAction();
        }
    }, [open, disabled, focusOnPreferredAction]);

    const handleProceed = useCallback(
        (mode: AnkiExportMode) => {
            onProceed({
                text,
                track1,
                track2,
                track3,
                definition,
                audioClip,
                image,
                word,
                source,
                url,
                customFieldValues,
                tags,
                mode,
            });
        },
        [
            text,
            track1,
            track2,
            track3,
            definition,
            audioClip,
            image,
            word,
            source,
            url,
            customFieldValues,
            tags,
            onProceed,
        ]
    );

    const handleOpenInAnki = useCallback(() => handleProceed('gui'), [handleProceed]);
    const handleUpdateLastCard = useCallback(() => handleProceed('updateLast'), [handleProceed]);
    const handleExport = useCallback(() => handleProceed('default'), [handleProceed]);

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if ((e.metaKey || e.altKey) && e.shiftKey) {
                if (e.key === 'Enter') {
                    doFocusedAction();
                } else {
                    focusOnPreferredAction();
                }
            }
        };
        document.addEventListener('keydown', listener);
        return () => document.removeEventListener('keydown', listener);
    }, [doFocusedAction, focusOnPreferredAction]);

    return (
        <>
            <Dialog open={open} disableRestoreFocus disableEnforceFocus fullWidth maxWidth="sm" onClose={onCancel}>
                <Toolbar>
                    <Typography variant="h6" className={classes.title}>
                        {t('ankiDialog.title')}
                    </Typography>
                    {profiles !== undefined && onSetActiveProfile && (
                        <MiniProfileSelector
                            profiles={profiles}
                            activeProfile={activeProfile}
                            onSetActiveProfile={onSetActiveProfile}
                        />
                    )}
                    {onOpenSettings && (
                        <IconButton edge="end" onClick={onOpenSettings}>
                            <Badge invisible={ankiIsAvailable} badgeContent={'!'} color="error">
                                <SettingsIcon />
                            </Badge>
                        </IconButton>
                    )}
                    {onCancel && (
                        <IconButton edge="end" onClick={onCancel}>
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
                                            label={t('ankiDialog.sentence')!}
                                            width={width}
                                            onChangeText={handleSentenceTextChange}
                                            selectedSubtitles={selectedSubtitles}
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
                                            timestampIntervalSelectionNotApplied={
                                                timestampInterval?.[0] !== lastAppliedTimestampIntervalToAudio?.[0] ||
                                                timestampInterval?.[1] !== lastAppliedTimestampIntervalToAudio?.[1]
                                            }
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
                                    {!model.custom && model.key === 'url' && model.field.display && card.url && (
                                        <TextField
                                            variant="filled"
                                            color="secondary"
                                            fullWidth
                                            label={t('ankiDialog.url')}
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                        />
                                    )}
                                    {!model.custom && model.key === 'track1' && model.field.display && (
                                        <SentenceField
                                            text={track1}
                                            label={t('ankiDialog.track1')}
                                            width={width}
                                            onChangeText={handleTrack1TextChange}
                                            selectedSubtitles={selectedSubtitles.filter((s) => s.track === 0)}
                                        />
                                    )}
                                    {!model.custom && model.key === 'track2' && model.field.display && (
                                        <SentenceField
                                            text={track2}
                                            label={t('ankiDialog.track2')}
                                            width={width}
                                            onChangeText={handleTrack2TextChange}
                                            selectedSubtitles={selectedSubtitles.filter((s) => s.track === 1)}
                                        />
                                    )}
                                    {!model.custom && model.key === 'track3' && model.field.display && (
                                        <SentenceField
                                            text={track3}
                                            label={t('ankiDialog.track3')}
                                            width={width}
                                            onChangeText={handleTrack3TextChange}
                                            selectedSubtitles={selectedSubtitles.filter((s) => s.track === 2)}
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
                                                <RestoreIcon fontSize="small" />
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
                                                <ZoomInIcon fontSize="small" />
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
                                                <ZoomOutIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Grid>
                                <Grid item>
                                    <Tooltip title={t('ankiDialog.applySelection')!}>
                                        <span>
                                            <IconButton
                                                edge="end"
                                                style={{ marginTop: -8 }}
                                                disabled={
                                                    !timestampInterval ||
                                                    (lastAppliedTimestampIntervalToText !== undefined &&
                                                        timestampInterval[0] ===
                                                            lastAppliedTimestampIntervalToText[0] &&
                                                        timestampInterval[1] ===
                                                            lastAppliedTimestampIntervalToText[1]) ||
                                                    disableApplyTextSelection
                                                }
                                                onClick={handleApplyTimestampIntervalToText}
                                            >
                                                <DoneIcon fontSize="small" />
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
                        ref={openInAnkiButtonRef}
                        action={openInAnkiButtonActionRef}
                        disabled={disabled}
                        onClick={handleOpenInAnki}
                    >
                        {t('ankiDialog.openInAnki')}
                    </Button>
                    <Button
                        ref={updateLastButtonRef}
                        action={updateLastButtonActionRef}
                        disabled={disabled}
                        onClick={handleUpdateLastCard}
                    >
                        {t('ankiDialog.updateLastCard')}
                    </Button>
                    <Button
                        ref={exportButtonRef}
                        action={exportButtonActionRef}
                        disabled={disabled}
                        onClick={handleExport}
                    >
                        {t('ankiDialog.export')}
                    </Button>
                </DialogActions>
            </Dialog>
            <ImageDialog
                open={open && imageDialogOpen}
                image={image}
                interval={timestampBoundaryInterval}
                onClose={handleCloseImageDialog}
                onTimestampChange={handleImageTimestampChange}
            />
        </>
    );
};

export default AnkiDialog;
