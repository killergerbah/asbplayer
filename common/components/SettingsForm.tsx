import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { makeStyles } from '@material-ui/styles';
import AddIcon from '@material-ui/icons/Add';
import LockIcon from '@material-ui/icons/Lock';
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
import { AutoPausePreference, PostMineAction } from '@project/common';
import { AsbplayerSettings, KeyBindName, SubtitleListPreference } from '@project/common/settings';
import { computeStyles, download } from '@project/common/util';
import { CustomStyle, supportedLanguages, validateSettings } from '@project/common/settings';
import { useOutsideClickListener } from '@project/common/hooks';
import { styled } from '@material-ui/core';
import TagsTextField from '@project/common/components/TagsTextField';
import hotkeys from 'hotkeys-js';
import Typography from '@material-ui/core/Typography';
import { isMacOs } from 'react-device-detect';
import Switch from '@material-ui/core/Switch';
import RadioGroup from '@material-ui/core/RadioGroup';
import Tooltip from '@material-ui/core/Tooltip';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Slider from '@material-ui/core/Slider';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import FormHelperText from '@material-ui/core/FormHelperText';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';
import { Anki } from '../anki';

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
        marginRight: -8,
    },
    top: {
        marginTop: theme.spacing(1),
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

export const LabelWithHoverEffect = styled(FormControlLabel)(({ theme }) => ({
    '&:hover .MuiSwitch-thumb': {
        outline: `9px solid ${theme.palette.secondary.main}29`,
    },
    '&:hover .MuiRadio-colorSecondary': {
        background: `${theme.palette.secondary.main}29`,
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
                <Select
                    value={selections?.find((v) => v === value) === undefined ? '' : value}
                    disabled={!selections}
                    color="secondary"
                    onChange={onSelectionChange}
                >
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

type AllKeyNames = KeyBindName | 'toggleRecording' | 'selectSubtitleTrack';

interface KeyBindProperties {
    label: string;
    boundViaChrome: boolean;
    hide?: boolean;
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

interface Props {
    anki: Anki;
    extensionInstalled: boolean;
    extensionSupportsAppIntegration: boolean;
    insideApp?: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    chromeKeyBinds: { [key: string]: string | undefined };
    localFontsAvailable: boolean;
    localFontsPermission?: PermissionState;
    localFontFamilies: string[];
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenChromeExtensionShortcuts: () => void;
    onUnlockLocalFonts: () => void;
}

const cssStyles = Object.keys(document.body.style);

export default function SettingsForm({
    anki,
    settings,
    extensionInstalled,
    extensionSupportsAppIntegration,
    insideApp,
    scrollToId,
    chromeKeyBinds,
    localFontsAvailable,
    localFontsPermission,
    localFontFamilies,
    onSettingsChanged,
    onOpenChromeExtensionShortcuts,
    onUnlockLocalFonts,
}: Props) {
    const classes = useStyles();
    const handleSettingChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            onSettingsChanged({ [key]: value });
        },
        [onSettingsChanged]
    );
    const { t } = useTranslation();
    const keyBindProperties = useMemo<{ [key in AllKeyNames]: KeyBindProperties }>(
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
            toggleRecording: {
                label: t('binds.extensionToggleRecording')!,
                boundViaChrome: true,
                hide: !extensionInstalled,
            },
            selectSubtitleTrack: {
                label: t('binds.extensionSelectSubtitleTrack')!,
                boundViaChrome: true,
                hide: !extensionInstalled,
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
            toggleSidePanel: { label: t('binds.toggleSidePanel')!, boundViaChrome: false, hide: !extensionInstalled },
        }),
        [t, extensionInstalled]
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
        subtitleShadowThickness,
        subtitleShadowColor,
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
        clickToMineDefaultAction,
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
        streamingAppUrl,
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
            handleSettingChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: '' });
        },
        [settings.customAnkiFields, handleSettingChanged]
    );
    const handleCustomFieldChange = useCallback(
        (customFieldName: string, value: string) => {
            handleSettingChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: value });
        },
        [settings.customAnkiFields, handleSettingChanged]
    );
    const handleCustomFieldRemoval = useCallback(
        (customFieldName: string) => {
            const newCustomFields = { ...settings.customAnkiFields };
            delete newCustomFields[customFieldName];
            handleSettingChanged('customAnkiFields', newCustomFields);
        },
        [handleSettingChanged, settings.customAnkiFields]
    );
    const handleKeysChange = useCallback(
        (keys: string, keyBindName: KeyBindName) => {
            handleSettingChanged('keyBindSet', { ...settings.keyBindSet, [keyBindName]: { keys } });
        },
        [settings.keyBindSet, handleSettingChanged]
    );

    const subtitlePreviewStyles = useMemo(
        () =>
            computeStyles({
                subtitleColor,
                subtitleSize,
                subtitleThickness,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleShadowThickness,
                subtitleShadowColor,
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
            subtitleShadowThickness,
            subtitleShadowColor,
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

    const tabIndicesById = useMemo(() => {
        const tabs = [
            'anki-settings',
            'mining-settings',
            'subtitle-appearance',
            'keyboard-shortcuts',
            'streaming-video',
            'misc-settings',
        ];

        if (!extensionSupportsAppIntegration) {
            tabs.splice(tabs.indexOf('streaming-video'), 1);
        }

        return Object.fromEntries(tabs.map((tab, i) => [tab, i]));
    }, [extensionSupportsAppIntegration]);

    useEffect(() => {
        if (!scrollToId) {
            return;
        }

        if (scrollToId in tabIndicesById) {
            setTabIndex(tabIndicesById[scrollToId as TabName]);
        }
    }, [scrollToId, tabIndicesById]);

    const [tabIndex, setTabIndex] = useState<number>(0);
    const validRegex = useMemo(() => regexIsValid(subtitleRegexFilter), [subtitleRegexFilter]);
    const settingsFileInputRef = useRef<HTMLInputElement>(null);
    const handleSettingsFileInputChange = useCallback(async () => {
        try {
            const file = settingsFileInputRef.current?.files?.[0];

            if (file === undefined) {
                return;
            }

            const importedSettings = JSON.parse(await file.text());
            validateSettings(importedSettings);
            onSettingsChanged(importedSettings as AsbplayerSettings);
        } catch (e) {
            console.error(e);
        }
    }, [onSettingsChanged]);
    const handleImportSettings = useCallback(() => {
        settingsFileInputRef.current?.click();
    }, []);
    const handleExportSettings = useCallback(() => {
        download(new Blob([JSON.stringify(settings)], { type: 'appliction/json' }), 'asbplayer-settings.json');
    }, [settings]);

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
                {extensionSupportsAppIntegration && (
                    <Tab tabIndex={4} label={t('settings.streamingVideo')} id="streaming-video" />
                )}
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
                        onChange={(event) => handleSettingChanged('ankiConnectUrl', event.target.value)}
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
                    {insideApp && (
                        <FormHelperText>
                            <Trans
                                i18nKey={'settings.corsHelperText'}
                                values={{ origin }}
                                components={[
                                    <Link
                                        key={0}
                                        color="secondary"
                                        target="_blank"
                                        rel="noreferrer"
                                        href="https://youtu.be/Mv7fEVb6PHo?t=44"
                                    >
                                        video
                                    </Link>,
                                ]}
                            />
                        </FormHelperText>
                    )}
                    <SelectableSetting
                        label={t('settings.deck')}
                        value={deck}
                        selections={deckNames}
                        onChange={(event) => handleSettingChanged('deck', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('deck', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.noteType')}
                        value={noteType}
                        selections={modelNames}
                        onChange={(event) => handleSettingChanged('noteType', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('noteType', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.sentenceField')}
                        value={sentenceField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('sentenceField', event.target.value)}
                        onSelectionChange={(event) =>
                            handleSettingChanged('sentenceField', event.target.value as string)
                        }
                    />
                    <SelectableSetting
                        label={t('settings.definitionField')}
                        value={definitionField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('definitionField', event.target.value)}
                        onSelectionChange={(event) =>
                            handleSettingChanged('definitionField', event.target.value as string)
                        }
                    />
                    <SelectableSetting
                        label={t('settings.wordField')}
                        value={wordField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('wordField', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('wordField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.audioField')}
                        value={audioField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('audioField', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('audioField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.imageField')}
                        value={imageField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('imageField', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('imageField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.sourceField')}
                        value={sourceField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('sourceField', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('sourceField', event.target.value as string)}
                    />
                    <SelectableSetting
                        label={t('settings.urlField')}
                        value={urlField}
                        selections={fieldNames}
                        onChange={(event) => handleSettingChanged('urlField', event.target.value)}
                        onSelectionChange={(event) => handleSettingChanged('urlField', event.target.value as string)}
                    />
                    {customFieldInputs}
                    <AddCustomField onAddCustomField={handleAddCustomField} />
                    <TagsTextField
                        label={t('settings.tags')}
                        helperText={t('settings.tagsHelperText')}
                        fullWidth
                        color="secondary"
                        tags={tags}
                        onTagsChange={(tags) => handleSettingChanged('tags', tags)}
                    />
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['mining-settings']}>
                <FormLabel className={classes.top} component="legend">
                    {t('settings.clickToMineDefaultAction')}
                </FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.showAnkiDialog}
                                value={PostMineAction.showAnkiDialog}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('clickToMineDefaultAction', PostMineAction.showAnkiDialog)
                                }
                            />
                        }
                        label={t('postMineAction.showAnkiDialog')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.updateLastCard}
                                value={PostMineAction.updateLastCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('clickToMineDefaultAction', PostMineAction.updateLastCard)
                                }
                            />
                        }
                        label={t('postMineAction.updateLastCard')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.none}
                                value={PostMineAction.none}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('clickToMineDefaultAction', PostMineAction.none)
                                }
                            />
                        }
                        label={t('postMineAction.none')}
                    />
                </RadioGroup>
                <FormGroup className={classes.formGroup}>
                    <LabelWithHoverEffect
                        control={
                            <Switch
                                checked={preferMp3}
                                onChange={(event) => handleSettingChanged('preferMp3', event.target.checked)}
                            />
                        }
                        label={t('settings.mp3Preference')}
                        labelPlacement="start"
                        className={classes.switchLabel}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Switch
                                checked={copyToClipboardOnMine}
                                onChange={(event) =>
                                    handleSettingChanged('copyToClipboardOnMine', event.target.checked)
                                }
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
                        onChange={(event) => handleSettingChanged('audioPaddingStart', Number(event.target.value))}
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
                        onChange={(event) => handleSettingChanged('audioPaddingEnd', Number(event.target.value))}
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
                        onChange={(event) => handleSettingChanged('maxImageWidth', Number(event.target.value))}
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
                        onChange={(event) => handleSettingChanged('maxImageHeight', Number(event.target.value))}
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
                            handleSettingChanged('surroundingSubtitlesCountRadius', Number(event.target.value))
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
                            handleSettingChanged('surroundingSubtitlesTimeRadius', Number(event.target.value))
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
                                onChange={(event) => handleSettingChanged('subtitleColor', event.target.value)}
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="number"
                                label={t('settings.subtitleSize')}
                                fullWidth
                                value={subtitleSize}
                                color="secondary"
                                onChange={(event) => handleSettingChanged('subtitleSize', Number(event.target.value))}
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
                                onChange={(event, value) => handleSettingChanged('subtitleThickness', value as number)}
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
                                onChange={(event) => handleSettingChanged('subtitleOutlineColor', event.target.value)}
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
                                    handleSettingChanged('subtitleOutlineThickness', Number(event.target.value))
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
                                label={t('settings.subtitleShadowColor')}
                                fullWidth
                                value={subtitleShadowColor}
                                color="secondary"
                                onChange={(event) => handleSettingChanged('subtitleShadowColor', event.target.value)}
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="number"
                                label={t('settings.subtitleShadowThickness')}
                                fullWidth
                                value={subtitleShadowThickness}
                                onChange={(event) =>
                                    handleSettingChanged('subtitleShadowThickness', Number(event.target.value))
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
                                onChange={(event) =>
                                    handleSettingChanged('subtitleBackgroundColor', event.target.value)
                                }
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
                                    handleSettingChanged('subtitleBackgroundOpacity', Number(event.target.value))
                                }
                            />
                        </div>
                        <div className={classes.subtitleSetting}>
                            <TextField
                                type="text"
                                select={localFontFamilies.length > 0}
                                label={t('settings.subtitleFontFamily')}
                                fullWidth
                                value={subtitleFontFamily}
                                color="secondary"
                                onChange={(event) => handleSettingChanged('subtitleFontFamily', event.target.value)}
                                InputProps={{
                                    endAdornment:
                                        localFontFamilies.length === 0 &&
                                        localFontsAvailable &&
                                        localFontsPermission === 'prompt' ? (
                                            <Tooltip title={t('settings.unlockLocalFonts')!}>
                                                <IconButton onClick={onUnlockLocalFonts}>
                                                    <LockIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        ) : null,
                                }}
                            >
                                {localFontFamilies.length > 0
                                    ? localFontFamilies.map((f) => (
                                          <MenuItem key={f} value={f}>
                                              {f}
                                          </MenuItem>
                                      ))
                                    : null}
                            </TextField>
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
                                    handleSettingChanged('imageBasedSubtitleScaleFactor', Number(event.target.value))
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
                                        handleSettingChanged('subtitleCustomStyles', newValue);
                                    }}
                                    onDelete={() => {
                                        const newValue: CustomStyle[] = [];
                                        for (let j = 0; j < settings.subtitleCustomStyles.length; ++j) {
                                            if (j !== index) {
                                                newValue.push(settings.subtitleCustomStyles[j]);
                                            }
                                        }
                                        handleSettingChanged('subtitleCustomStyles', newValue);
                                    }}
                                />
                            );
                        })}
                        <AddCustomStyle
                            styleKey={currentStyleKey}
                            onStyleKey={setCurrentStyleKey}
                            onAddCustomStyle={(styleKey) =>
                                handleSettingChanged('subtitleCustomStyles', [
                                    ...settings.subtitleCustomStyles,
                                    { key: styleKey, value: '' },
                                ])
                            }
                        />
                        <div className={classes.subtitlePreview}>
                            <input
                                value={subtitlePreview}
                                className={classes.subtitlePreviewInput}
                                onChange={(event) => handleSettingChanged('subtitlePreview', event.target.value)}
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

                        if (properties.hide) {
                            return null;
                        }

                        return (
                            <KeyBindField
                                key={key}
                                label={properties.label}
                                keys={
                                    extensionInstalled && properties.boundViaChrome
                                        ? chromeKeyBinds[keyBindName] ?? ''
                                        : keyBindSet[keyBindName].keys
                                }
                                boundViaChrome={extensionInstalled && properties.boundViaChrome}
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
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={
                                            streamingSubtitleListPreference !== SubtitleListPreference.noSubtitleList
                                        }
                                        onChange={(e) =>
                                            handleSettingChanged(
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
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingDisplaySubtitles}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingDisplaySubtitles', e.target.checked)
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
                                    handleSettingChanged('streamingSubtitlePositionOffset', Number(e.target.value))
                                }
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormLabel component="legend">{t('extension.settings.subtitleAlignment')}</FormLabel>
                        <RadioGroup row>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={streamingSubtitleAlignment === 'bottom'}
                                        value={'bottom'}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            handleSettingChanged('streamingSubtitleAlignment', 'bottom')
                                        }
                                    />
                                }
                                label={t('extension.settings.subtitleAlignmentBottom')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={streamingSubtitleAlignment === 'top'}
                                        value={'top'}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            handleSettingChanged('streamingSubtitleAlignment', 'top')
                                        }
                                    />
                                }
                                label={t('extension.settings.subtitleAlignmentTop')}
                            />
                        </RadioGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup>
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingRecordMedia}
                                        onChange={(e) => handleSettingChanged('streamingRecordMedia', e.target.checked)}
                                    />
                                }
                                label={t('extension.settings.recordAudio')}
                                labelPlacement="start"
                            />
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingTakeScreenshot}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingTakeScreenshot', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.takeScreenshot')}
                                labelPlacement="start"
                            />
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingCleanScreenshot}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingCleanScreenshot', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.cleanScreenshot')}
                                labelPlacement="start"
                            />
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingCropScreenshot}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingCropScreenshot', e.target.checked)
                                        }
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
                                onChange={(e) =>
                                    handleSettingChanged('streamingScreenshotDelay', Number(e.target.value))
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
                    <Grid item>
                        <FormGroup>
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingSubsDragAndDrop}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingSubsDragAndDrop', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.dragAndDrop')}
                                labelPlacement="start"
                            />
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingAutoSync}
                                        onChange={(e) => handleSettingChanged('streamingAutoSync', e.target.checked)}
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
                                    handleSettingChanged(
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
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            {!insideApp && (
                                <TextField
                                    className={classes.textField}
                                    color="secondary"
                                    fullWidth
                                    label={t('extension.settings.asbplayerUrl')}
                                    value={streamingAppUrl}
                                    onChange={(e) => handleSettingChanged('streamingAppUrl', e.target.value)}
                                />
                            )}
                        </FormGroup>
                    </Grid>
                </Grid>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['misc-settings']}>
                <Grid container spacing={1} direction="column">
                    <Grid item>
                        <FormControl>
                            <FormLabel className={classes.top}>{t('settings.theme')}</FormLabel>
                            <RadioGroup row>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={themeType === 'light'}
                                            value="light"
                                            onChange={(event) =>
                                                event.target.checked && handleSettingChanged('themeType', 'light')
                                            }
                                        />
                                    }
                                    label={t('settings.themeLight')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={themeType === 'dark'}
                                            value="dark"
                                            onChange={(event) =>
                                                event.target.checked && handleSettingChanged('themeType', 'dark')
                                            }
                                        />
                                    }
                                    label={t('settings.themeDark')}
                                />
                            </RadioGroup>
                        </FormControl>
                        <FormGroup className={classes.formGroup}>
                            <LabelWithHoverEffect
                                control={
                                    <Switch
                                        checked={rememberSubtitleOffset}
                                        onChange={(event) =>
                                            handleSettingChanged('rememberSubtitleOffset', event.target.checked)
                                        }
                                    />
                                }
                                label={t('settings.rememberSubtitleOffset')}
                                labelPlacement="start"
                                className={classes.switchLabel}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Switch
                                        checked={autoCopyCurrentSubtitle}
                                        onChange={(event) =>
                                            handleSettingChanged('autoCopyCurrentSubtitle', event.target.checked)
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
                                    handleSettingChanged('miningHistoryStorageLimit', Number(event.target.value))
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
                                onChange={(event) => handleSettingChanged('subtitleRegexFilter', event.target.value)}
                            />
                            <TextField
                                label={t('settings.subtitleRegexFilterTextReplacement')}
                                fullWidth
                                value={subtitleRegexFilterTextReplacement}
                                color="secondary"
                                onChange={(event) =>
                                    handleSettingChanged('subtitleRegexFilterTextReplacement', event.target.value)
                                }
                            />
                            <TextField
                                select
                                label={t('settings.language')}
                                value={language}
                                color="secondary"
                                onChange={(event) => handleSettingChanged('language', event.target.value)}
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
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={autoPausePreference === AutoPausePreference.atStart}
                                        value={AutoPausePreference.atStart}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            handleSettingChanged('autoPausePreference', AutoPausePreference.atStart)
                                        }
                                    />
                                }
                                label={t('settings.autoPauseAtSubtitleStart')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={autoPausePreference === AutoPausePreference.atEnd}
                                        value={AutoPausePreference.atEnd}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            handleSettingChanged('autoPausePreference', AutoPausePreference.atEnd)
                                        }
                                    />
                                }
                                label={t('settings.autoPauseAtSubtitleEnd')}
                            />
                        </RadioGroup>
                    </Grid>
                    <Grid item>
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={preCacheSubtitleDom}
                                    onChange={(event) =>
                                        handleSettingChanged('preCacheSubtitleDom', event.target.checked)
                                    }
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
                    </Grid>
                    <Grid item>
                        <Button
                            variant="contained"
                            color="secondary"
                            style={{ width: '100%' }}
                            onClick={handleImportSettings}
                        >
                            {t('action.importSettings')}
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button
                            variant="contained"
                            color="secondary"
                            style={{ width: '100%' }}
                            onClick={handleExportSettings}
                        >
                            {t('action.exportSettings')}
                        </Button>
                    </Grid>
                </Grid>
            </TabPanel>
            <input
                ref={settingsFileInputRef}
                onChange={handleSettingsFileInputChange}
                type="file"
                accept=".json"
                multiple
                hidden
            />
        </div>
    );
}
