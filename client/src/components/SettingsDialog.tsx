import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { makeStyles } from '@material-ui/styles';
import { computeStyles } from '../services/util';
import Button from '@material-ui/core/Button';
import CustomFieldDialog from './CustomFieldDialog';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import EditIcon from '@material-ui/icons/Edit';
import InfoIcon from '@material-ui/icons/Info';
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
import { Theme } from '@material-ui/core/styles';
import { Anki, AsbplayerSettings, AutoPausePreference, KeyBindSet, KeyBindName } from '@project/common';
import { TagsTextField } from '@project/common/components';
import hotkeys from 'hotkeys-js';
import Typography from '@material-ui/core/Typography';
import ChromeExtension from '../services/ChromeExtension';
import { isMacOs } from 'react-device-detect';
import Switch from '@material-ui/core/Switch';
import RadioGroup from '@material-ui/core/RadioGroup';
import Tooltip from '@material-ui/core/Tooltip';

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
    switchLabel: {
        justifyContent: 'space-between',
        marginLeft: 0,
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

function regexIsValid(regex: string) {
    try {
        new RegExp(regex.trim());
        return true;
    } catch (e) {
        return false;
    }
}

interface SelectableSettingProps {
    label: string;
    value: string;
    selections?: string[];
    removable?: boolean;
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
    onSelectionChange: (event: ChangeEvent<{ name?: string | undefined; value: unknown }>, child: ReactNode) => void;
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

interface KeyBindProperties {
    label: string;
    extensionOverridden: boolean;
}

const keyBindProperties: { [key in KeyBindName]: KeyBindProperties } = {
    copySubtitle: { label: 'Mine current subtitle', extensionOverridden: true },
    ankiExport: { label: 'Mine current subtitle and open Anki dialog', extensionOverridden: true },
    updateLastCard: {
        label: 'Update last-created Anki card with asbplayer-captured screenshot, audio, etc.',
        extensionOverridden: true,
    },
    togglePlay: { label: 'Play/pause', extensionOverridden: false },
    toggleAutoPause: { label: 'Toggle auto-pause', extensionOverridden: false },
    toggleCondensedPlayback: { label: 'Toggle condensed playback', extensionOverridden: false },
    toggleSubtitles: { label: 'Toggle subtitles', extensionOverridden: false },
    toggleVideoSubtitleTrack1: { label: 'Toggle subtitle track 1 in video', extensionOverridden: false },
    toggleVideoSubtitleTrack2: { label: 'Toggle subtitle track 2 in video', extensionOverridden: false },
    toggleAsbplayerSubtitleTrack1: { label: 'Toggle subtitle track 1 in asbplayer', extensionOverridden: false },
    toggleAsbplayerSubtitleTrack2: { label: 'Toggle subtitle track 2 in asbplayer', extensionOverridden: false },
    seekBackward: { label: 'Seek backward 10 seconds', extensionOverridden: false },
    seekForward: { label: 'Seek forward 10 seconds', extensionOverridden: false },
    seekToPreviousSubtitle: { label: 'Seek to previous subtitle', extensionOverridden: false },
    seekToNextSubtitle: { label: 'Seek to next subtitle', extensionOverridden: false },
    seekToBeginningOfCurrentSubtitle: { label: 'Seek to beginning of current subtitle', extensionOverridden: false },
    adjustOffsetToPreviousSubtitle: {
        label: 'Adjust subtitle offset so that previous subtitle is at current timestamp',
        extensionOverridden: false,
    },
    adjustOffsetToNextSubtitle: {
        label: 'Adjust subtitle offset so that next subtitle is at current timestamp',
        extensionOverridden: false,
    },
    increaseOffset: { label: 'Adjust subtitle offset by +100ms', extensionOverridden: false },
    decreaseOffset: { label: 'Adjust subtitle offset by -100ms', extensionOverridden: false },
    resetOffset: { label: 'Reset subtitle offset', extensionOverridden: false },
    increasePlaybackRate: { label: 'Adjust playback rate by +0.1', extensionOverridden: false },
    decreasePlaybackRate: { label: 'Adjust playback rate by -0.1', extensionOverridden: false },
};

// hotkeys only returns strings for a Mac while requiring the OS-specific keys for the actual binds
const modifierKeyReplacements: { [key: string]: string } = isMacOs
    ? {}
    : {
          '⌃': 'ctrl',
          '⇧': 'shift',
          '⌥': 'alt',
      };

const modifierKeys = ['⌃', '⇧', '⌥', 'ctrl', 'shift', 'alt', 'option', 'control', 'command', '⌘'];

const useKeyBindFieldStyles = makeStyles<Theme>((theme) => ({
    container: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
    },
    labelItem: {},
}));

interface KeyBindFieldProps {
    label: string;
    keys: string;
    extensionOverridden: boolean;
    onKeysChange: (keys: string) => void;
    onOpenExtensionShortcuts: () => void;
}

function KeyBindField({ label, keys, extensionOverridden, onKeysChange, onOpenExtensionShortcuts }: KeyBindFieldProps) {
    const classes = useKeyBindFieldStyles();
    const [currentKeyString, setCurrentKeyString] = useState<string>(keys);
    const currentKeyStringRef = useRef<string>();
    currentKeyStringRef.current = currentKeyString;
    const onKeysChangeRef = useRef<(keys: string) => void>();
    onKeysChangeRef.current = onKeysChange;
    const [editing, setEditing] = useState<boolean>(false);

    useEffect(() => setCurrentKeyString(keys), [keys]);

    const handleEditKeyBinding = useCallback(
        (event: React.MouseEvent) => {
            if (event.nativeEvent.detail === 0) {
                return;
            }

            if (extensionOverridden) {
                onOpenExtensionShortcuts();
                return;
            }

            setCurrentKeyString('');
            setEditing(true);
        },
        [onOpenExtensionShortcuts, extensionOverridden]
    );

    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!editing) {
            return;
        }

        const handler = (event: KeyboardEvent) => {
            if (event.type === 'keydown') {
                // The ts declaration is missing getPressedKeyString()
                // @ts-ignore
                const pressed = hotkeys.getPressedKeyString() as string[];
                setCurrentKeyString(
                    pressed
                        .map((key) => {
                            return modifierKeyReplacements[key] ?? key;
                        })
                        .sort((a, b) => {
                            const isAModifier = modifierKeys.includes(a);
                            const isBModifier = modifierKeys.includes(b);

                            if (isAModifier && !isBModifier) {
                                return -1;
                            }

                            if (!isAModifier && isBModifier) {
                                return 1;
                            }

                            return 0;
                        })
                        .join('+')
                );
            } else if (event.type === 'keyup') {
                setEditing(false);

                // Need to use refs because hotkeys returns the wrong keys
                // if the handler is bound/unbound.
                if (currentKeyStringRef.current) {
                    onKeysChangeRef.current!(currentKeyStringRef.current);
                }
            }
        };

        hotkeys('*', { keyup: true }, handler);
        return () => hotkeys.unbind('*', handler);
    }, [editing]);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (editing && !ref.current?.contains(event.target as Node)) {
                setEditing(false);
                setCurrentKeyString('');
                onKeysChange('');
            }
        };
        window.document.addEventListener('click', handler);
        return () => window.document.removeEventListener('click', handler);
    }, [editing, onKeysChange]);

    let placeholder: string;

    if (editing) {
        placeholder = 'Recording';
    } else if (extensionOverridden) {
        placeholder = 'Overridden';
    } else {
        placeholder = 'Unbound';
    }

    return (
        <Grid container className={classes.container} wrap={'nowrap'} spacing={1}>
            <Grid item className={classes.labelItem} xs={6}>
                <Typography>{label}</Typography>
            </Grid>
            <Grid item xs={6}>
                <TextField
                    placeholder={placeholder}
                    size="small"
                    contentEditable={false}
                    disabled={extensionOverridden}
                    helperText={extensionOverridden ? 'Extension shortcut' : undefined}
                    value={currentKeyString}
                    color="secondary"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton ref={ref} onClick={handleEditKeyBinding}>
                                    <EditIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </Grid>
        </Grid>
    );
}

