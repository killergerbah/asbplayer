import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles } from '@material-ui/styles';
import AddIcon from '@material-ui/icons/Add';
import Box from '@material-ui/core/Box';
import EditIcon from '@material-ui/icons/Edit';
import InfoIcon from '@material-ui/icons/Info';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
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
    KeyBindName,
    supportedLanguages,
    computeStyles,
    CustomStyle,
    SubtitleListPreference,
} from '@project/common';
import { TagsTextField } from '@project/common/components';
import hotkeys from 'hotkeys-js';
import Typography from '@material-ui/core/Typography';
import { isMacOs } from 'react-device-detect';
import Switch from '@material-ui/core/Switch';
import RadioGroup from '@material-ui/core/RadioGroup';
import Tooltip from '@material-ui/core/Tooltip';
import { useOutsideClickListener } from '../../app/src/hooks/use-outside-click-listener';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Slider from '@material-ui/core/Slider';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';

const useStyles = makeStyles<Theme>((theme) => ({
    root: {
        flexGrow: 1,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        maxHeight: '100%',
        height: '100%',
    },
    tabs: {
        minWidth: 120,
        width: 120,
        '& .MuiButtonBase-root': {
            paddingLeft: 0,
            paddingRight: theme.spacing(1),
        },
        '& .MuiTab-root': {
            minWidth: 120,
        },
    },
    formGroup: {
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
    boundViaChrome: boolean;
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
    boundViaChrome: boolean;
    onKeysChange: (keys: string) => void;
    onOpenExtensionShortcuts: () => void;
}

function KeyBindField({
    label,
    keys,
    boundViaChrome: extensionOverridden,
    onKeysChange,
    onOpenExtensionShortcuts,
}: KeyBindFieldProps) {
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
                    color="secondary"
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
            color="secondary"
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

const usePanelStyles = makeStyles<Theme>((theme) => ({
    panel: {
        paddingLeft: theme.spacing(3),
        paddingRight: theme.spacing(1),
        overflowY: 'scroll',
        maxHeight: '100%',
        height: '100%',
        width: '100%',
    },
}));

interface TabPanelProps {
    children?: React.ReactNode;
    index: any;
    value: any;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
    const classes = usePanelStyles();
    return (
        <Box className={classes.panel} hidden={value !== index} {...other}>
            {value === index && children}
        </Box>
    );
}

type TabName =
    | 'anki-settings'
    | 'mining-settings'
    | 'subtitle-appearance'
    | 'keyboard-shortcuts'
    | 'streaming-video'
    | 'misc-settings';
const tabIndicesById = {
    'anki-settings': 0,
    'mining-settings': 1,
    'subtitle-appearance': 2,
    'keyboard-shortcuts': 3,
    'streaming-video': 4,
    'misc-settings': 5,
};

interface Props {
    anki: Anki;
    open: boolean;
    insideExtension: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    chromeKeyBinds: { [key: string]: string | undefined };
    onSettingsChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => void;
    onOpenChromeExtensionShortcuts: () => void;
}

const cssStyles = Object.keys(document.body.style);

export default function SettingsForm({
    anki,
    settings,
    insideExtension,
    scrollToId,
    chromeKeyBinds,
    onSettingsChanged,
    onOpenChromeExtensionShortcuts,
}: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    const keyBindProperties = useMemo<{ [key in KeyBindName]: KeyBindProperties }>(
        () => ({
            copySubtitle: { label: t('binds.copySubtitle')!, boundViaChrome: true },
            ankiExport: { label: t('binds.ankiExport')!, boundViaChrome: true },
            updateLastCard: {
                label: t('binds.updateLastCard')!,
                boundViaChrome: true,
            },
            takeScreenshot: {
                label: t('binds.takeScreenshot')!,
                boundViaChrome: true,
            },
            togglePlay: { label: t('binds.togglePlay')!, boundViaChrome: false },
            toggleAutoPause: { label: t('binds.toggleAutoPause')!, boundViaChrome: false },
            toggleCondensedPlayback: { label: t('binds.toggleCondensedPlayback')!, boundViaChrome: false },
            toggleSubtitles: { label: t('binds.toggleSubtitles')!, boundViaChrome: false },
            toggleVideoSubtitleTrack1: { label: t('binds.toggleVideoSubtitleTrack1')!, boundViaChrome: false },
            toggleVideoSubtitleTrack2: { label: t('binds.toggleVideoSubtitleTrack2')!, boundViaChrome: false },
            toggleAsbplayerSubtitleTrack1: {
                label: t('binds.toggleAsbplayerSubtitleTrack1')!,
                boundViaChrome: false,
            },
            toggleAsbplayerSubtitleTrack2: {
                label: t('binds.toggleAsbplayerSubtitleTrack2')!,
                boundViaChrome: false,
            },
            seekBackward: { label: t('binds.seekBackward')!, boundViaChrome: false },
            seekForward: { label: t('binds.seekForward')!, boundViaChrome: false },
            seekToPreviousSubtitle: { label: t('binds.seekToPreviousSubtitle')!, boundViaChrome: false },
            seekToNextSubtitle: { label: t('binds.seekToNextSubtitle')!, boundViaChrome: false },
            seekToBeginningOfCurrentSubtitle: {
                label: t('binds.seekToBeginningOfCurrentSubtitle')!,
                boundViaChrome: false,
            },
            adjustOffsetToPreviousSubtitle: {
                label: t('binds.adjustOffsetToPreviousSubtitle')!,
                boundViaChrome: false,
            },
            adjustOffsetToNextSubtitle: {
                label: t('binds.adjustOffsetToNextSubtitle')!,
                boundViaChrome: false,
            },
            increaseOffset: { label: t('binds.increaseOffset')!, boundViaChrome: false },
            decreaseOffset: { label: t('binds.decreaseOffset')!, boundViaChrome: false },
            resetOffset: { label: t('binds.resetOffset')!, boundViaChrome: false },
            increasePlaybackRate: { label: t('binds.increasePlaybackRate')!, boundViaChrome: false },
            decreasePlaybackRate: { label: t('binds.decreasePlaybackRate')!, boundViaChrome: false },
        }),
        [t]
    );

    const {
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
        subtitleSize,
        subtitleColor,
        subtitleThickness,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitlePreview,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        autoPausePreference,
        keyBindSet,
        preferMp3,
        miningHistoryStorageLimit,
        preCacheSubtitleDom,
        themeType,
        copyToClipboardOnMine,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        subtitleRegexFilter,
        subtitleRegexFilterTextReplacement,
        language,
        customAnkiFields,
        tags,
        imageBasedSubtitleScaleFactor,
        subtitleCustomStyles,
        streamingDisplaySubtitles,
        streamingRecordMedia,
        streamingTakeScreenshot,
        streamingCleanScreenshot,
        streamingCropScreenshot,
        streamingSubsDragAndDrop,
        streamingAutoSync,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
        streamingSubtitlePositionOffset,
        streamingScreenshotDelay,
        streamingSubtitleAlignment,
        streamingSubtitleListPreference,
    } = settings;
    const handleAddCustomField = useCallback(
        (customFieldName: string) => {
            onSettingsChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: '' });
        },
        [settings.customAnkiFields, onSettingsChanged]
    );
    const handleCustomFieldChange = useCallback(
        (customFieldName: string, value: string) => {
            onSettingsChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: value });
        },
        [settings.customAnkiFields, onSettingsChanged]
    );
    const handleCustomFieldRemoval = useCallback(
        (customFieldName: string) => {
            const newCustomFields = { ...settings.customAnkiFields };
            delete newCustomFields[customFieldName];
            onSettingsChanged('customAnkiFields', newCustomFields);
        },
        [onSettingsChanged]
    );
    const handleKeysChange = useCallback(
        (keys: string, keyBindName: KeyBindName) => {
            onSettingsChanged('keyBindSet', { ...settings.keyBindSet, [keyBindName]: { keys } });
        },
        [settings.keyBindSet, onSettingsChanged]
    );

    const subtitlePreviewStyles = useMemo(
        () =>
            computeStyles({
                subtitleColor,
                subtitleSize,
                subtitleThickness,
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
            subtitleThickness,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleBackgroundOpacity,
            subtitleBackgroundColor,
            subtitleFontFamily,
            subtitleCustomStyles,
        ]
    );

    const [deckNames, setDeckNames] = useState<string[]>();
    const [modelNames, setModelNames] = useState<string[]>();
    const [ankiConnectUrlError, setAnkiConnectUrlError] = useState<string>();
    const [fieldNames, setFieldNames] = useState<string[]>();
    const [currentStyleKey, setCurrentStyleKey] = useState<string>(cssStyles[0]);

    const requestAnkiConnect = useCallback(async () => {
        try {
            await anki.requestPermission(ankiConnectUrl);
            setDeckNames(await anki.deckNames(ankiConnectUrl));
            setModelNames(await anki.modelNames(ankiConnectUrl));
            setAnkiConnectUrlError(undefined);
        } catch (e) {
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
    }, [anki, ankiConnectUrl]);

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            if (canceled) {
                return;
            }

            requestAnkiConnect();
        }, 1000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [anki, ankiConnectUrl, requestAnkiConnect]);

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
    }, [anki, noteType, ankiConnectUrl, ankiConnectUrlError]);

    const customFieldInputs = Object.keys(customAnkiFields).map((customFieldName) => {
        return (
            <SelectableSetting
                key={customFieldName}
                label={`${customFieldName} Field`}
                value={customAnkiFields[customFieldName]}
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

        if (scrollToId in tabIndicesById) {
            setTabIndex(tabIndicesById[scrollToId as TabName]);
        }
    }, [scrollToId]);

    const [tabIndex, setTabIndex] = useState<number>(0);

    const validRegex = regexIsValid(subtitleRegexFilter);

    return (
        <div className={classes.root}>
            <Tabs
                orientation="vertical"
                variant="scrollable"
                value={tabIndex}
                className={classes.tabs}
                onChange={(event, index) => setTabIndex(index)}
            >
                <Tab tabIndex={0} label={t('settings.anki')} id="anki-settings" />
                <Tab tabIndex={1} label={t('settings.mining')} id="mining-settings" />
                <Tab tabIndex={2} label={t('settings.subtitleAppearance')} id="subtitle-appearance" />
                <Tab tabIndex={3} label={t('settings.keyboardShortcuts')} id="keyboard-shortcuts" />
                {insideExtension && <Tab tabIndex={4} label={t('settings.streamingVideo')} id="streaming-video" />}
                <Tab tabIndex={5} label={t('settings.misc')} id="misc-settings" />
            </Tabs>
            <TabPanel value={tabIndex} index={tabIndicesById['anki-settings']}>
                <FormGroup className={classes.formGroup}>
                    <TextField
                        label={t('settings.ankiConnectUrl')}
                        value={ankiConnectUrl}
                        error={Boolean(ankiConnectUrlError)}
                        helperText={ankiConnectUrlError}
                        color="secondary"
                        onChange={(event) => onSettingsChanged('ankiConnectUrl', event.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={requestAnkiConnect}>
                                        <RefreshIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <SelectableSetting
                        label={t('settings.deck')}
                        value={deck}
                        selections={deckNames}
                        onChange={(event) => onSettingsChanged('deck', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('deck', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.noteType')}
                        value={noteType}
                        selections={modelNames}
                        onChange={(event) => onSettingsChanged('noteType', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('noteType', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.sentenceField')}
                        value={sentenceField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('sentenceField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('sentenceField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.definitionField')}
                        value={definitionField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('definitionField', event.target.value)}
                        onSelectionChange={(event) =>
                            onSettingsChanged('definitionField', event.target.value as string)
                        }
                    />
                    <SelectableSetting
                        label={t('settings.wordField')}
                        value={wordField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('wordField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('wordField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.audioField')}
                        value={audioField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('audioField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('audioField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.imageField')}
                        value={imageField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('imageField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('imageField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.sourceField')}
                        value={sourceField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('sourceField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('sourceField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.urlField')}
                        value={urlField}
                        selections={fieldNames}
                        onChange={(event) => onSettingsChanged('urlField', event.target.value)}
                        onSelectionChange={(event) => onSettingsChanged('urlField', event.target.value as string)}
                    />
                    {customFieldInputs}
                    <AddCustomField onAddCustomField={handleAddCustomField} />
                    <TagsTextField
                        label={t('settings.tags')}
                        helperText={t('settings.tagsHelperText')}
                        fullWidth
                        color="secondary"
                        tags={tags}
                        onTagsChange={(tags) => onSettingsChanged('tags', tags)}
                    />
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['mining-settings']}>
                <FormGroup className={classes.formGroup}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={preferMp3}
                                onChange={(event) => onSettingsChanged('preferMp3', event.target.checked)}
                            />
                        }
                        label={t('settings.mp3Preference')}
                        labelPlacement="start"
                        className={classes.switchLabel}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={copyToClipboardOnMine}
                                onChange={(event) => onSettingsChanged('copyToClipboardOnMine', event.target.checked)}
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
                        onChange={(event) => onSettingsChanged('audioPaddingStart', Number(event.target.value))}
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
                        onChange={(event) => onSettingsChanged('audioPaddingEnd', Number(event.target.value))}
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
                        onChange={(event) => onSettingsChanged('maxImageWidth', Number(event.target.value))}
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
                        onChange={(event) => onSettingsChanged('maxImageHeight', Number(event.target.value))}
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
                        onChange={(event) =>
                            onSettingsChanged('surroundingSubtitlesCountRadius', Number(event.target.value))
                        }
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
                        onChange={(event) =>
                            onSettingsChanged('surroundingSubtitlesTimeRadius', Number(event.target.value))
                        }
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
                                onChange={(event) => onSettingsChanged('preCacheSubtitleDom', event.target.checked)}
                            />
                        }
                        label={
                            <Grid container direction="row" spacing={1}>
                                <Grid item className={classes.verticallyCentered}>
                                    {t('settings.preCacheSubtitleDom')}
                                </Grid>
                                <Grid item className={classes.verticallyCentered}>
                                    <Tooltip title={t('settings.preCacheSubtitleDomHelperText')!} placement="top">
                                        <InfoIcon />
                                    </Tooltip>
                                </Grid>
                            </Grid>
                        }
                        labelPlacement="start"
                        className={classes.switchLabel}
                    />
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['subtitle-appearance']}>
                <Grid item>
                    <FormGroup className={classes.formGroup}>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="color"
                                label={t('settings.subtitleColor')}
                                fullWidth
                                value={subtitleColor}
                                color="secondary"
                                onChange={(event) => onSettingsChanged('subtitleColor', event.target.value)}
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="number"
                                label={t('settings.subtitleSize')}
                                fullWidth
                                value={subtitleSize}
                                color="secondary"
                                onChange={(event) => onSettingsChanged('subtitleSize', Number(event.target.value))}
                                inputProps={{
                                    min: 1,
                                    step: 1,
                                }}
                            />
                        </div>
                        <div>
                            <Typography variant="subtitle2" color="textSecondary">
                                {t('settings.subtitleThickness')}
                            </Typography>
                            <Slider
                                color="secondary"
                                value={subtitleThickness}
                                onChange={(event, value) => onSettingsChanged('subtitleThickness', value as number)}
                                min={100}
                                max={900}
                                step={100}
                                marks
                                valueLabelDisplay="auto"
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="color"
                                label={t('settings.subtitleOutlineColor')}
                                fullWidth
                                value={subtitleOutlineColor}
                                color="secondary"
                                onChange={(event) => onSettingsChanged('subtitleOutlineColor', event.target.value)}
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="number"
                                label={t('settings.subtitleOutlineThickness')}
                                helperText={t('settings.subtitleOutlineThicknessHelperText')}
                                fullWidth
                                value={subtitleOutlineThickness}
                                onChange={(event) =>
                                    onSettingsChanged('subtitleOutlineThickness', Number(event.target.value))
                                }
                                inputProps={{
                                    min: 0,
                                    step: 0.1,
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
                                onChange={(event) => onSettingsChanged('subtitleBackgroundColor', event.target.value)}
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
                                onChange={(event) =>
                                    onSettingsChanged('subtitleBackgroundOpacity', Number(event.target.value))
                                }
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
                                onChange={(event) => onSettingsChanged('subtitleFontFamily', event.target.value)}
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
                                onChange={(event) =>
                                    onSettingsChanged('imageBasedSubtitleScaleFactor', Number(event.target.value))
                                }
                            />
                        </div>
                        {subtitleCustomStyles.map((customStyle, index) => {
                            return (
                                <CustomStyleSetting
                                    key={index}
                                    customStyle={customStyle}
                                    onCustomStyle={(newCustomStyle: CustomStyle) => {
                                        const newValue = [...settings.subtitleCustomStyles];
                                        newValue[index] = { ...newCustomStyle };
                                        onSettingsChanged('subtitleCustomStyles', newValue);
                                    }}
                                    onDelete={() => {
                                        const newValue: CustomStyle[] = [];
                                        for (let j = 0; j < settings.subtitleCustomStyles.length; ++j) {
                                            if (j !== index) {
                                                newValue.push(settings.subtitleCustomStyles[j]);
                                            }
                                        }
                                        onSettingsChanged('subtitleCustomStyles', newValue);
                                    }}
                                />
                            );
                        })}
                        <AddCustomStyle
                            styleKey={currentStyleKey}
                            onStyleKey={setCurrentStyleKey}
                            onAddCustomStyle={(styleKey) =>
                                onSettingsChanged('subtitleCustomStyles', [
                                    ...settings.subtitleCustomStyles,
                                    { key: styleKey, value: '' },
                                ])
                            }
                        />
                        <div className={classes.subtitlePreview}>
                            <input
                                value={subtitlePreview}
                                className={classes.subtitlePreviewInput}
                                onChange={(event) => onSettingsChanged('subtitlePreview', event.target.value)}
                                style={subtitlePreviewStyles}
                            />
                        </div>
                    </FormGroup>
                </Grid>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['keyboard-shortcuts']}>
                <FormGroup className={classes.formGroup}>
                    {Object.keys(keyBindProperties).map((key) => {
                        const keyBindName = key as KeyBindName;
                        const properties = keyBindProperties[keyBindName];
                        return (
                            <KeyBindField
                                key={key}
                                label={properties.label}
                                keys={
                                    insideExtension && properties.boundViaChrome
                                        ? chromeKeyBinds[keyBindName] ?? ''
                                        : keyBindSet[keyBindName].keys
                                }
                                boundViaChrome={insideExtension && properties.boundViaChrome}
                                onKeysChange={(keys) => handleKeysChange(keys, keyBindName)}
                                onOpenExtensionShortcuts={onOpenChromeExtensionShortcuts}
                            />
                        );
                    })}
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['streaming-video']}>
                <Grid container direction="column" spacing={1}>
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={
                                            streamingSubtitleListPreference !== SubtitleListPreference.noSubtitleList
                                        }
                                        onChange={(e) =>
                                            onSettingsChanged(
                                                'streamingSubtitleListPreference',
                                                streamingSubtitleListPreference ===
                                                    SubtitleListPreference.noSubtitleList
                                                    ? SubtitleListPreference.app
                                                    : SubtitleListPreference.noSubtitleList
                                            )
                                        }
                                    />
                                }
                                label={t('extension.settings.openSubtitleList')}
                                labelPlacement="start"
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingDisplaySubtitles}
                                        onChange={(e) =>
                                            onSettingsChanged('streamingDisplaySubtitles', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.displaySubtitles')}
                                labelPlacement="start"
                            />
                            <TextField
                                className={classes.textField}
                                type="number"
                                color="secondary"
                                fullWidth
                                label={t('extension.settings.subtitlePositionOffset')}
                                value={streamingSubtitlePositionOffset}
                                inputProps={{
                                    min: 0,
                                    step: 1,
                                }}
                                onChange={(e) =>
                                    onSettingsChanged('streamingSubtitlePositionOffset', Number(e.target.value))
                                }
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormLabel component="legend">{t('extension.settings.subtitleAlignment')}</FormLabel>
                        <RadioGroup row>
                            <FormControlLabel
                                control={
                                    <Radio
                                        checked={streamingSubtitleAlignment === 'bottom'}
                                        value={'bottom'}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            onSettingsChanged('streamingSubtitleAlignment', 'bottom')
                                        }
                                    />
                                }
                                label={t('extension.settings.subtitleAlignmentBottom')}
                            />
                            <FormControlLabel
                                control={
                                    <Radio
                                        checked={streamingSubtitleAlignment === 'top'}
                                        value={'top'}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            onSettingsChanged('streamingSubtitleAlignment', 'top')
                                        }
                                    />
                                }
                                label={t('extension.settings.subtitleAlignmentTop')}
                            />
                        </RadioGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup>
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingRecordMedia}
                                        onChange={(e) => onSettingsChanged('streamingRecordMedia', e.target.checked)}
                                    />
                                }
                                label={t('extension.settings.recordAudio')}
                                labelPlacement="start"
                            />
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingTakeScreenshot}
                                        onChange={(e) => onSettingsChanged('streamingTakeScreenshot', e.target.checked)}
                                    />
                                }
                                label={t('extension.settings.takeScreenshot')}
                                labelPlacement="start"
                            />
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingCleanScreenshot}
                                        onChange={(e) =>
                                            onSettingsChanged('streamingCleanScreenshot', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.cleanScreenshot')}
                                labelPlacement="start"
                            />
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingCropScreenshot}
                                        onChange={(e) => onSettingsChanged('streamingCropScreenshot', e.target.checked)}
                                    />
                                }
                                label={t('extension.settings.cropScreenshot')}
                                labelPlacement="start"
                            />
                            <TextField
                                className={classes.textField}
                                type="number"
                                color="secondary"
                                fullWidth
                                label={t('extension.settings.screenshotCaptureDelay')}
                                value={streamingScreenshotDelay}
                                onChange={(e) => onSettingsChanged('streamingScreenshotDelay', Number(e.target.value))}
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
                    <Grid item>
                        <FormGroup>
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingSubsDragAndDrop}
                                        onChange={(e) =>
                                            onSettingsChanged('streamingSubsDragAndDrop', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.dragAndDrop')}
                                labelPlacement="start"
                            />
                            <FormControlLabel
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingAutoSync}
                                        onChange={(e) => onSettingsChanged('streamingAutoSync', e.target.checked)}
                                    />
                                }
                                label={t('extension.settings.autoLoadDetectedSubs')}
                                labelPlacement="start"
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            <TextField
                                className={classes.textField}
                                type="number"
                                color="secondary"
                                fullWidth
                                label={t('extension.settings.condensedPlaybackMinSkipInterval')}
                                value={streamingCondensedPlaybackMinimumSkipIntervalMs}
                                onChange={(e) =>
                                    onSettingsChanged(
                                        'streamingCondensedPlaybackMinimumSkipIntervalMs',
                                        Number(e.target.value)
                                    )
                                }
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
                </Grid>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['misc-settings']}>
                <Grid container spacing={1} direction="column">
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={rememberSubtitleOffset}
                                        onChange={(event) =>
                                            onSettingsChanged('rememberSubtitleOffset', event.target.checked)
                                        }
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
                                        onChange={(event) =>
                                            onSettingsChanged('autoCopyCurrentSubtitle', event.target.checked)
                                        }
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
                                onChange={(event) =>
                                    onSettingsChanged('miningHistoryStorageLimit', Number(event.target.value))
                                }
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
                                onChange={(event) => onSettingsChanged('subtitleRegexFilter', event.target.value)}
                            />
                            <TextField
                                label={t('settings.subtitleRegexFilterTextReplacement')}
                                fullWidth
                                value={subtitleRegexFilterTextReplacement}
                                color="secondary"
                                onChange={(event) =>
                                    onSettingsChanged('subtitleRegexFilterTextReplacement', event.target.value)
                                }
                            />
                            <TextField
                                select
                                label={t('settings.language')}
                                value={language}
                                color="secondary"
                                onChange={(event) => onSettingsChanged('language', event.target.value)}
                            >
                                {supportedLanguages.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        {s}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </FormGroup>
                    </Grid>
                    <Grid item>
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
                                        onChange={(event) =>
                                            event.target.checked &&
                                            onSettingsChanged('autoPausePreference', AutoPausePreference.atStart)
                                        }
                                    />
                                }
                                label={t('settings.autoPauseAtSubtitleStart')}
                            />
                            <FormControlLabel
                                control={
                                    <Radio
                                        checked={autoPausePreference === AutoPausePreference.atEnd}
                                        value={AutoPausePreference.atEnd}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            onSettingsChanged('autoPausePreference', AutoPausePreference.atEnd)
                                        }
                                    />
                                }
                                label={t('settings.autoPauseAtSubtitleEnd')}
                            />
                        </RadioGroup>
                    </Grid>
                    <Grid item>
                        <FormLabel>{t('settings.theme')}</FormLabel>
                        <div>
                            <FormControlLabel
                                control={
                                    <Radio
                                        checked={themeType === 'light'}
                                        value="light"
                                        onChange={(event) =>
                                            event.target.checked && onSettingsChanged('themeType', 'light')
                                        }
                                    />
                                }
                                label={t('settings.themeLight')}
                            />
                            <FormControlLabel
                                control={
                                    <Radio
                                        checked={themeType === 'dark'}
                                        value="dark"
                                        onChange={(event) =>
                                            event.target.checked && onSettingsChanged('themeType', 'dark')
                                        }
                                    />
                                }
                                label={t('settings.themeDark')}
                            />
                        </div>
                    </Grid>
                </Grid>
            </TabPanel>
        </div>
    );
}
