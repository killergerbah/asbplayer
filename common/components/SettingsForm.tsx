import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import LockIcon from '@material-ui/icons/Lock';
import Box from '@material-ui/core/Box';
import EditIcon from '@material-ui/icons/Edit';
import InfoIcon from '@material-ui/icons/Info';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import MenuItem from '@material-ui/core/MenuItem';
import DeleteIcon from '@material-ui/icons/Delete';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import Radio from '@material-ui/core/Radio';
import RefreshIcon from '@material-ui/icons/Refresh';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import { Theme } from '@material-ui/core/styles';
import { AutoPausePreference, PostMineAction, PostMinePlayback } from '@project/common';
import {
    AnkiFieldSettings,
    AnkiFieldUiModel,
    AsbplayerSettings,
    CustomAnkiFieldSettings,
    KeyBindName,
    SubtitleListPreference,
    TextSubtitleSettings,
    changeForTextSubtitleSetting,
    sortedAnkiFieldModels,
    textSubtitleSettingsAreDirty,
    textSubtitleSettingsForTrack,
} from '@project/common/settings';
import { computeStyles, download, isNumeric } from '@project/common/util';
import { CustomStyle, validateSettings } from '@project/common/settings';
import { useOutsideClickListener } from '@project/common/hooks';
import TagsTextField from './TagsTextField';
import hotkeys from 'hotkeys-js';
import Typography from '@material-ui/core/Typography';
import { isMacOs } from 'react-device-detect';
import Switch from '@material-ui/core/Switch';
import RadioGroup from '@material-ui/core/RadioGroup';
import Tooltip from '@material-ui/core/Tooltip';
import Autocomplete from '@material-ui/lab/Autocomplete';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import Slider from '@material-ui/core/Slider';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import FormHelperText from '@material-ui/core/FormHelperText';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';
import { Anki } from '../anki';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { WebSocketClient } from '../web-socket-client/web-socket-client';
import { isFirefox } from '@project/common/browser-detection';
import SubtitleAppearanceTrackSelector from './SubtitleAppearanceTrackSelector';
import SubtitlePreview from './SubtitlePreview';
import UndoIcon from '@material-ui/icons/Undo';

interface StylesProps {
    smallScreen: boolean;
}