interface Props {
    anki: Anki;
    extension: ChromeExtension;
    open: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    onClose: (settings: AsbplayerSettings) => void;
}

export default function SettingsDialog({ anki, extension, open, settings, scrollToId, onClose }: Props) {
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
    const [surroundingSubtitlesCountRadius, setSurroundingSubtitlesCountRadius] = useState<number>(
        settings.surroundingSubtitlesCountRadius
    );
    const [surroundingSubtitlesTimeRadius, setSurroundingSubtitlesTimeRadius] = useState<number>(
        settings.surroundingSubtitlesTimeRadius
    );
    const [subtitleColor, setSubtitleColor] = useState<string>(settings.subtitleColor);
    const [subtitleSize, setSubtitleSize] = useState<number>(settings.subtitleSize);
    const [subtitleOutlineColor, setSubtitleOutlineColor] = useState<string>(settings.subtitleOutlineColor);
    const [subtitleOutlineThickness, setSubtitleOutlineThickness] = useState<number>(settings.subtitleOutlineThickness);
    const [subtitleBackgroundColor, setSubtitleBackgroundColor] = useState<string>(settings.subtitleBackgroundColor);
    const [subtitleBackgroundOpacity, setSubtitleBackgroundOpacity] = useState<number>(
        settings.subtitleBackgroundOpacity
    );
    const [subtitleFontFamily, setSubtitleFontFamily] = useState<string>(settings.subtitleFontFamily);
    const [imageBasedSubtitleScaleFactor, setImageBasedSubtitleScaleFactor] = useState<number>(
        settings.imageBasedSubtitleScaleFactor
    );
    const [subtitlePreview, setSubtitlePreview] = useState<string>(settings.subtitlePreview);
    const [themeType, setThemeType] = useState<'dark' | 'light'>(settings.themeType);
    const [copyToClipboardOnMine, setCopyToClipboardOnMine] = useState<boolean>(settings.copyToClipboardOnMine);
    const [autoPausePreference, setAutoPausePreference] = useState<AutoPausePreference>(settings.autoPausePreference);
    const [keyBindSet, setKeyBindSet] = useState<KeyBindSet>(settings.keyBindSet);
    const [rememberSubtitleOffset, setRememberSubtitleOffset] = useState<boolean>(settings.rememberSubtitleOffset);
    const [autoCopyCurrentSubtitle, setAutoCopyCurrentSubtitle] = useState<boolean>(settings.autoCopyCurrentSubtitle);
    const [subtitleRegexFilter, setSubtitleRegexFilter] = useState<string>(settings.subtitleRegexFilter);
    const [subtitleRegexFilterTextReplacement, setSubtitleRegexFilterTextReplacement] = useState<string>(
        settings.subtitleRegexFilterTextReplacement
    );

    const handleAnkiConnectUrlChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setAnkiConnectUrl(e.target.value);
        setAnkiConnectUrlChangeTimestamp(Date.now());
    }, []);

    const handleRetryAnkiConnectUrl = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => setAnkiConnectUrlChangeTimestamp(Date.now()),
        []
    );
    const handleDeckChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDeck(e.target.value),
        []
    );
    const handleDeckSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setDeck(e.target.value as string),
        []
    );
    const handleNoteTypeChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setNoteType(e.target.value),
        []
    );
    const handleNoteTypeSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setNoteType(e.target.value as string),
        []
    );
    const handleSentenceFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSentenceField(e.target.value),
        []
    );
    const handleSentenceFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setSentenceField(e.target.value as string),
        []
    );
    const handleDefinitionFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDefinitionField(e.target.value),
        []
    );
    const handleDefinitionFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setDefinitionField(e.target.value as string),
        []
    );
    const handleAudioFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setAudioField(e.target.value),
        []
    );
    const handleAudioFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setAudioField(e.target.value as string),
        []
    );
    const handleImageFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setImageField(e.target.value),
        []
    );
    const handleImageFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setImageField(e.target.value as string),
        []
    );
    const handleWordFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setWordField(e.target.value),
        []
    );
    const handleWordFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setWordField(e.target.value as string),
        []
    );
    const handleSourceFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSourceField(e.target.value),
        []
    );
    const handleSourceFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setSourceField(e.target.value as string),
        []
    );
    const handleUrlFieldChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setUrlField(e.target.value),
        []
    );
    const handleUrlFieldSelectionChange = useCallback(
        (e: ChangeEvent<{ name?: string | undefined; value: unknown }>) => setUrlField(e.target.value as string),
        []
    );
    const handleAudioPaddingStart = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setAudioPaddingStart(Number(e.target.value)),
        []
    );
    const handleAudioPaddingEnd = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setAudioPaddingEnd(Number(e.target.value)),
        []
    );
    const handleMaxImageWidth = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setMaxImageWidth(Number(e.target.value)),
        []
    );
    const handleMaxImageHeight = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setMaxImageHeight(Number(e.target.value)),
        []
    );
    const handleSurroundingSubtitlesCountRadius = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
            setSurroundingSubtitlesCountRadius(Number(e.target.value)),
        []
    );
    const handleSurroundingSubtitlesTimeRadius = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
            setSurroundingSubtitlesTimeRadius(Number(e.target.value)),
        []
    );
    const handleSubtitleColorChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleColor(e.target.value),
        []
    );
    const handleSubtitleSizeChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleSize(Number(e.target.value)),
        []
    );
    const handleSubtitleOutlineColorChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleOutlineColor(e.target.value),
        []
    );
    const handleSubtitleOutlineThicknessChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleOutlineThickness(Number(e.target.value)),
        []
    );
    const handleSubtitleBackgroundColorChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleBackgroundColor(e.target.value),
        []
    );
    const handleSubtitleBackgroundOpacityChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
            setSubtitleBackgroundOpacity(Number(e.target.value)),
        []
    );
    const handleSubtitleFontFamilyChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleFontFamily(e.target.value),
        []
    );
    const handleSubtitlePreviewChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitlePreview(e.target.value),
        []
    );
    const handleImageBasedSubtitleScaleFactorChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
            setImageBasedSubtitleScaleFactor(Number(e.target.value)),
        []
    );
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
    const handleTagsChange = useCallback((newTags: string[]) => {
        setTags(newTags);
    }, []);
    const handlePreferMp3Change = useCallback((e: ChangeEvent<HTMLInputElement>) => setPreferMp3(e.target.checked), []);
    const handleThemeTypeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.value !== 'dark' && e.target.value !== 'light') {
            throw new Error(`Invalid theme type ${e.target.value}`);
        }

        setThemeType(e.target.value);
    }, []);
    const handleCopyToClipboardOnMine = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => setCopyToClipboardOnMine(e.target.checked),
        []
    );
    const handleAutoPausePreferenceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setAutoPausePreference(Number(e.target.value) as AutoPausePreference);
    }, []);
    const handleKeysChange = useCallback((keys: string, keyBindName: KeyBindName) => {
        setKeyBindSet((keyBindSet) => {
            const newKeyBindSet = { ...keyBindSet };
            newKeyBindSet[keyBindName] = { keys };
            return newKeyBindSet;
        });
    }, []);
    const handleRememberSubtitleOffsetChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => setRememberSubtitleOffset(e.target.checked),
        []
    );
    const handleAutoCopyCurrentSubtitle = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => setAutoCopyCurrentSubtitle(e.target.checked),
        []
    );
    const handleSubtitleRegexFilter = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setSubtitleRegexFilter(e.target.value.trim()),
        []
    );
    const handleSubtitleRegexFilterTextReplacement = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
            setSubtitleRegexFilterTextReplacement(e.target.value),
        []
    );

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
            imageBasedSubtitleScaleFactor: imageBasedSubtitleScaleFactor,
            customAnkiFields: customFields,
            preferMp3: preferMp3,
            themeType: themeType,
            audioPaddingStart: audioPaddingStart,
            audioPaddingEnd: audioPaddingEnd,
            maxImageWidth: maxImageWidth,
            maxImageHeight: maxImageHeight,
            surroundingSubtitlesCountRadius: surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius: surroundingSubtitlesTimeRadius,
            copyToClipboardOnMine: copyToClipboardOnMine,
            autoPausePreference: autoPausePreference,
            keyBindSet: keyBindSet,
            rememberSubtitleOffset: rememberSubtitleOffset,
            autoCopyCurrentSubtitle: autoCopyCurrentSubtitle,
            subtitleRegexFilter: subtitleRegexFilter,
            subtitleRegexFilterTextReplacement: subtitleRegexFilterTextReplacement,
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
        imageBasedSubtitleScaleFactor,
        themeType,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        copyToClipboardOnMine,
        autoPausePreference,
        keyBindSet,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        subtitleRegexFilter,
        subtitleRegexFilterTextReplacement,
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

    useEffect(() => {
        if (!scrollToId) {
            return;
        }

        setTimeout(() => document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth' }), 0);
    }, [scrollToId]);

    const validRegex = regexIsValid(subtitleRegexFilter);

    return (
        <React.Fragment>
            <CustomFieldDialog
                open={customFieldDialogOpen}
                existingCustomFieldNames={Object.keys(customFields)}
                onProceed={handleAddCustomField}
                onCancel={() => setCustomFieldDialogOpen(false)}
            />
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <DialogTitle>Settings</DialogTitle>
                <DialogContent>
                    <Grid container direction="column" spacing={3}>
                        <Grid item id="anki-settings">
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
                                    onSelectionChange={handleDeckSelectionChange}
                                />
                                <SelectableSetting
                                    label="Note Type"
                                    value={noteType}
                                    selections={modelNames}
                                    onChange={handleNoteTypeChange}
                                    onSelectionChange={handleNoteTypeSelectionChange}
                                />
                                <SelectableSetting
                                    label="Sentence Field"
                                    value={sentenceField}
                                    selections={fieldNames}
                                    onChange={handleSentenceFieldChange}
                                    onSelectionChange={handleSentenceFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="Definition Field"
                                    value={definitionField}
                                    selections={fieldNames}
                                    onChange={handleDefinitionFieldChange}
                                    onSelectionChange={handleDefinitionFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="Word Field"
                                    value={wordField}
                                    selections={fieldNames}
                                    onChange={handleWordFieldChange}
                                    onSelectionChange={handleWordFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="Audio Field"
                                    value={audioField}
                                    selections={fieldNames}
                                    onChange={handleAudioFieldChange}
                                    onSelectionChange={handleAudioFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="Image Field"
                                    value={imageField}
                                    selections={fieldNames}
                                    onChange={handleImageFieldChange}
                                    onSelectionChange={handleImageFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="Source Field"
                                    value={sourceField}
                                    selections={fieldNames}
                                    onChange={handleSourceFieldChange}
                                    onSelectionChange={handleSourceFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label="URL Field"
                                    value={urlField}
                                    selections={fieldNames}
                                    onChange={handleUrlFieldChange}
                                    onSelectionChange={handleUrlFieldSelectionChange}
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
                            </FormGroup>
                        </Grid>
                        <Grid item id="mining-settings">
                            <FormLabel>Mining</FormLabel>
                            <FormGroup className={classes.root}>
                                <FormControlLabel
                                    control={<Switch checked={preferMp3} onChange={handlePreferMp3Change} />}
                                    label="Re-encode audio as mp3 (slower)"
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={copyToClipboardOnMine}
                                            onChange={handleCopyToClipboardOnMine}
                                        />
                                    }
                                    label="Copy mined subtitles to clipboard"
                                    labelPlacement="start"
                                    className={classes.switchLabel}
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
                                <TextField
                                    type="number"
                                    label="Surrounding Subtitles Count Radius"
                                    fullWidth
                                    value={surroundingSubtitlesCountRadius}
                                    color="secondary"
                                    onChange={handleSurroundingSubtitlesCountRadius}
                                    inputProps={{
                                        min: 1,
                                        step: 1,
                                    }}
                                />
                                <TextField
                                    type="number"
                                    label="Surrounding Subtitles Time Radius"
                                    fullWidth
                                    value={surroundingSubtitlesTimeRadius}
                                    color="secondary"
                                    onChange={handleSurroundingSubtitlesTimeRadius}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    }}
                                />
                            </FormGroup>
                        </Grid>
                        <Grid item id="misc-settings">
                            <FormLabel>Misc</FormLabel>
                            <FormGroup className={classes.root}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={rememberSubtitleOffset}
                                            onChange={handleRememberSubtitleOffsetChange}
                                        />
                                    }
                                    label="Remember subtitle offset"
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={autoCopyCurrentSubtitle}
                                            onChange={handleAutoCopyCurrentSubtitle}
                                        />
                                    }
                                    label="Auto-copy current subtitle to clipboard"
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                                <TextField
                                    label="Subtitle Regex Filter"
                                    fullWidth
                                    value={subtitleRegexFilter}
                                    color="secondary"
                                    error={!validRegex}
                                    helperText={validRegex ? undefined : 'Invalid regular expression'}
                                    onChange={handleSubtitleRegexFilter}
                                />
                                <TextField
                                    label="Subtitle Regex Filter Text Replacement"
                                    fullWidth
                                    value={subtitleRegexFilterTextReplacement}
                                    color="secondary"
                                    onChange={handleSubtitleRegexFilterTextReplacement}
                                />
                            </FormGroup>
                        </Grid>
                        <Grid item id="auto-pause-settings">
                            <Grid container direction="row" spacing={1}>
                                <Grid item>
                                    <FormLabel>Auto-pause Preference</FormLabel>
                                </Grid>
                                <Grid item>
                                    <Tooltip
                                        title="Does not enable auto-pause. Sets the preference for when to pause when auto-pause is
                                    enabled."
                                        placement="top"
                                    >
                                        <InfoIcon fontSize="small" />
                                    </Tooltip>
                                </Grid>
                            </Grid>
                            <RadioGroup row>
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={autoPausePreference === AutoPausePreference.atStart}
                                            value={AutoPausePreference.atStart}
                                            onChange={handleAutoPausePreferenceChange}
                                        />
                                    }
                                    label="At Subtitle Start"
                                />
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={autoPausePreference === AutoPausePreference.atEnd}
                                            value={AutoPausePreference.atEnd}
                                            onChange={handleAutoPausePreferenceChange}
                                        />
                                    }
                                    label="At Subtitle End"
                                />
                            </RadioGroup>
                        </Grid>
                        <Grid item id="video-subtitle-appearance">
                            <FormLabel>Video Subtitle Appearance</FormLabel>
                            <FormGroup className={classes.root}>
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
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label="Image-based Subtitle Scale Factor"
                                        placeholder="Inherited"
                                        fullWidth
                                        inputProps={{
                                            min: 0,
                                            max: 1,
                                            step: 0.1,
                                        }}
                                        value={imageBasedSubtitleScaleFactor}
                                        color="secondary"
                                        onChange={handleImageBasedSubtitleScaleFactorChange}
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
                        <Grid item id="theme-settings">
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
                        <Grid item id="keyboard-shortcuts">
                            <FormLabel>Keyboard Shortcuts</FormLabel>
                            <FormGroup>
                                {Object.keys(keyBindProperties).map((key) => {
                                    const keyBindName = key as KeyBindName;
                                    const properties = keyBindProperties[keyBindName];
                                    return (
                                        <KeyBindField
                                            key={key}
                                            label={properties.label}
                                            keys={
                                                extension.installed && properties.extensionOverridden
                                                    ? extension.extensionCommands[keyBindName] ?? ''
                                                    : keyBindSet[keyBindName].keys
                                            }
                                            extensionOverridden={extension.installed && properties.extensionOverridden}
                                            onKeysChange={(keys) => handleKeysChange(keys, keyBindName)}
                                            onOpenExtensionShortcuts={() => extension.openShortcuts()}
                                        />
                                    );
                                })}
                            </FormGroup>
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
