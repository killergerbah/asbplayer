import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode } from 'react';
import { makeStyles } from '@material-ui/styles';
import { computeStyles } from '../services/Util';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import CustomFieldDialog from './CustomFieldDialog';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormLabel from '@material-ui/core/FormLabel';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import Link from '@material-ui/core/Link';
import MenuItem from '@material-ui/core/MenuItem';
import DeleteIcon from '@material-ui/icons/Delete';
import Radio from '@material-ui/core/Radio';
import RefreshIcon from '@material-ui/icons/Refresh';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import TagsTextField from './TagsTextField';
import { Theme } from '@material-ui/core/styles';
import { Anki, AsbplayerSettings } from '@project/common';

const useStyles = makeStyles<Theme>((theme) => ({
    root: {
        '& .MuiTextField-root': {
            marginTop: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    },
    subtitleSetting: {
        '& .MuiTextField-root': {
            marginTop: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    },
    subtitlePreview: {
        backgroundImage: `linear-gradient(45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(-45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.palette.action.disabledBackground} 75%), linear-gradient(-45deg, transparent 75%,${theme.palette.action.disabledBackground} 75%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        maxWidth: '100%',
        padding: 10,
    },
    subtitlePreviewInput: {
        border: 'none',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0)',
        '&:focus': {
            outline: 'none',
        },
    },
    addFieldButton: {
        width: '100%',
    },
}));

const useSelectableSettingStyles = makeStyles<Theme>((theme) => ({
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
    root: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'end',
        alignItems: 'flex-end',
    },
}));

interface SelectableSettingProps {
    label: string;
    value: string;
    selections?: string[];
    removable?: boolean;
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
    onSelectionChange: (event: ChangeEvent<{name?: string | undefined, value: unknown}>, child: ReactNode) => void;
    onRemoval?: () => void;
}

function SelectableSetting({
    label,
    value,
    selections,
    removable,
    onChange,
    onSelectionChange,
    onRemoval,
}: SelectableSettingProps) {
    const classes = useSelectableSettingStyles();

    return (
        <div className={classes.root}>
            <TextField
                label={label}
                value={value}
                onChange={onChange}
                fullWidth
                color="secondary"
                InputProps={{
                    endAdornment: removable && (
                        <InputAdornment position="end">
                            <IconButton onClick={(e) => onRemoval?.()}>
                                <DeleteIcon />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />
            <FormControl className={classes.formControl}>
                <InputLabel></InputLabel>
                <Select value={value} disabled={!selections} color="secondary" onChange={onSelectionChange}>
                    {selections &&
                        selections.map((s) => (
                            <MenuItem key={s} value={s}>
                                {s}
                            </MenuItem>
                        ))}
                </Select>
            </FormControl>
        </div>
    );
}

interface Props {
    anki: Anki;
    open: boolean;
    settings: AsbplayerSettings;
    onClose: (settings: AsbplayerSettings) => void;
}

export default function SettingsDialog({ anki, open, settings, onClose }: Props) {
    const classes = useStyles();
    const [ankiConnectUrl, setAnkiConnectUrl] = useState<string>(settings.ankiConnectUrl);
    const [ankiConnectUrlError, setAnkiConnectUrlError] = useState<string>();
    const [ankiConnectUrlChangeTimestamp, setAnkiConnectUrlChangeTimestamp] = useState<number>(0);
    const [deck, setDeck] = useState<string>(settings.deck || '');
    const [deckNames, setDeckNames] = useState<string[]>();
    const [noteType, setNoteType] = useState<string>(settings.noteType || '');
    const [modelNames, setModelNames] = useState<string[]>();
    const [sentenceField, setSentenceField] = useState<string>(settings.sentenceField || '');
    const [definitionField, setDefinitionField] = useState<string>(settings.definitionField || '');
    const [audioField, setAudioField] = useState<string>(settings.audioField || '');
    const [imageField, setImageField] = useState<string>(settings.imageField || '');
    const [wordField, setWordField] = useState<string>(settings.wordField || '');
    const [sourceField, setSourceField] = useState<string>(settings.sourceField || '');
    const [urlField, setUrlField] = useState<string>(settings.urlField || '');
    const [customFields, setCustomFields] = useState<{ [key: string]: string }>(settings.customAnkiFields);
    const [tags, setTags] = useState<string[]>(settings.tags);
    const [preferMp3, setPreferMp3] = useState<boolean>(settings.preferMp3);
    const [fieldNames, setFieldNames] = useState<string[]>();
    const [customFieldDialogOpen, setCustomFieldDialogOpen] = useState<boolean>(false);
    const [audioPaddingStart, setAudioPaddingStart] = useState<number>(settings.audioPaddingStart);
    const [audioPaddingEnd, setAudioPaddingEnd] = useState<number>(settings.audioPaddingEnd);
    const [maxImageWidth, setMaxImageWidth] = useState<number>(settings.maxImageWidth);
    const [maxImageHeight, setMaxImageHeight] = useState<number>(settings.maxImageHeight);
    const [subtitleColor, setSubtitleColor] = useState<string>(settings.subtitleColor);
    const [subtitleSize, setSubtitleSize] = useState<number>(settings.subtitleSize);
    const [subtitleOutlineColor, setSubtitleOutlineColor] = useState<string>(settings.subtitleOutlineColor);
    const [subtitleOutlineThickness, setSubtitleOutlineThickness] = useState<number>(settings.subtitleOutlineThickness);
    const [subtitleBackgroundColor, setSubtitleBackgroundColor] = useState<string>(settings.subtitleBackgroundColor);
    const [subtitleBackgroundOpacity, setSubtitleBackgroundOpacity] = useState<number>(
        settings.subtitleBackgroundOpacity
    );
    const [subtitleFontFamily, setSubtitleFontFamily] = useState<string>(settings.subtitleFontFamily);
    const [subtitlePreview, setSubtitlePreview] = useState<string>(settings.subtitlePreview);
    const [themeType, setThemeType] = useState<"dark" | "light">(settings.themeType);

    const handleAnkiConnectUrlChange = useCallback((e) => {
        setAnkiConnectUrl(e.target.value);
        setAnkiConnectUrlChangeTimestamp(Date.now());
    }, []);

    const handleRetryAnkiConnectUrl = useCallback((e) => setAnkiConnectUrlChangeTimestamp(Date.now()), []);
    const handleDeckChange = useCallback((e) => setDeck(e.target.value), []);
    const handleNoteTypeChange = useCallback((e) => setNoteType(e.target.value), []);
    const handleSentenceFieldChange = useCallback((e) => setSentenceField(e.target.value), []);
    const handleDefinitionFieldChange = useCallback((e) => setDefinitionField(e.target.value), []);
    const handleAudioFieldChange = useCallback((e) => setAudioField(e.target.value), []);
    const handleImageFieldChange = useCallback((e) => setImageField(e.target.value), []);
    const handleWordFieldChange = useCallback((e) => setWordField(e.target.value), []);
    const handleSourceFieldChange = useCallback((e) => setSourceField(e.target.value), []);
    const handleUrlFieldChange = useCallback((e) => setUrlField(e.target.value), []);
    const handleAudioPaddingStart = useCallback((e) => setAudioPaddingStart(e.target.value), []);
    const handleAudioPaddingEnd = useCallback((e) => setAudioPaddingEnd(e.target.value), []);
    const handleMaxImageWidth = useCallback((e) => setMaxImageWidth(e.target.value), []);
    const handleMaxImageHeight = useCallback((e) => setMaxImageHeight(e.target.value), []);
    const handleSubtitleColorChange = useCallback((e) => setSubtitleColor(e.target.value), []);
    const handleSubtitleSizeChange = useCallback((e) => setSubtitleSize(e.target.value), []);
    const handleSubtitleOutlineColorChange = useCallback((e) => setSubtitleOutlineColor(e.target.value), []);
    const handleSubtitleOutlineThicknessChange = useCallback((e) => setSubtitleOutlineThickness(e.target.value), []);
    const handleSubtitleBackgroundColorChange = useCallback((e) => setSubtitleBackgroundColor(e.target.value), []);
    const handleSubtitleBackgroundOpacityChange = useCallback((e) => setSubtitleBackgroundOpacity(e.target.value), []);
    const handleSubtitleFontFamilyChange = useCallback((e) => setSubtitleFontFamily(e.target.value), []);
    const handleSubtitlePreviewChange = useCallback((e) => setSubtitlePreview(e.target.value), []);
    const handleAddCustomField = useCallback((customFieldName: string) => {
        setCustomFields((oldCustomFields: { [key: string]: string }) => {
            const newCustomFields: { [key: string]: string } = {};
            Object.assign(newCustomFields, oldCustomFields);
            newCustomFields[customFieldName] = '';
            return newCustomFields;
        });
        setCustomFieldDialogOpen(false);
    }, []);
    const handleCustomFieldChange = useCallback((customFieldName: string, value: string) => {
        setCustomFields((oldCustomFields: { [key: string]: string }) => {
            const newCustomFields: { [key: string]: string } = {};
            Object.assign(newCustomFields, oldCustomFields);
            newCustomFields[customFieldName] = value;
            return newCustomFields;
        });
    }, []);
    const handleCustomFieldRemoval = useCallback(
        (customFieldName: string) =>
            setCustomFields((oldCustomFields: { [key: string]: string }) => {
                const newCustomFields: { [key: string]: string } = {};
                Object.assign(newCustomFields, oldCustomFields);
                delete newCustomFields[customFieldName];
                return newCustomFields;
            }),
        []
    );
    const handleTagsChange = useCallback((newTags) => {
        setTags(newTags);
    }, []);
    const handlePreferMp3Change = useCallback((e) => setPreferMp3(e.target.checked), []);
    const handleThemeTypeChange = useCallback((e) => setThemeType(e.target.value), []);
    const subtitlePreviewStyles = useMemo(
        () =>
            computeStyles({
                subtitleColor: subtitleColor,
                subtitleSize: subtitleSize,
                subtitleOutlineThickness: subtitleOutlineThickness,
                subtitleOutlineColor: subtitleOutlineColor,
                subtitleBackgroundOpacity: subtitleBackgroundOpacity,
                subtitleBackgroundColor: subtitleBackgroundColor,
                subtitleFontFamily: subtitleFontFamily,
            }),
        [
            subtitleColor,
            subtitleSize,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleBackgroundOpacity,
            subtitleBackgroundColor,
            subtitleFontFamily,
        ]
    );

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            try {
                if (canceled) {
                    return;
                }

                await anki.requestPermission(ankiConnectUrl);
                setDeckNames(await anki.deckNames(ankiConnectUrl));
                setModelNames(await anki.modelNames(ankiConnectUrl));
                setAnkiConnectUrlError(undefined);
            } catch (e) {
                if (canceled) {
                    return;
                }

                console.error(e);
                setDeckNames(undefined);
                setModelNames(undefined);

                if (e instanceof Error) {
                    setAnkiConnectUrlError(e.message);
                } else if (typeof e === 'string') {
                    setAnkiConnectUrlError(e);
                } else {
                    setAnkiConnectUrlError(String(e));
                }
            }
        }, 1000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [anki, ankiConnectUrl, ankiConnectUrlChangeTimestamp]);

    useEffect(() => {
        if (!noteType || ankiConnectUrlError) {
            return undefined;
        }

        let canceled = false;

        async function refreshFieldNames() {
            try {
                if (canceled) {
                    return;
                }

                setFieldNames(['', ...(await anki.modelFieldNames(noteType, ankiConnectUrl))]);
                setAnkiConnectUrlError(undefined);
            } catch (e) {
                if (canceled) {
                    return;
                }

                console.error(e);
                setFieldNames(undefined);

                if (e instanceof Error) {
                    setAnkiConnectUrlError(e.message);
                } else if (typeof e === 'string') {
                    setAnkiConnectUrlError(e);
                } else {
                    setAnkiConnectUrlError(String(e));
                }
            }
        }

        refreshFieldNames();

        return () => {
            canceled = true;
        };
    }, [anki, noteType, ankiConnectUrl, ankiConnectUrlError, ankiConnectUrlChangeTimestamp]);

    const handleClose = useCallback(() => {
        onClose({
            ankiConnectUrl: ankiConnectUrl,
            deck: deck,
            noteType: noteType,
            sentenceField: sentenceField,
            definitionField: definitionField,
            audioField: audioField,
            imageField: imageField,
            wordField: wordField,
            sourceField: sourceField,
            urlField: urlField,
            tags: tags.filter((t) => t !== ''),
            subtitleSize: Number(subtitleSize),
            subtitleColor: subtitleColor,
            subtitleOutlineThickness: Number(subtitleOutlineThickness),
            subtitleOutlineColor: subtitleOutlineColor,
            subtitleBackgroundColor: subtitleBackgroundColor,
            subtitleBackgroundOpacity: Number(subtitleBackgroundOpacity),
            subtitleFontFamily: subtitleFontFamily,
            subtitlePreview: subtitlePreview,
            customAnkiFields: customFields,
            preferMp3: preferMp3,
            themeType: themeType,
            audioPaddingStart: audioPaddingStart,
            audioPaddingEnd: audioPaddingEnd,
            maxImageWidth: maxImageWidth,
            maxImageHeight: maxImageHeight,
            // The settings below are not currently mutable
            surroundingSubtitlesCountRadius: settings.surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius: settings.surroundingSubtitlesTimeRadius,
            volume: settings.volume
        });
    }, [
        onClose,
        ankiConnectUrl,
        deck,
        noteType,
        sentenceField,
        definitionField,
        audioField,
        imageField,
        wordField,
        sourceField,
        urlField,
        customFields,
        tags,
        preferMp3,
        subtitleSize,
        subtitleColor,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitlePreview,
        themeType,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        settings.surroundingSubtitlesCountRadius,
        settings.surroundingSubtitlesTimeRadius,
        settings.volume
    ]);

    const customFieldInputs = Object.keys(customFields).map((customFieldName) => {
        return (
            <SelectableSetting
                key={customFieldName}
                label={`${customFieldName} Field`}
                value={customFields[customFieldName]}
                selections={fieldNames!}
                onChange={(e) => handleCustomFieldChange(customFieldName, e.target.value)}
                onSelectionChange={(e) => handleCustomFieldChange(customFieldName, e.target.value as string)}
                onRemoval={() => handleCustomFieldRemoval(customFieldName)}
                removable={true}
            />
        );
    });

    return (
        <React.Fragment>
            <CustomFieldDialog
                open={customFieldDialogOpen}
                existingCustomFieldNames={Object.keys(customFields)}
                onProceed={handleAddCustomField}
                onCancel={() => setCustomFieldDialogOpen(false)}
            />
            <Dialog open={open} maxWidth="xs" fullWidth onBackdropClick={handleClose} onEscapeKeyDown={handleClose}>
                <DialogTitle>Settings</DialogTitle>
                <DialogContent>
                    <Grid container direction="column" spacing={3}>
                        <Grid item>
                            <FormLabel>Anki</FormLabel>
                            <FormGroup className={classes.root}>
                                <TextField
                                    label="Anki Connect URL"
                                    value={ankiConnectUrl}
                                    error={Boolean(ankiConnectUrlError)}
                                    helperText={ankiConnectUrlError}
                                    color="secondary"
                                    onChange={handleAnkiConnectUrlChange}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={handleRetryAnkiConnectUrl}>
                                                    <RefreshIcon />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <FormHelperText>
                                    Ensure that {window.location.protocol + '//' + window.location.hostname} is in the
                                    webCorsOriginList in your AnkiConnect settings as in this{' '}
                                    <Link
                                        color="secondary"
                                        target="_blank"
                                        rel="noreferrer"
                                        href="https://youtu.be/Mv7fEVb6PHo?t=44"
                                    >
                                        video
                                    </Link>
                                    .
                                </FormHelperText>
                                <SelectableSetting
                                    label="Deck"
                                    value={deck}
                                    selections={deckNames}
                                    onChange={handleDeckChange}
                                    onSelectionChange={handleDeckChange}
                                />
                                <SelectableSetting
                                    label="Note Type"
                                    value={noteType}
                                    selections={modelNames}
                                    onChange={handleNoteTypeChange}
                                    onSelectionChange={handleNoteTypeChange}
                                />
                                <SelectableSetting
                                    label="Sentence Field"
                                    value={sentenceField}
                                    selections={fieldNames}
                                    onChange={handleSentenceFieldChange}
                                    onSelectionChange={handleSentenceFieldChange}
                                />
                                <SelectableSetting
                                    label="Definition Field"
                                    value={definitionField}
                                    selections={fieldNames}
                                    onChange={handleDefinitionFieldChange}
                                    onSelectionChange={handleDefinitionFieldChange}
                                />
                                <SelectableSetting
                                    label="Word Field"
                                    value={wordField}
                                    selections={fieldNames}
                                    onChange={handleWordFieldChange}
                                    onSelectionChange={handleWordFieldChange}
                                />
                                <SelectableSetting
                                    label="Audio Field"
                                    value={audioField}
                                    selections={fieldNames}
                                    onChange={handleAudioFieldChange}
                                    onSelectionChange={handleAudioFieldChange}
                                />
                                <SelectableSetting
                                    label="Image Field"
                                    value={imageField}
                                    selections={fieldNames}
                                    onChange={handleImageFieldChange}
                                    onSelectionChange={handleImageFieldChange}
                                />
                                <SelectableSetting
                                    label="Source Field"
                                    value={sourceField}
                                    selections={fieldNames}
                                    onChange={handleSourceFieldChange}
                                    onSelectionChange={handleSourceFieldChange}
                                />
                                <SelectableSetting
                                    label="URL Field"
                                    value={urlField}
                                    selections={fieldNames}
                                    onChange={handleUrlFieldChange}
                                    onSelectionChange={handleUrlFieldChange}
                                />
                                {customFieldInputs}
                                <Button
                                    className={classes.addFieldButton}
                                    onClick={(e) => setCustomFieldDialogOpen(true)}
                                >
                                    Add Custom Field
                                </Button>
                                <TagsTextField
                                    label="Tags"
                                    helperText="Comma-separated list of strings"
                                    fullWidth
                                    color="secondary"
                                    tags={tags}
                                    onTagsChange={handleTagsChange}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={preferMp3} onChange={handlePreferMp3Change} />}
                                    label="Re-encode audio as mp3 (slower)"
                                />
                                <TextField
                                    type="number"
                                    label="Audio Padding Start"
                                    fullWidth
                                    value={audioPaddingStart}
                                    color="secondary"
                                    onChange={handleAudioPaddingStart}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    }}
                                />
                                <TextField
                                    type="number"
                                    label="Audio Padding End"
                                    fullWidth
                                    value={audioPaddingEnd}
                                    color="secondary"
                                    onChange={handleAudioPaddingEnd}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    }}
                                />
                                <TextField
                                    type="number"
                                    label="Max Image Width"
                                    fullWidth
                                    value={maxImageWidth}
                                    color="secondary"
                                    onChange={handleMaxImageWidth}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                />
                                <TextField
                                    type="number"
                                    label="Max Image Height"
                                    fullWidth
                                    value={maxImageHeight}
                                    color="secondary"
                                    onChange={handleMaxImageHeight}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                />
                            </FormGroup>
                        </Grid>
                        <Grid item>
                            <FormLabel>Video Subtitle Appearance</FormLabel>
                            <FormGroup>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="color"
                                        label="Subtitle Color"
                                        fullWidth
                                        value={subtitleColor}
                                        color="secondary"
                                        onChange={handleSubtitleColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label="Subtitle Size"
                                        fullWidth
                                        value={subtitleSize}
                                        color="secondary"
                                        onChange={handleSubtitleSizeChange}
                                        inputProps={{
                                            min: 1,
                                            step: 1,
                                        }}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="color"
                                        label="Subtitle Outline Color"
                                        fullWidth
                                        value={subtitleOutlineColor}
                                        color="secondary"
                                        onChange={handleSubtitleOutlineColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label="Subtitle Outline Thickness"
                                        fullWidth
                                        value={subtitleOutlineThickness}
                                        onChange={handleSubtitleOutlineThicknessChange}
                                        inputProps={{
                                            min: 0,
                                            step: 1,
                                        }}
                                        color="secondary"
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="color"
                                        label="Subtitle Background Color"
                                        fullWidth
                                        value={subtitleBackgroundColor}
                                        color="secondary"
                                        onChange={handleSubtitleBackgroundColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label="Subtitle Background Opacity"
                                        fullWidth
                                        inputProps={{
                                            min: 0,
                                            max: 1,
                                            step: 0.1,
                                        }}
                                        value={subtitleBackgroundOpacity}
                                        color="secondary"
                                        onChange={handleSubtitleBackgroundOpacityChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="text"
                                        label="Subtitle Font Family"
                                        placeholder="Inherited"
                                        fullWidth
                                        value={subtitleFontFamily}
                                        color="secondary"
                                        onChange={handleSubtitleFontFamilyChange}
                                    />
                                </div>
                                <div className={classes.subtitlePreview}>
                                    <input
                                        value={subtitlePreview}
                                        className={classes.subtitlePreviewInput}
                                        onChange={handleSubtitlePreviewChange}
                                        style={subtitlePreviewStyles}
                                    />
                                </div>
                            </FormGroup>
                        </Grid>
                        <Grid item>
                            <FormLabel>Theme</FormLabel>
                            <div>
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={themeType === 'light'}
                                            value="light"
                                            onChange={handleThemeTypeChange}
                                        />
                                    }
                                    label="Light"
                                />
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={themeType === 'dark'}
                                            value="dark"
                                            onChange={handleThemeTypeChange}
                                        />
                                    }
                                    label="Dark"
                                />
                            </div>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>OK</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}
