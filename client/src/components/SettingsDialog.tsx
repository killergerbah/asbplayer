import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { makeStyles } from '@material-ui/styles';
import AddIcon from '@material-ui/icons/Add';
import Button from '@material-ui/core/Button';
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
import {
    Anki,
    AsbplayerSettings,
    AutoPausePreference,
    KeyBindSet,
    KeyBindName,
    supportedLanguages,
    computeStyles,
    CustomStyle,
} from '@project/common';
import { TagsTextField } from '@project/common/components';
import hotkeys from 'hotkeys-js';
import Typography from '@material-ui/core/Typography';
import ChromeExtension from '../services/chrome-extension';
import { isMacOs } from 'react-device-detect';
import Switch from '@material-ui/core/Switch';
import RadioGroup from '@material-ui/core/RadioGroup';
import Tooltip from '@material-ui/core/Tooltip';
import { useOutsideClickListener } from '../hooks/use-outside-click-listener';
import Autocomplete from '@material-ui/lab/Autocomplete';

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
    switchLabel: {
        justifyContent: 'space-between',
        marginLeft: 0,
    },
    verticallyCentered: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
}));

const useSelectableSettingStyles = makeStyles<Theme>((theme) => ({
    formControl: {
        marginLeft: theme.spacing(1),
        marginBottom: theme.spacing(1),
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
                                <DeleteIcon fontSize="small" />
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
    const { t } = useTranslation();
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

    useOutsideClickListener(
        ref,
        useCallback(() => {
            if (editing) {
                setEditing(false);
                setCurrentKeyString('');
                onKeysChange('');
            }
        }, [editing, onKeysChange])
    );

    let placeholder: string;

    if (editing) {
        placeholder = t('settings.recordingBind');
    } else if (extensionOverridden) {
        placeholder = t('settings.extensionOverriddenBind');
    } else {
        placeholder = t('settings.unboundBind');
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
                    helperText={extensionOverridden ? t('settings.extensionShortcut') : undefined}
                    value={currentKeyString}
                    color="secondary"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton ref={ref} onClick={handleEditKeyBinding}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </Grid>
        </Grid>
    );
}

interface AddCustomFieldProps {
    onAddCustomField: (fieldName: string) => void;
}

function AddCustomField({ onAddCustomField }: AddCustomFieldProps) {
    const { t } = useTranslation();
    const [fieldName, setFieldName] = useState<string>('');

    return (
        <TextField
            label={t('settings.addCustomField')}
            fullWidth
            value={fieldName}
            color="secondary"
            onChange={(e) => setFieldName(e.target.value)}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        <IconButton
                            disabled={fieldName.trim() === ''}
                            onClick={() => {
                                onAddCustomField(fieldName.trim());
                                setFieldName('');
                            }}
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </InputAdornment>
                ),
            }}
        />
    );
}

interface AddCustomStyleProps {
    styleKey: string;
    onStyleKey: (styleKey: string) => void;
    onAddCustomStyle: (styleKey: string) => void;
}

function AddCustomStyle({ styleKey, onStyleKey, onAddCustomStyle }: AddCustomStyleProps) {
    const { t } = useTranslation();
    return (
        <Autocomplete
            options={cssStyles}
            value={styleKey}
            fullWidth
            disableClearable
            clearOnEscape
            clearOnBlur
            forcePopupIcon={false}
            onReset={() => onStyleKey('')}
            onChange={(event, newValue) => {
                onStyleKey(newValue ?? '');
            }}
            renderInput={(params) => (
                <TextField
                    placeholder={t('settings.styleKey')!}
                    label={t('settings.addCustomCss')}
                    {...params}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    disabled={cssStyles.find((s) => s === styleKey) === undefined}
                                    onClick={() => {
                                        onAddCustomStyle(styleKey);
                                        onStyleKey(cssStyles[0]);
                                    }}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            )}
        />
    );
}

interface CustomStyleSettingProps {
    customStyle: CustomStyle;
    onCustomStyle: (style: CustomStyle) => void;
    onDelete: () => void;
}