const useStyles = makeStyles<Theme, StylesProps>((theme) => ({
    root: ({ smallScreen }) => {
        let styles: any = {
            backgroundColor: theme.palette.background.paper,
            maxHeight: '100%',
            height: 'calc(100% - 48px)',
        };

        if (!smallScreen) {
            styles = { ...styles, flexGrow: 1, display: 'flex', height: '100%' };
        }

        return styles;
    },
    tabs: ({ smallScreen }) => {
        let styles: any = {
            '& .MuiButtonBase-root': {
                paddingLeft: 0,
                paddingRight: theme.spacing(1),
            },
            '& .MuiTab-root': {
                minWidth: 120,
            },
        };

        if (!smallScreen) {
            styles = { ...styles, minWidth: 120, width: 120 };
        }

        return styles;
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
    hidden: {
        opacity: 0.5,
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

enum Direction {
    up = 1,
    down = 2,
}

interface SelectableSettingProps {
    label: string;
    value: string;
    selections?: string[];
    removable?: boolean;
    display?: boolean;
    onDisplayChange?: (displaying: boolean) => void;
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
    onSelectionChange: (event: ChangeEvent<{ name?: string | undefined; value: unknown }>, child: ReactNode) => void;
    disabledDirection?: Direction;
    onOrderChange?: (direction: Direction) => void;
    onRemoval?: () => void;
}

function SelectableSetting({
    label,
    value,
    selections,
    removable,
    display,
    onDisplayChange,
    disabledDirection,
    onChange,
    onSelectionChange,
    onOrderChange,
    onRemoval,
}: SelectableSettingProps) {
    const classes = useSelectableSettingStyles();
    const { t } = useTranslation();
    const [optionsMenuOpen, setOptionsMenuOpen] = useState<boolean>(false);
    const [optionsMenuAnchorEl, setOptionsMenuAnchorEl] = useState<Element>();
    const handleOrderChange = (direction: Direction) => {
        setOptionsMenuOpen(false);
        onOrderChange?.(direction);
    };

    const className = display === false ? `${classes.root} ${classes.hidden}` : classes.root;

    return (
        <div className={className}>
            <TextField
                label={label}
                value={value}
                onChange={onChange}
                fullWidth
                color="secondary"
                InputProps={{
                    endAdornment: (removable || onOrderChange) && (
                        <InputAdornment position="end">
                            <IconButton
                                style={{ marginRight: 0 }}
                                onClick={(e) => {
                                    setOptionsMenuAnchorEl(e.currentTarget);
                                    setOptionsMenuOpen(true);
                                }}
                            >
                                <MoreVertIcon fontSize="small" />
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

            {optionsMenuOpen && (
                <Popover
                    disableEnforceFocus={true}
                    open={optionsMenuOpen}
                    anchorEl={optionsMenuAnchorEl}
                    onClose={() => setOptionsMenuOpen(false)}
                    anchorOrigin={{
                        vertical: 'center',
                        horizontal: 'center',
                    }}
                    transformOrigin={{
                        vertical: 'center',
                        horizontal: 'right',
                    }}
                >
                    <List>
                        {disabledDirection !== Direction.up && (
                            <ListItem button onClick={() => handleOrderChange(Direction.up)}>
                                <ArrowUpwardIcon fontSize="small" />
                            </ListItem>
                        )}
                        {display !== undefined && onDisplayChange !== undefined && (
                            <Tooltip
                                title={(display ? t('settings.hideInCardCreator') : t('settings.showInCardCreator'))!}
                            >
                                <ListItem button onClick={() => onDisplayChange(!display)}>
                                    {display === false && <VisibilityOffIcon fontSize="small" />}
                                    {display === true && <VisibilityIcon fontSize="small" />}
                                </ListItem>
                            </Tooltip>
                        )}
                        {disabledDirection !== Direction.down && (
                            <ListItem button onClick={() => handleOrderChange(Direction.down)}>
                                <ArrowDownwardIcon fontSize="small" />
                            </ListItem>
                        )}
                        {removable && (
                            <ListItem button onClick={(e) => onRemoval?.()}>
                                <DeleteIcon fontSize="small" />
                            </ListItem>
                        )}
                    </List>
                </Popover>
            )}
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

function KeyBindField({ label, keys, boundViaChrome, onKeysChange, onOpenExtensionShortcuts }: KeyBindFieldProps) {
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

            if (boundViaChrome) {
                onOpenExtensionShortcuts();
                return;
            }

            setCurrentKeyString('');
            setEditing(true);
        },
        [onOpenExtensionShortcuts, boundViaChrome]
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
    } else if (boundViaChrome) {
        placeholder = t('settings.extensionOverriddenBind');
    } else {
        placeholder = t('settings.unboundBind');
    }

    const firefoxExtensionShortcut = isFirefox && boundViaChrome;

    return (
        <Grid container className={classes.container} wrap={'nowrap'} spacing={1}>
            <Grid item className={classes.labelItem} xs={12}>
                <Typography>{label}</Typography>
            </Grid>
            <Grid item xs={6}>
                <TextField
                    placeholder={placeholder}
                    size="small"
                    contentEditable={false}
                    disabled={boundViaChrome}
                    helperText={boundViaChrome ? t('settings.extensionShortcut') : undefined}
                    value={currentKeyString}
                    color="secondary"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                {!firefoxExtensionShortcut && (
                                    <IconButton ref={ref} onClick={handleEditKeyBinding}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                )}
                                {firefoxExtensionShortcut && (
                                    <Tooltip title={t('settings.firefoxExtensionShortcutHelp')!}>
                                        <span>
                                            <IconButton disabled={true}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
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
    extensionSupportsOverlay: boolean;
    extensionSupportsSidePanel: boolean;
    extensionSupportsOrderableAnkiFields: boolean;
    extensionSupportsTrackSpecificSettings: boolean;
    insideApp?: boolean;
    settings: AsbplayerSettings;
    scrollToId?: string;
    chromeKeyBinds: { [key: string]: string | undefined };
    localFontsAvailable: boolean;
    localFontsPermission?: PermissionState;
    localFontFamilies: string[];
    supportedLanguages: string[];
    forceVerticalTabs?: boolean;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenChromeExtensionShortcuts: () => void;
    onUnlockLocalFonts: () => void;
}

// Filter out keys that look like '0', '1', ... as those are invalid
const cssStyles = Object.keys(document.body.style).filter((s) => !isNumeric(s));

export default function SettingsForm({
    anki,
    settings,
    extensionInstalled,
    extensionSupportsAppIntegration,
    extensionSupportsOverlay,
    extensionSupportsSidePanel,
    extensionSupportsOrderableAnkiFields,
    extensionSupportsTrackSpecificSettings,
    insideApp,
    scrollToId,
    chromeKeyBinds,
    localFontsAvailable,
    localFontsPermission,
    localFontFamilies,
    supportedLanguages,
    forceVerticalTabs,
    onSettingsChanged,
    onOpenChromeExtensionShortcuts,
    onUnlockLocalFonts,
}: Props) {
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down('xs')) && !forceVerticalTabs;
    const classes = useStyles({ smallScreen });
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
            toggleFastForwardPlayback: { label: t('binds.toggleFastForwardPlayback')!, boundViaChrome: false },
            toggleRepeat: { label: t('binds.toggleRepeat')!, boundViaChrome: false },
            toggleSubtitles: { label: t('binds.toggleSubtitles')!, boundViaChrome: false },
            toggleVideoSubtitleTrack1: { label: t('binds.toggleVideoSubtitleTrack1')!, boundViaChrome: false },
            toggleVideoSubtitleTrack2: { label: t('binds.toggleVideoSubtitleTrack2')!, boundViaChrome: false },
            toggleVideoSubtitleTrack3: { label: t('binds.toggleVideoSubtitleTrack3')!, boundViaChrome: false },
            toggleAsbplayerSubtitleTrack1: {
                label: t('binds.toggleAsbplayerSubtitleTrack1')!,
                boundViaChrome: false,
            },
            toggleAsbplayerSubtitleTrack2: {
                label: t('binds.toggleAsbplayerSubtitleTrack2')!,
                boundViaChrome: false,
            },
            toggleAsbplayerSubtitleTrack3: {
                label: t('binds.toggleAsbplayerSubtitleTrack3')!,
                boundViaChrome: false,
            },
            toggleAsbplayerBlurTrack1: {
                label: t('binds.toggleAsbplayerBlurTrack', { trackNumber: 1 })!,
                boundViaChrome: false,
            },
            toggleAsbplayerBlurTrack2: {
                label: t('binds.toggleAsbplayerBlurTrack', { trackNumber: 2 })!,
                boundViaChrome: false,
            },
            toggleAsbplayerBlurTrack3: {
                label: t('binds.toggleAsbplayerBlurTrack', { trackNumber: 3 })!,
                boundViaChrome: false,
            },
            seekBackward: { label: t('binds.seekBackward')!, boundViaChrome: false },
            seekForward: { label: t('binds.seekForward')!, boundViaChrome: false },
            seekToPreviousSubtitle: { label: t('binds.seekToPreviousSubtitle')!, boundViaChrome: false },
            seekToNextSubtitle: { label: t('binds.seekToNextSubtitle')!, boundViaChrome: false },
            seekToBeginningOfCurrentSubtitle: {
                label: t('binds.seekToBeginningOfCurrentOrPreviousSubtitle')!,
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
            toggleSidePanel: {
                label: t('binds.toggleSidePanel')!,
                boundViaChrome: false,
                hide: !extensionInstalled || !extensionSupportsSidePanel,
            },
        }),
        [t, extensionInstalled, extensionSupportsSidePanel]
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
        track1Field,
        track2Field,
        track3Field,
        ankiFieldSettings,
        subtitlePreview,
        subtitlePositionOffset,
        subtitleAlignment,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        autoPausePreference,
        speedChangeStep,
        fastForwardModePlaybackRate,
        keyBindSet,
        clickToMineDefaultAction,
        postMiningPlaybackState,
        preferMp3,
        miningHistoryStorageLimit,
        preCacheSubtitleDom,
        themeType,
        copyToClipboardOnMine,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        alwaysPlayOnSubtitleRepeat,
        tabName,
        subtitleRegexFilter,
        subtitleRegexFilterTextReplacement,
        language,
        customAnkiFields,
        customAnkiFieldSettings,
        tags,
        imageBasedSubtitleScaleFactor,
        streamingAppUrl,
        streamingDisplaySubtitles,
        streamingRecordMedia,
        streamingTakeScreenshot,
        streamingCleanScreenshot,
        streamingCropScreenshot,
        streamingSubsDragAndDrop,
        streamingAutoSync,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
        streamingScreenshotDelay,
        streamingSubtitleListPreference,
        streamingEnableOverlay,
        webSocketClientEnabled,
        webSocketServerUrl,
    } = settings;

    const [selectedSubtitleAppearanceTrack, setSelectedSubtitleAppearanceTrack] = useState<number>();
    const {
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
        subtitleCustomStyles,
        subtitleBlur,
    } = textSubtitleSettingsForTrack(settings, selectedSubtitleAppearanceTrack);

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

    const [deckNames, setDeckNames] = useState<string[]>();
    const [modelNames, setModelNames] = useState<string[]>();
    const [ankiConnectUrlError, setAnkiConnectUrlError] = useState<string>();
    const [fieldNames, setFieldNames] = useState<string[]>();
    const [currentStyleKey, setCurrentStyleKey] = useState<string>(cssStyles[0]);

    const requestAnkiConnect = useCallback(async () => {
        try {
            if (insideApp) {
                try {
                    await anki.requestPermission(ankiConnectUrl);
                } catch (e) {
                    // Request permission can give confusing errors due to AnkiConnect's implementation (or the implementation not existing in the case of Android).
                    // Furthermore, "request permission" should hardly ever work since recent Chrome security policies require the origin of the asbplayer app to
                    // be specified manually in the AnkiConnect settings anyway.
                    // So fallback to using the "version" endpoint if the above fails.
                    await anki.version(ankiConnectUrl);
                }
            } else {
                // Extension does not need to be allowed explicitly by AnkiConnect
                await anki.version(ankiConnectUrl);
            }

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
    }, [anki, ankiConnectUrl, insideApp]);

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

    const [webSocketConnectionSucceeded, setWebSocketConnectionSucceeded] = useState<boolean>();
    const pingWebSocketServer = useCallback(() => {
        const client = new WebSocketClient();
        client
            .bind(webSocketServerUrl)
            .then(() => client.ping())
            .then(() => setWebSocketConnectionSucceeded(true))
            .catch((e) => {
                console.error(e);
                setWebSocketConnectionSucceeded(false);
            })
            .finally(() => client.unbind());
    }, [webSocketServerUrl]);
    useEffect(() => {
        if (webSocketClientEnabled && webSocketServerUrl) {
            pingWebSocketServer();
        }
    }, [pingWebSocketServer, webSocketClientEnabled, webSocketServerUrl]);

    let webSocketServerUrlHelperText: string | null | undefined = undefined;

    if (webSocketClientEnabled) {
        if (webSocketConnectionSucceeded) {
            webSocketServerUrlHelperText = t('info.connectionSucceeded');
        } else if (webSocketConnectionSucceeded === false) {
            webSocketServerUrlHelperText = t('info.connectionFailed');
        }
    }

    const ankiFieldModels = sortedAnkiFieldModels(settings);

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

    const handleAnkiFieldOrderChange = useCallback(
        (direction: Direction, models: AnkiFieldUiModel[], index: number) => {
            if (direction === Direction.up && index === 0) {
                return;
            }

            if (direction === Direction.down && index === models.length - 1) {
                return;
            }

            const me = models[index];
            const other = direction === Direction.up ? models[index - 1] : models[index + 1];
            let newCustomAnkiFieldSettings: CustomAnkiFieldSettings | undefined = undefined;
            let newAnkiFieldSettings: AnkiFieldSettings | undefined = undefined;
            const newMeField = { [me.key]: { ...me.field, order: other.field.order } };
            const newOtherField = { [other.key]: { ...other.field, order: me.field.order } };

            if (other.custom) {
                newCustomAnkiFieldSettings = { ...customAnkiFieldSettings, ...newOtherField };
            } else {
                newAnkiFieldSettings = { ...ankiFieldSettings, ...newOtherField };
            }

            if (me.custom) {
                newCustomAnkiFieldSettings = {
                    ...(newCustomAnkiFieldSettings ?? customAnkiFieldSettings),
                    ...newMeField,
                };
            } else {
                newAnkiFieldSettings = { ...(newAnkiFieldSettings ?? ankiFieldSettings), ...newMeField };
            }

            onSettingsChanged({
                ankiFieldSettings: newAnkiFieldSettings ?? ankiFieldSettings,
                customAnkiFieldSettings: newCustomAnkiFieldSettings ?? customAnkiFieldSettings,
            });
        },
        [onSettingsChanged, customAnkiFieldSettings, ankiFieldSettings]
    );

    const handleAnkiFieldDisplayChange = useCallback(
        (model: AnkiFieldUiModel, display: boolean) => {
            const newField = { ...model.field, display };

            if (model.custom) {
                const newCustomAnkiFieldSettings = { ...customAnkiFieldSettings, [model.key]: newField };
                onSettingsChanged({
                    customAnkiFieldSettings: newCustomAnkiFieldSettings,
                });
            } else {
                const newAnkiFieldSettings = { ...ankiFieldSettings, [model.key]: newField };
                onSettingsChanged({
                    ankiFieldSettings: newAnkiFieldSettings,
                });
            }
        },
        [customAnkiFieldSettings, ankiFieldSettings, onSettingsChanged]
    );

    const handleSubtitleTextSettingChanged = useCallback(
        <K extends keyof TextSubtitleSettings>(key: K, value: TextSubtitleSettings[K]) => {
            // See settings.ts for more info about how/why subtitle settings are interpreted
            const diff = changeForTextSubtitleSetting({ [key]: value }, settings, selectedSubtitleAppearanceTrack);
            onSettingsChanged(diff);
        },
        [selectedSubtitleAppearanceTrack, settings, onSettingsChanged]
    );

    const handleResetSubtitleTrack = useCallback(() => {
        const diff = changeForTextSubtitleSetting(
            textSubtitleSettingsForTrack(settings, 0),
            settings,
            selectedSubtitleAppearanceTrack
        );
        onSettingsChanged(diff);
    }, [settings, selectedSubtitleAppearanceTrack, onSettingsChanged]);

    const selectedSubtitleAppearanceTrackIsDirty =
        selectedSubtitleAppearanceTrack !== undefined &&
        textSubtitleSettingsAreDirty(settings, selectedSubtitleAppearanceTrack);

    return (
        <div className={classes.root}>
            <Tabs
                orientation={smallScreen ? 'horizontal' : 'vertical'}
                variant="scrollable"
                value={tabIndex}
                className={classes.tabs}
                onChange={(event, index) => setTabIndex(index)}
                style={{ maxWidth: '100vw', marginLeft: smallScreen ? 'auto' : 8 }}
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
                    {ankiFieldModels.map((model, index) => {
                        const key = model.custom ? `custom_${model.key}` : `standard_${model.key}`;
                        const handleOrderChange =
                            !extensionInstalled || extensionSupportsOrderableAnkiFields
                                ? (d: Direction) => handleAnkiFieldOrderChange(d, ankiFieldModels, index)
                                : undefined;
                        const handleDisplayChange =
                            !extensionInstalled || extensionSupportsOrderableAnkiFields
                                ? (display: boolean) => handleAnkiFieldDisplayChange(model, display)
                                : undefined;

                        let disabledDirection: Direction | undefined = undefined;

                        if (index === 0) {
                            disabledDirection = Direction.up;
                        } else if (index === ankiFieldModels.length - 1) {
                            disabledDirection = Direction.down;
                        }

                        const rest = {
                            onOrderChange: handleOrderChange,
                            onDisplayChange: handleDisplayChange,
                            disabledDirection,
                            display: model.field.display,
                        };

                        return (
                            <React.Fragment key={key}>
                                {!model.custom && model.key === 'sentence' && (
                                    <SelectableSetting
                                        label={t('settings.sentenceField')}
                                        value={sentenceField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('sentenceField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('sentenceField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'definition' && (
                                    <SelectableSetting
                                        label={t('settings.definitionField')}
                                        value={definitionField}
                                        selections={fieldNames}
                                        onChange={(event) =>
                                            handleSettingChanged('definitionField', event.target.value)
                                        }
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('definitionField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'word' && (
                                    <SelectableSetting
                                        label={t('settings.wordField')}
                                        value={wordField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('wordField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('wordField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'audio' && (
                                    <SelectableSetting
                                        label={t('settings.audioField')}
                                        value={audioField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('audioField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('audioField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'image' && (
                                    <SelectableSetting
                                        label={t('settings.imageField')}
                                        value={imageField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('imageField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('imageField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'source' && (
                                    <SelectableSetting
                                        label={t('settings.sourceField')}
                                        value={sourceField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('sourceField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('sourceField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'url' && (
                                    <SelectableSetting
                                        label={t('settings.urlField')}
                                        value={urlField}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('urlField', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('urlField', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'track1' && (
                                    <SelectableSetting
                                        label={t('settings.track1Field')}
                                        value={track1Field}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('track1Field', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('track1Field', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'track2' && (
                                    <SelectableSetting
                                        label={t('settings.track2Field')}
                                        value={track2Field}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('track2Field', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('track2Field', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'track3' && (
                                    <SelectableSetting
                                        label={t('settings.track3Field')}
                                        value={track3Field}
                                        selections={fieldNames}
                                        onChange={(event) => handleSettingChanged('track3Field', event.target.value)}
                                        onSelectionChange={(event) =>
                                            handleSettingChanged('track3Field', event.target.value as string)
                                        }
                                        {...rest}
                                    />
                                )}
                                {model.custom && (
                                    <SelectableSetting
                                        label={`${model.key}`}
                                        value={customAnkiFields[model.key]}
                                        selections={fieldNames!}
                                        onChange={(e) => handleCustomFieldChange(model.key, e.target.value)}
                                        onSelectionChange={(e) =>
                                            handleCustomFieldChange(model.key, e.target.value as string)
                                        }
                                        onRemoval={() => handleCustomFieldRemoval(model.key)}
                                        removable={true}
                                        {...rest}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
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
                                checked={clickToMineDefaultAction === PostMineAction.exportCard}
                                value={PostMineAction.exportCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('clickToMineDefaultAction', PostMineAction.exportCard)
                                }
                            />
                        }
                        label={t('postMineAction.exportCard')}
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
                <FormLabel className={classes.top} component="legend">
                    {t('settings.postMinePlayback')}
                </FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.remember}
                                value={PostMinePlayback.remember}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('postMiningPlaybackState', PostMinePlayback.remember)
                                }
                            />
                        }
                        label={t('postMinePlayback.remember')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.play}
                                value={PostMinePlayback.play}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('postMiningPlaybackState', PostMinePlayback.play)
                                }
                            />
                        }
                        label={t('postMinePlayback.play')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.pause}
                                value={PostMinePlayback.pause}
                                onChange={(event) =>
                                    event.target.checked &&
                                    handleSettingChanged('postMiningPlaybackState', PostMinePlayback.pause)
                                }
                            />
                        }
                        label={t('postMinePlayback.pause')}
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
                        {(!extensionInstalled || extensionSupportsTrackSpecificSettings) && (
                            <>
                                <SubtitleAppearanceTrackSelector
                                    track={
                                        selectedSubtitleAppearanceTrack === undefined
                                            ? 'all'
                                            : selectedSubtitleAppearanceTrack
                                    }
                                    onTrackSelected={(t) =>
                                        setSelectedSubtitleAppearanceTrack(t === 'all' ? undefined : t)
                                    }
                                />
                                {selectedSubtitleAppearanceTrack !== undefined && (
                                    <Button
                                        startIcon={<UndoIcon />}
                                        disabled={!selectedSubtitleAppearanceTrackIsDirty}
                                        onClick={handleResetSubtitleTrack}
                                        variant="outlined"
                                    >
                                        {t('settings.reset')}
                                    </Button>
                                )}
                            </>
                        )}
                        <SubtitlePreview
                            subtitleSettings={settings}
                            text={subtitlePreview}
                            onTextChanged={(text) => handleSettingChanged('subtitlePreview', text)}
                        />
                        {subtitleColor !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="color"
                                    label={t('settings.subtitleColor')}
                                    fullWidth
                                    value={subtitleColor}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleColor', event.target.value)
                                    }
                                />
                            </div>
                        )}
                        {subtitleSize !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="number"
                                    label={t('settings.subtitleSize')}
                                    fullWidth
                                    value={subtitleSize}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleSize', Number(event.target.value))
                                    }
                                    inputProps={{
                                        min: 1,
                                        step: 1,
                                    }}
                                />
                            </div>
                        )}
                        {subtitleThickness !== undefined && (
                            <div>
                                <Typography variant="subtitle2" color="textSecondary">
                                    {t('settings.subtitleThickness')}
                                </Typography>
                                <Slider
                                    color="secondary"
                                    value={subtitleThickness}
                                    onChange={(event, value) =>
                                        handleSubtitleTextSettingChanged('subtitleThickness', value as number)
                                    }
                                    min={100}
                                    max={900}
                                    step={100}
                                    marks
                                    valueLabelDisplay="auto"
                                />
                            </div>
                        )}
                        {subtitleOutlineColor !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="color"
                                    label={t('settings.subtitleOutlineColor')}
                                    fullWidth
                                    value={subtitleOutlineColor}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleOutlineColor', event.target.value)
                                    }
                                />
                            </div>
                        )}
                        {subtitleOutlineThickness !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="number"
                                    label={t('settings.subtitleOutlineThickness')}
                                    helperText={t('settings.subtitleOutlineThicknessHelperText')}
                                    fullWidth
                                    value={subtitleOutlineThickness}
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged(
                                            'subtitleOutlineThickness',
                                            Number(event.target.value)
                                        )
                                    }
                                    inputProps={{
                                        min: 0,
                                        step: 0.1,
                                    }}
                                    color="secondary"
                                />
                            </div>
                        )}
                        {subtitleShadowColor !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="color"
                                    label={t('settings.subtitleShadowColor')}
                                    fullWidth
                                    value={subtitleShadowColor}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleShadowColor', event.target.value)
                                    }
                                />
                            </div>
                        )}
                        {subtitleShadowThickness !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="number"
                                    label={t('settings.subtitleShadowThickness')}
                                    fullWidth
                                    value={subtitleShadowThickness}
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged(
                                            'subtitleShadowThickness',
                                            Number(event.target.value)
                                        )
                                    }
                                    inputProps={{
                                        min: 0,
                                        step: 0.1,
                                    }}
                                    color="secondary"
                                />
                            </div>
                        )}
                        {subtitleBackgroundColor !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="color"
                                    label={t('settings.subtitleBackgroundColor')}
                                    fullWidth
                                    value={subtitleBackgroundColor}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleBackgroundColor', event.target.value)
                                    }
                                />
                            </div>
                        )}
                        {subtitleBackgroundOpacity !== undefined && (
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
                                        handleSubtitleTextSettingChanged(
                                            'subtitleBackgroundOpacity',
                                            Number(event.target.value)
                                        )
                                    }
                                />
                            </div>
                        )}
                        {subtitleFontFamily !== undefined && (
                            <div className={classes.subtitleSetting}>
                                <TextField
                                    type="text"
                                    select={localFontFamilies.length > 0}
                                    label={t('settings.subtitleFontFamily')}
                                    fullWidth
                                    value={subtitleFontFamily}
                                    color="secondary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleFontFamily', event.target.value)
                                    }
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
                        )}
                        {subtitleCustomStyles !== undefined && (
                            <>
                                {subtitleCustomStyles.map((customStyle, index) => {
                                    return (
                                        <CustomStyleSetting
                                            key={index}
                                            customStyle={customStyle}
                                            onCustomStyle={(newCustomStyle: CustomStyle) => {
                                                const newValue = [...settings.subtitleCustomStyles];
                                                newValue[index] = { ...newCustomStyle };
                                                handleSubtitleTextSettingChanged('subtitleCustomStyles', newValue);
                                            }}
                                            onDelete={() => {
                                                const newValue: CustomStyle[] = [];
                                                for (let j = 0; j < settings.subtitleCustomStyles.length; ++j) {
                                                    if (j !== index) {
                                                        newValue.push(settings.subtitleCustomStyles[j]);
                                                    }
                                                }
                                                handleSubtitleTextSettingChanged('subtitleCustomStyles', newValue);
                                            }}
                                        />
                                    );
                                })}
                                <AddCustomStyle
                                    styleKey={currentStyleKey}
                                    onStyleKey={setCurrentStyleKey}
                                    onAddCustomStyle={(styleKey) =>
                                        handleSubtitleTextSettingChanged('subtitleCustomStyles', [
                                            ...settings.subtitleCustomStyles,
                                            { key: styleKey, value: '' },
                                        ])
                                    }
                                />
                            </>
                        )}

                        {subtitleBlur !== undefined && (
                            <Tooltip placement="bottom-end" title={t('settings.subtitleBlurDescription')!}>
                                <LabelWithHoverEffect
                                    control={
                                        <Switch
                                            checked={subtitleBlur}
                                            onChange={(e) => {
                                                handleSubtitleTextSettingChanged('subtitleBlur', e.target.checked);
                                            }}
                                        />
                                    }
                                    label={t('settings.subtitleBlur')}
                                    labelPlacement="start"
                                    className={classes.switchLabel}
                                />
                            </Tooltip>
                        )}
                        {selectedSubtitleAppearanceTrack === undefined && (
                            <>
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
                                            handleSettingChanged(
                                                'imageBasedSubtitleScaleFactor',
                                                Number(event.target.value)
                                            )
                                        }
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <FormLabel component="legend">{t('settings.subtitleAlignment')}</FormLabel>
                                    <RadioGroup row>
                                        <LabelWithHoverEffect
                                            control={
                                                <Radio
                                                    checked={subtitleAlignment === 'bottom'}
                                                    value={'bottom'}
                                                    onChange={(event) =>
                                                        event.target.checked &&
                                                        handleSettingChanged('subtitleAlignment', 'bottom')
                                                    }
                                                />
                                            }
                                            label={t('settings.subtitleAlignmentBottom')}
                                        />
                                        <LabelWithHoverEffect
                                            control={
                                                <Radio
                                                    checked={subtitleAlignment === 'top'}
                                                    value={'top'}
                                                    onChange={(event) =>
                                                        event.target.checked &&
                                                        handleSettingChanged('subtitleAlignment', 'top')
                                                    }
                                                />
                                            }
                                            label={t('settings.subtitleAlignmentTop')}
                                        />
                                    </RadioGroup>
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        className={classes.textField}
                                        type="number"
                                        color="secondary"
                                        fullWidth
                                        label={t('settings.subtitlePositionOffset')}
                                        value={subtitlePositionOffset}
                                        inputProps={{
                                            min: 0,
                                            step: 1,
                                        }}
                                        onChange={(e) =>
                                            handleSettingChanged('subtitlePositionOffset', Number(e.target.value))
                                        }
                                    />
                                </div>
                            </>
                        )}
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
                            {extensionSupportsOverlay && (
                                <LabelWithHoverEffect
                                    className={classes.switchLabel}
                                    control={
                                        <Switch
                                            checked={streamingEnableOverlay}
                                            onChange={(e) =>
                                                handleSettingChanged('streamingEnableOverlay', e.target.checked)
                                            }
                                        />
                                    }
                                    label={t('extension.settings.enableOverlay')}
                                    labelPlacement="start"
                                />
                            )}
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
                            <LabelWithHoverEffect
                                control={
                                    <Switch
                                        checked={alwaysPlayOnSubtitleRepeat}
                                        onChange={(event) =>
                                            handleSettingChanged('alwaysPlayOnSubtitleRepeat', event.target.checked)
                                        }
                                    />
                                }
                                label={t('settings.alwaysPlayOnSubtitleRepeat')}
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
                            {insideApp && (
                                <TextField
                                    label={t('settings.tabName')}
                                    fullWidth
                                    value={tabName}
                                    color="secondary"
                                    onChange={(event) => handleSettingChanged('tabName', event.target.value)}
                                />
                            )}
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
                        <TextField
                            type="number"
                            label={t('settings.speedChangeStep')}
                            fullWidth
                            value={speedChangeStep}
                            color="secondary"
                            onChange={(event) => handleSettingChanged('speedChangeStep', Number(event.target.value))}
                            inputProps={{
                                min: 0.1,
                                max: 1,
                                step: 0.1,
                            }}
                        />
                    </Grid>
                    <Grid item>
                        <TextField
                            type="number"
                            label={t('settings.fastForwardModePlaybackRate')}
                            fullWidth
                            value={fastForwardModePlaybackRate}
                            color="secondary"
                            onChange={(event) =>
                                handleSettingChanged('fastForwardModePlaybackRate', Number(event.target.value))
                            }
                            inputProps={{
                                min: 0.1,
                                max: 5,
                                step: 0.1,
                            }}
                        />
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
                    {!isFirefox && (
                        <>
                            <Grid item>
                                <LabelWithHoverEffect
                                    className={classes.switchLabel}
                                    control={
                                        <Switch
                                            checked={webSocketClientEnabled}
                                            onChange={(e) =>
                                                handleSettingChanged('webSocketClientEnabled', e.target.checked)
                                            }
                                        />
                                    }
                                    label={t('settings.webSocketClientEnabled')}
                                    labelPlacement="start"
                                />
                            </Grid>
                            <Grid item>
                                <TextField
                                    className={classes.textField}
                                    color="secondary"
                                    fullWidth
                                    label={t('settings.webSocketServerUrl')}
                                    value={webSocketServerUrl}
                                    disabled={!webSocketClientEnabled}
                                    onChange={(e) => handleSettingChanged('webSocketServerUrl', e.target.value)}
                                    error={webSocketClientEnabled && webSocketConnectionSucceeded === false}
                                    helperText={webSocketServerUrlHelperText}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={pingWebSocketServer}>
                                                    <RefreshIcon />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                        </>
                    )}
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