function CustomStyleSetting({ customStyle, onCustomStyle, onDelete }: CustomStyleSettingProps) {
    const { t } = useTranslation();

    return (
        <TextField
            label={t('settings.customCssField', { styleKey: customStyle.key })}
            placeholder={t('settings.styleValue')!}
            value={customStyle.value}
            onChange={(e) => onCustomStyle({ key: customStyle.key, value: e.target.value })}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        <IconButton onClick={onDelete}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </InputAdornment>
                ),
            }}
        />
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

const cssStyles = Object.keys(document.body.style);

export default function SettingsDialog({ anki, extension, open, settings, scrollToId, onClose }: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    const keyBindProperties = useMemo<{ [key in KeyBindName]: KeyBindProperties }>(
        () => ({
            copySubtitle: { label: t('binds.copySubtitle')!, extensionOverridden: true },
            ankiExport: { label: t('binds.ankiExport')!, extensionOverridden: true },
            updateLastCard: {
                label: t('binds.updateLastCard')!,
                extensionOverridden: true,
            },
            takeScreenshot: {
                label: t('binds.takeScreenshot')!,
                extensionOverridden: true,
            },
            togglePlay: { label: t('binds.togglePlay')!, extensionOverridden: false },
            toggleAutoPause: { label: t('binds.toggleAutoPause')!, extensionOverridden: false },
            toggleCondensedPlayback: { label: t('binds.toggleCondensedPlayback')!, extensionOverridden: false },
            toggleSubtitles: { label: t('binds.toggleSubtitles')!, extensionOverridden: false },
            toggleVideoSubtitleTrack1: { label: t('binds.toggleVideoSubtitleTrack1')!, extensionOverridden: false },
            toggleVideoSubtitleTrack2: { label: t('binds.toggleVideoSubtitleTrack2')!, extensionOverridden: false },
            toggleAsbplayerSubtitleTrack1: {
                label: t('binds.toggleAsbplayerSubtitleTrack1')!,
                extensionOverridden: false,
            },
            toggleAsbplayerSubtitleTrack2: {
                label: t('binds.toggleAsbplayerSubtitleTrack2')!,
                extensionOverridden: false,
            },
            seekBackward: { label: t('binds.seekBackward')!, extensionOverridden: false },
            seekForward: { label: t('binds.seekForward')!, extensionOverridden: false },
            seekToPreviousSubtitle: { label: t('binds.seekToPreviousSubtitle')!, extensionOverridden: false },
            seekToNextSubtitle: { label: t('binds.seekToNextSubtitle')!, extensionOverridden: false },
            seekToBeginningOfCurrentSubtitle: {
                label: t('binds.seekToBeginningOfCurrentSubtitle')!,
                extensionOverridden: false,
            },
            adjustOffsetToPreviousSubtitle: {
                label: t('binds.adjustOffsetToPreviousSubtitle')!,
                extensionOverridden: false,
            },
            adjustOffsetToNextSubtitle: {
                label: t('binds.adjustOffsetToNextSubtitle')!,
                extensionOverridden: false,
            },
            increaseOffset: { label: t('binds.increaseOffset')!, extensionOverridden: false },
            decreaseOffset: { label: t('binds.decreaseOffset')!, extensionOverridden: false },
            resetOffset: { label: t('binds.resetOffset')!, extensionOverridden: false },
            increasePlaybackRate: { label: t('binds.increasePlaybackRate')!, extensionOverridden: false },
            decreasePlaybackRate: { label: t('binds.decreasePlaybackRate')!, extensionOverridden: false },
        }),
        [t]
    );
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
    const [subtitleCustomStyles, setSubtitleCustomStyles] = useState<CustomStyle[]>(settings.subtitleCustomStyles);
    const [currentStyleKey, setCurrentStyleKey] = useState<string>(cssStyles[0]);
    const [preCacheSubtitleDom, setPreCacheSubtitleDom] = useState<boolean>(settings.preCacheSubtitleDom);

    const [imageBasedSubtitleScaleFactor, setImageBasedSubtitleScaleFactor] = useState<number>(
        settings.imageBasedSubtitleScaleFactor
    );
    const [subtitlePreview, setSubtitlePreview] = useState<string>(settings.subtitlePreview);
    const [themeType, setThemeType] = useState<'dark' | 'light'>(settings.themeType);
    const [copyToClipboardOnMine, setCopyToClipboardOnMine] = useState<boolean>(settings.copyToClipboardOnMine);
    const [autoPausePreference, setAutoPausePreference] = useState<AutoPausePreference>(settings.autoPausePreference);
    const [keyBindSet, setKeyBindSet] = useState<KeyBindSet>(settings.keyBindSet);
    const [rememberSubtitleOffset, setRememberSubtitleOffset] = useState<boolean>(settings.rememberSubtitleOffset);
    const [miningHistoryStorageLimit, setMiningHistoryStorageLimit] = useState<number>(
        settings.miningHistoryStorageLimit
    );
    const [autoCopyCurrentSubtitle, setAutoCopyCurrentSubtitle] = useState<boolean>(settings.autoCopyCurrentSubtitle);
    const [subtitleRegexFilter, setSubtitleRegexFilter] = useState<string>(settings.subtitleRegexFilter);
    const [subtitleRegexFilterTextReplacement, setSubtitleRegexFilterTextReplacement] = useState<string>(
        settings.subtitleRegexFilterTextReplacement
    );
    const [language, setLanguage] = useState<string>(settings.language);

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
    const handleAddCustomStyle = useCallback((styleKey: string) => {
        setSubtitleCustomStyles((styles) => [...styles, { key: styleKey, value: '' }]);
    }, []);
    const handlePreCacheSubtitleDomChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => setPreCacheSubtitleDom(e.target.checked),
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
    const handleMiningHistoryStorageLimit = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => setMiningHistoryStorageLimit(Number(e.target.value)),
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
    const handleLanguage = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setLanguage(e.target.value as string),
        []
    );

    const subtitlePreviewStyles = useMemo(
        () =>
            computeStyles({
                subtitleColor,
                subtitleSize,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleBackgroundOpacity,
                subtitleBackgroundColor,
                subtitleFontFamily,
                subtitleCustomStyles,
            }),
        [
            subtitleColor,
            subtitleSize,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleBackgroundOpacity,
            subtitleBackgroundColor,
            subtitleFontFamily,
            subtitleCustomStyles,
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
            subtitleCustomStyles: subtitleCustomStyles,
            preCacheSubtitleDom: preCacheSubtitleDom,
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
            miningHistoryStorageLimit: miningHistoryStorageLimit,
            subtitleRegexFilter: subtitleRegexFilter,
            subtitleRegexFilterTextReplacement: subtitleRegexFilterTextReplacement,
            language: language,
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
        subtitleCustomStyles,
        preCacheSubtitleDom,
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
        miningHistoryStorageLimit,
        subtitleRegexFilter,
        subtitleRegexFilterTextReplacement,
        language,
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
    const origin = `${window.location.protocol}//${window.location.hostname}`;
    return (
        <React.Fragment>
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <DialogTitle>{t('settings.title')}</DialogTitle>
                <DialogContent>
                    <Grid container direction="column" spacing={3}>
                        <Grid item id="anki-settings">
                            <FormLabel>{t('settings.anki')}</FormLabel>
                            <FormGroup className={classes.root}>
                                <TextField
                                    label={t('settings.ankiConnectUrl')}
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
                                    <Trans
                                        i18nKey={'settings.corsHelperText'}
                                        values={{ origin }}
                                        components={[
                                            <Link
                                                color="secondary"
                                                target="_blank"
                                                rel="noreferrer"
                                                href="https://youtu.be/Mv7fEVb6PHo?t=44"
                                            >
                                                video
                                            </Link>,
                                        ]}
                                    ></Trans>
                                </FormHelperText>
                                <SelectableSetting
                                    label={t('settings.deck')}
                                    value={deck}
                                    selections={deckNames}
                                    onChange={handleDeckChange}
                                    onSelectionChange={handleDeckSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.noteType')}
                                    value={noteType}
                                    selections={modelNames}
                                    onChange={handleNoteTypeChange}
                                    onSelectionChange={handleNoteTypeSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.sentenceField')}
                                    value={sentenceField}
                                    selections={fieldNames}
                                    onChange={handleSentenceFieldChange}
                                    onSelectionChange={handleSentenceFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.definitionField')}
                                    value={definitionField}
                                    selections={fieldNames}
                                    onChange={handleDefinitionFieldChange}
                                    onSelectionChange={handleDefinitionFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.wordField')}
                                    value={wordField}
                                    selections={fieldNames}
                                    onChange={handleWordFieldChange}
                                    onSelectionChange={handleWordFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.audioField')}
                                    value={audioField}
                                    selections={fieldNames}
                                    onChange={handleAudioFieldChange}
                                    onSelectionChange={handleAudioFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.imageField')}
                                    value={imageField}
                                    selections={fieldNames}
                                    onChange={handleImageFieldChange}
                                    onSelectionChange={handleImageFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.sourceField')}
                                    value={sourceField}
                                    selections={fieldNames}
                                    onChange={handleSourceFieldChange}
                                    onSelectionChange={handleSourceFieldSelectionChange}
                                />
                                <SelectableSetting
                                    label={t('settings.urlField')}
                                    value={urlField}
                                    selections={fieldNames}
                                    onChange={handleUrlFieldChange}
                                    onSelectionChange={handleUrlFieldSelectionChange}
                                />
                                {customFieldInputs}
                                <AddCustomField onAddCustomField={handleAddCustomField} />
                                <TagsTextField
                                    label={t('settings.tags')}
                                    helperText={t('settings.tagsHelperText')}
                                    fullWidth
                                    color="secondary"
                                    tags={tags}
                                    onTagsChange={handleTagsChange}
                                />
                            </FormGroup>
                        </Grid>
                        <Grid item id="mining-settings">
                            <FormLabel>{t('settings.mining')}</FormLabel>
                            <FormGroup className={classes.root}>
                                <FormControlLabel
                                    control={<Switch checked={preferMp3} onChange={handlePreferMp3Change} />}
                                    label={t('settings.mp3Preference')}
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
                                    label={t('settings.copyOnMine')}
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                                <TextField
                                    type="number"
                                    label={t('settings.audioPaddingStart')}
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
                                    label={t('settings.audioPaddingEnd')}
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
                                    label={t('settings.maxImageWidth')}
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
                                    label={t('settings.maxImageHeight')}
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
                                    label={t('settings.surroundingSubtitlesCountRadius')}
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
                                    label={t('settings.surroundingSubtitlesTimeRadius')}
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
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={preCacheSubtitleDom}
                                            onChange={handlePreCacheSubtitleDomChange}
                                        />
                                    }
                                    label={
                                        <Grid container direction="row" spacing={1}>
                                            <Grid item className={classes.verticallyCentered}>
                                                {t('settings.preCacheSubtitleDom')}
                                            </Grid>
                                            <Grid item className={classes.verticallyCentered}>
                                                <Tooltip
                                                    title={t('settings.preCacheSubtitleDomHelperText')!}
                                                    placement="top"
                                                >
                                                    <InfoIcon />
                                                </Tooltip>
                                            </Grid>
                                        </Grid>
                                    }
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                            </FormGroup>
                        </Grid>
                        <Grid item id="misc-settings">
                            <FormLabel>{t('settings.misc')}</FormLabel>
                            <FormGroup className={classes.root}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={rememberSubtitleOffset}
                                            onChange={handleRememberSubtitleOffsetChange}
                                        />
                                    }
                                    label={t('settings.rememberSubtitleOffset')}
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
                                    label={t('settings.autoCopy')}
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                                <TextField
                                    type="number"
                                    label={t('settings.miningHistoryStorageLimit')}
                                    fullWidth
                                    value={miningHistoryStorageLimit}
                                    color="secondary"
                                    onChange={handleMiningHistoryStorageLimit}
                                    inputProps={{
                                        min: 0,
                                        step: 1,
                                    }}
                                />
                                <TextField
                                    label={t('settings.subtitleRegexFilter')}
                                    fullWidth
                                    value={subtitleRegexFilter}
                                    color="secondary"
                                    error={!validRegex}
                                    helperText={validRegex ? undefined : 'Invalid regular expression'}
                                    onChange={handleSubtitleRegexFilter}
                                />
                                <TextField
                                    label={t('settings.subtitleRegexFilterTextReplacement')}
                                    fullWidth
                                    value={subtitleRegexFilterTextReplacement}
                                    color="secondary"
                                    onChange={handleSubtitleRegexFilterTextReplacement}
                                />
                                <TextField
                                    select
                                    label={t('settings.language')}
                                    value={language}
                                    color="secondary"
                                    onChange={handleLanguage}
                                >
                                    {supportedLanguages.map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {s}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </FormGroup>
                        </Grid>
                        <Grid item id="auto-pause-settings">
                            <Grid container direction="row" spacing={1}>
                                <Grid item>
                                    <FormLabel>{t('settings.autoPausePreference')}</FormLabel>
                                </Grid>
                                <Grid item>
                                    <Tooltip title={t('settings.autoPausePreferenceHelperText')!} placement="top">
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
                                    label={t('settings.autoPauseAtSubtitleStart')}
                                />
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={autoPausePreference === AutoPausePreference.atEnd}
                                            value={AutoPausePreference.atEnd}
                                            onChange={handleAutoPausePreferenceChange}
                                        />
                                    }
                                    label={t('settings.autoPauseAtSubtitleEnd')}
                                />
                            </RadioGroup>
                        </Grid>
                        <Grid item id="video-subtitle-appearance">
                            <FormLabel>{t('settings.subtitleAppearance')}</FormLabel>
                            <FormGroup className={classes.root}>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="color"
                                        label={t('settings.subtitleColor')}
                                        fullWidth
                                        value={subtitleColor}
                                        color="secondary"
                                        onChange={handleSubtitleColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label={t('settings.subtitleSize')}
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
                                        label={t('settings.subtitleOutlineColor')}
                                        fullWidth
                                        value={subtitleOutlineColor}
                                        color="secondary"
                                        onChange={handleSubtitleOutlineColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label={t('settings.subtitleOutlineThickness')}
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
                                        label={t('settings.subtitleBackgroundColor')}
                                        fullWidth
                                        value={subtitleBackgroundColor}
                                        color="secondary"
                                        onChange={handleSubtitleBackgroundColorChange}
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label={t('settings.subtitleBackgroundOpacity')}
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
                                        label={t('settings.subtitleFontFamily')}
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
                                        label={t('settings.imageBasedSubtitleScaleFactor')}
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
                                {subtitleCustomStyles.map((customStyle, index) => {
                                    return (
                                        <CustomStyleSetting
                                            key={index}
                                            customStyle={customStyle}
                                            onCustomStyle={(newCustomStyle: CustomStyle) => {
                                                setSubtitleCustomStyles((existingValue) => {
                                                    const newValue = [...existingValue];
                                                    newValue[index] = { ...newCustomStyle };
                                                    return newValue;
                                                });
                                            }}
                                            onDelete={() => {
                                                setSubtitleCustomStyles((existingValue) => {
                                                    const newValue = [];
                                                    for (let j = 0; j < existingValue.length; ++j) {
                                                        if (j !== index) {
                                                            newValue.push(existingValue[j]);
                                                        }
                                                    }
                                                    return newValue;
                                                });
                                            }}
                                        />
                                    );
                                })}
                                <AddCustomStyle
                                    styleKey={currentStyleKey}
                                    onStyleKey={setCurrentStyleKey}
                                    onAddCustomStyle={handleAddCustomStyle}
                                />
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
                            <FormLabel>{t('settings.theme')}</FormLabel>
                            <div>
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={themeType === 'light'}
                                            value="light"
                                            onChange={handleThemeTypeChange}
                                        />
                                    }
                                    label={t('settings.themeLight')}
                                />
                                <FormControlLabel
                                    control={
                                        <Radio
                                            checked={themeType === 'dark'}
                                            value="dark"
                                            onChange={handleThemeTypeChange}
                                        />
                                    }
                                    label={t('settings.themeDark')}
                                />
                            </div>
                        </Grid>
                        <Grid item id="keyboard-shortcuts">
                            <FormLabel>{t('settings.keyboardShortcuts')}</FormLabel>
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
                                            onOpenExtensionShortcuts={extension.openShortcuts}
                                        />
                                    );
                                })}
                            </FormGroup>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>{t('action.ok')}</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}
