import React, { useCallback, useState, useEffect, useMemo, ChangeEvent, ReactNode, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { makeStyles } from '@mui/styles';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import Box from '@mui/material/Box';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import MenuItem from '@mui/material/MenuItem';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Radio from '@mui/material/Radio';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import TextField from '@mui/material/TextField';
import { type Theme } from '@mui/material';
import { AutoPausePreference, CardModel, PostMineAction, PostMinePlayback, SubtitleHtml } from '@project/common';
import {
    AnkiFieldSettings,
    AnkiFieldUiModel,
    AsbplayerSettings,
    CustomAnkiFieldSettings,
    KeyBindName,
    PauseOnHoverMode,
    SubtitleListPreference,
    TextSubtitleSettings,
    changeForTextSubtitleSetting,
    sortedAnkiFieldModels,
    textSubtitleSettingsAreDirty,
    textSubtitleSettingsForTrack,
} from '@project/common/settings';
import { download, isNumeric } from '@project/common/util';
import { CustomStyle, validateSettings } from '@project/common/settings';
import { useOutsideClickListener } from '@project/common/hooks';
import TagsTextField from './TagsTextField';
import hotkeys from 'hotkeys-js';
import Typography from '@mui/material/Typography';
import { isMacOs, isMobile } from 'react-device-detect';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import Tooltip from './Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import Slider from '@mui/material/Slider';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import { Anki, exportCard } from '../anki';
import useMediaQuery from '@mui/material/useMediaQuery';
import { WebSocketClient } from '../web-socket-client/web-socket-client';
import { isFirefox } from '@project/common/browser-detection';
import SubtitleAppearanceTrackSelector from './SubtitleAppearanceTrackSelector';
import SubtitlePreview from './SubtitlePreview';
import About from './About';
import TutorialBubble from './TutorialBubble';
import AnkiConnectTutorialBubble from './AnkiConnectTutorialBubble';
import DeckFieldTutorialBubble from './DeckFieldTutorialBubble';
import NoteTypeTutorialBubble from './NoteTypeTutorialBubble';
import KeyBindRelatedSetting from './KeyBindRelatedSetting';

const defaultDeckName = 'Sentences';

const defaultNoteType = {
    modelName: 'Sentence Card',
    inOrderFields: ['Sentence', 'Word', 'Definition', 'Image', 'Audio', 'Source', 'URL'],
    css: `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: white;
  background-color: black;
}

.image {
  width: auto;
  height: auto;
  max-width: 500px;
  max-height: 500px;
  margin-left: auto;
  margin-right: auto;
}

.front {
  font-size: 30px;
}`,
    cardTemplates: [
        {
            Front: `<div class="front">{{Sentence}}</div>`,
            Back: `<div class="front">{{Sentence}}</div>
<hr id=answer>
{{Definition}}
<p/>
<div class="image">
{{Image}}
</div>
<p/>
{{Audio}}
<p/>
{{Source}}
<p/>
{{URL}}`,
        },
    ],
};

interface StylesProps {
    smallScreen: boolean;
}

const useStyles = makeStyles<Theme, StylesProps>((theme) => ({
    root: ({ smallScreen }) => {
        let styles: any = {
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

interface SelectableSettingProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    label: string;
    value: string;
    selections?: string[];
    removable?: boolean;
    display?: boolean;
    onDisplayChange?: (displaying: boolean) => void;
    onValueChange: (value: string) => void;
    disabledDirection?: Direction;
    onOrderChange?: (direction: Direction) => void;
    onRemoval?: () => void;
    onOpen?: () => void;
}

const SelectableSetting = React.forwardRef<HTMLDivElement, SelectableSettingProps>(function SelectableSetting(
    {
        label,
        value,
        selections,
        removable,
        display,
        onDisplayChange,
        disabledDirection,
        onValueChange,
        onOrderChange,
        onRemoval,
        onOpen,
        ...props
    },
    ref
) {
    const classes = useSelectableSettingStyles();
    const { t } = useTranslation();
    const [optionsMenuOpen, setOptionsMenuOpen] = useState<boolean>(false);
    const [optionsMenuAnchorEl, setOptionsMenuAnchorEl] = useState<Element>();
    const [selectionMenuOpen, setSelectionMenuOpen] = useState<boolean>(false);
    const [selectionMenuAnchorEl, setSelectionMenuAnchorEl] = useState<Element>();
    const handleOrderChange = (direction: Direction) => {
        setOptionsMenuOpen(false);
        onOrderChange?.(direction);
    };
    const handleOpenSelectionMenu = (element: HTMLElement) => {
        if (selections === undefined) {
            return;
        }

        setSelectionMenuAnchorEl(element);
        setSelectionMenuOpen(true);
        onOpen?.();
    };

    const className = display === false ? `${classes.root} ${classes.hidden}` : classes.root;
    const error = selections !== undefined && value !== '' && !selections.includes(value);

    return (
        <div ref={ref} className={className} {...props}>
            <TextField
                label={label}
                value={value}
                onClick={(e) => handleOpenSelectionMenu(e.currentTarget)}
                onChange={(e) => onValueChange(e.target.value)}
                fullWidth
                error={error}
                helperText={error ? t('settings.missingFieldError', { field: value }) : ''}
                color="primary"
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment style={{ marginRight: -12 }} position="end">
                                {(removable || onOrderChange) && (
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOptionsMenuAnchorEl(e.currentTarget);
                                            setOptionsMenuOpen(true);
                                        }}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    disabled={!selections}
                                    onClick={(e) => handleOpenSelectionMenu(e.currentTarget)}
                                >
                                    {selectionMenuOpen && <ArrowDropUpIcon fontSize="small" />}
                                    {!selectionMenuOpen && <ArrowDropDownIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
            >
                {selections &&
                    ['', ...selections].map((s) => (
                        <MenuItem key={s} value={s}>
                            {s === '' ? ' ' : s}
                        </MenuItem>
                    ))}
            </TextField>
            <Popover
                disableEnforceFocus={true}
                open={selections !== undefined && selectionMenuOpen}
                anchorEl={selectionMenuAnchorEl}
                onClose={() => setSelectionMenuOpen(false)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'center',
                    horizontal: 'center',
                }}
            >
                <List>
                    {selections &&
                        ['', ...selections].map((s) => (
                            <ListItem disablePadding key={s}>
                                <ListItemButton
                                    onClick={() => {
                                        onValueChange(s);
                                        setSelectionMenuOpen(false);
                                    }}
                                >
                                    {s === '' ? ' ' : s}
                                </ListItemButton>
                            </ListItem>
                        ))}
                </List>
            </Popover>
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
                        {disabledDirection !== Direction.up && onOrderChange !== undefined && (
                            <ListItem disablePadding onClick={() => handleOrderChange(Direction.up)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <ArrowUpwardIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('settings.moveUpInCardCreator')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {display !== undefined && onDisplayChange !== undefined && (
                            <ListItem disablePadding onClick={() => onDisplayChange(!display)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        {display === false && <VisibilityOffIcon fontSize="small" />}
                                        {display === true && <VisibilityIcon fontSize="small" />}
                                    </ListItemIcon>
                                    <ListItemText>
                                        {(display ? t('settings.hideInCardCreator') : t('settings.showInCardCreator'))!}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {disabledDirection !== Direction.down && onOrderChange !== undefined && (
                            <ListItem disablePadding onClick={() => handleOrderChange(Direction.down)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <ArrowDownwardIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('settings.moveDownInCardCreator')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {removable && (
                            <ListItem disablePadding onClick={() => onRemoval?.()}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <DeleteIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('action.delete')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                    </List>
                </Popover>
            )}
        </div>
    );
});

type AllKeyNames = KeyBindName | 'selectSubtitleTrack';

interface KeyBindProperties {
    label: string;
    boundViaChrome: boolean;
    hide?: boolean;
    additionalControl?: React.ReactNode;
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
        marginBottom: theme.spacing(1),
    },
    labelItem: {
        marginTop: theme.spacing(1),
    },
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
    const currentKeyStringRef = useRef<string>(undefined);
    currentKeyStringRef.current = currentKeyString;
    const onKeysChangeRef = useRef<(keys: string) => void>(undefined);
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
                    color="primary"
                    slotProps={{
                        input: {
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
                        },
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
            placeholder={t('settings.customFieldName')!}
            fullWidth
            value={fieldName}
            color="primary"
            onChange={(e) => setFieldName(e.target.value)}
            slotProps={{
                input: {
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
                },
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
                    color="primary"
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
            color="primary"
            label={t('settings.customCssField', { styleKey: customStyle.key })}
            placeholder={t('settings.styleValue')!}
            value={customStyle.value}
            onChange={(e) => onCustomStyle({ key: customStyle.key, value: e.target.value })}
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={onDelete}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}

enum TutorialStep {
    ankiConnect = 1,
    deck = 2,
    noteType = 3,
    ankiFields = 4,
    testCard = 5,
    done,
}

type TabsOrientation = 'horizontal' | 'vertical';
interface PanelStyleProps {
    tabsOrientation: TabsOrientation;
}

const usePanelStyles = makeStyles<Theme, PanelStyleProps>((theme: Theme) => ({
    panel: ({ tabsOrientation }) => ({
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        paddingTop: tabsOrientation === 'horizontal' ? theme.spacing(1) : 0,
        overflowY: 'scroll',
        maxHeight: '100%',
        height: '100%',
        width: '100%',
    }),
}));

interface TabPanelProps {
    children?: React.ReactNode;
    index: any;
    value: any;
    tabsOrientation: TabsOrientation;
}

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
    { children, value, index, tabsOrientation, ...other }: TabPanelProps,
    ref
) {
    const classes = usePanelStyles({ tabsOrientation });
    return (
        <Box ref={ref} className={classes.panel} hidden={value !== index} {...other}>
            {value === index && children}
        </Box>
    );
});

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
    extensionVersion?: string;
    extensionSupportsAppIntegration: boolean;
    extensionSupportsOverlay: boolean;
    extensionSupportsSidePanel: boolean;
    extensionSupportsOrderableAnkiFields: boolean;
    extensionSupportsTrackSpecificSettings: boolean;
    extensionSupportsSubtitlesWidthSetting: boolean;
    extensionSupportsPauseOnHover: boolean;
    extensionSupportsExportCardBind: boolean;
    insideApp?: boolean;
    appVersion?: string;
    settings: AsbplayerSettings;
    scrollToId?: string;
    chromeKeyBinds: { [key: string]: string | undefined };
    localFontsAvailable: boolean;
    localFontsPermission?: PermissionState;
    localFontFamilies: string[];
    supportedLanguages: string[];
    forceVerticalTabs?: boolean;
    inTutorial?: boolean;
    testCard?: () => Promise<CardModel>;
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
    extensionVersion,
    extensionSupportsAppIntegration,
    extensionSupportsOverlay,
    extensionSupportsSidePanel,
    extensionSupportsOrderableAnkiFields,
    extensionSupportsTrackSpecificSettings,
    extensionSupportsSubtitlesWidthSetting,
    extensionSupportsPauseOnHover,
    extensionSupportsExportCardBind,
    insideApp,
    appVersion,
    scrollToId,
    chromeKeyBinds,
    localFontsAvailable,
    localFontsPermission,
    localFontFamilies,
    supportedLanguages,
    forceVerticalTabs,
    inTutorial,
    testCard,
    onSettingsChanged,
    onOpenChromeExtensionShortcuts,
    onUnlockLocalFonts,
}: Props) {
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down('sm')) && !forceVerticalTabs;
    const classes = useStyles({ smallScreen });
    const handleSettingChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            onSettingsChanged({ [key]: value });
        },
        [onSettingsChanged]
    );
    const { t } = useTranslation();

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
        subtitlePositionOffset: subtitlePositionOffset,
        topSubtitlePositionOffset,
        subtitlesWidth,
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        autoPausePreference,
        seekDuration,
        speedChangeStep,
        fastForwardModePlaybackRate,
        keyBindSet,
        clickToMineDefaultAction,
        postMiningPlaybackState,
        recordWithAudioPlayback,
        preferMp3,
        miningHistoryStorageLimit,
        themeType,
        copyToClipboardOnMine,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        alwaysPlayOnSubtitleRepeat,
        tabName,
        subtitleRegexFilter,
        subtitleRegexFilterTextReplacement,
        subtitleHtml,
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
        streamingAutoSyncPromptOnFailure,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
        streamingScreenshotDelay,
        streamingSubtitleListPreference,
        streamingEnableOverlay,
        webSocketClientEnabled,
        webSocketServerUrl,
        pauseOnHoverMode,
    } = settings;

    const keyBindProperties = useMemo<{ [key in AllKeyNames]: KeyBindProperties }>(
        () => ({
            copySubtitle: { label: t('binds.copySubtitle')!, boundViaChrome: true },
            ankiExport: { label: t('binds.ankiExport')!, boundViaChrome: true },
            updateLastCard: {
                label: t('binds.updateLastCard')!,
                boundViaChrome: true,
            },
            exportCard: {
                label: t('binds.exportCard')!,
                boundViaChrome: true,
                hide: extensionInstalled && !extensionSupportsExportCardBind,
            },
            takeScreenshot: {
                label: t('binds.takeScreenshot')!,
                boundViaChrome: true,
            },
            toggleRecording: {
                label: t('binds.extensionToggleRecording')!,
                boundViaChrome: true,
            },
            selectSubtitleTrack: {
                label: t('binds.extensionSelectSubtitleTrack')!,
                boundViaChrome: true,
                hide: !extensionInstalled,
            },
            togglePlay: { label: t('binds.togglePlay')!, boundViaChrome: false },
            toggleAutoPause: {
                label: t('binds.toggleAutoPause')!,
                boundViaChrome: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.autoPausePreference')}
                        control={
                            <Grid item>
                                <RadioGroup row>
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={autoPausePreference === AutoPausePreference.atStart}
                                                value={AutoPausePreference.atStart}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    handleSettingChanged(
                                                        'autoPausePreference',
                                                        AutoPausePreference.atStart
                                                    )
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
                                                    handleSettingChanged(
                                                        'autoPausePreference',
                                                        AutoPausePreference.atEnd
                                                    )
                                                }
                                            />
                                        }
                                        label={t('settings.autoPauseAtSubtitleEnd')}
                                    />
                                </RadioGroup>
                            </Grid>
                        }
                    />
                ),
            },
            toggleCondensedPlayback: { label: t('binds.toggleCondensedPlayback')!, boundViaChrome: false },
            toggleFastForwardPlayback: {
                label: t('binds.toggleFastForwardPlayback')!,
                boundViaChrome: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.fastForwardModePlaybackRate')}
                        control={
                            <TextField
                                type="number"
                                fullWidth
                                value={fastForwardModePlaybackRate}
                                color="primary"
                                onChange={(event) =>
                                    handleSettingChanged('fastForwardModePlaybackRate', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0.1,
                                        max: 5,
                                        step: 0.1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
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
            unblurAsbplayerTrack1: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 1 })!,
                boundViaChrome: false,
            },
            unblurAsbplayerTrack2: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 2 })!,
                boundViaChrome: false,
            },
            unblurAsbplayerTrack3: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 3 })!,
                boundViaChrome: false,
            },
            seekBackward: { label: t('binds.seekBackward')!, boundViaChrome: false },
            seekForward: {
                label: t('binds.seekForward')!,
                boundViaChrome: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.seekDuration')}
                        control={
                            <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={seekDuration}
                                color="primary"
                                onChange={(event) => handleSettingChanged('seekDuration', Number(event.target.value))}
                                slotProps={{
                                    htmlInput: {
                                        min: 1,
                                        max: 60,
                                        step: 1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
            seekToPreviousSubtitle: { label: t('binds.seekToPreviousSubtitle')!, boundViaChrome: false },
            seekToNextSubtitle: { label: t('binds.seekToNextSubtitle')!, boundViaChrome: false },
            seekToBeginningOfCurrentSubtitle: {
                label: t('binds.seekToBeginningOfCurrentOrPreviousSubtitle')!,
                boundViaChrome: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.alwaysPlayOnSubtitleRepeat')}
                        control={
                            <Switch
                                checked={alwaysPlayOnSubtitleRepeat}
                                onChange={(event) =>
                                    handleSettingChanged('alwaysPlayOnSubtitleRepeat', event.target.checked)
                                }
                            />
                        }
                    />
                ),
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
            decreasePlaybackRate: {
                label: t('binds.decreasePlaybackRate')!,
                boundViaChrome: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.speedChangeStep')}
                        control={
                            <TextField
                                type="number"
                                fullWidth
                                value={speedChangeStep}
                                color="primary"
                                onChange={(event) =>
                                    handleSettingChanged('speedChangeStep', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0.1,
                                        max: 1,
                                        step: 0.1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
            toggleSidePanel: {
                label: t('binds.toggleSidePanel')!,
                boundViaChrome: false,
                hide: !extensionInstalled || !extensionSupportsSidePanel,
            },
            moveBottomSubtitlesUp: {
                label: t('binds.moveBottomSubtitlesUp')!,
                boundViaChrome: false,
            },
            moveBottomSubtitlesDown: {
                label: t('binds.moveBottomSubtitlesDown')!,
                boundViaChrome: false,
            },
            moveTopSubtitlesUp: {
                label: t('binds.moveTopSubtitlesUp')!,
                boundViaChrome: false,
            },
            moveTopSubtitlesDown: {
                label: t('binds.moveTopSubtitlesDown')!,
                boundViaChrome: false,
            },
        }),
        [
            t,
            extensionInstalled,
            extensionSupportsSidePanel,
            extensionSupportsExportCardBind,
            handleSettingChanged,
            seekDuration,
            alwaysPlayOnSubtitleRepeat,
            autoPausePreference,
            speedChangeStep,
            fastForwardModePlaybackRate,
        ]
    );

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
        subtitleAlignment,
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

                setFieldNames(await anki.modelFieldNames(noteType, ankiConnectUrl));
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
            'about',
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
            const validatedSettings = validateSettings(importedSettings);
            onSettingsChanged(validatedSettings);
        } catch (e) {
            console.error(e);
        }
    }, [onSettingsChanged]);
    const handleImportSettings = useCallback(() => {
        settingsFileInputRef.current?.click();
    }, []);
    const handleExportSettings = useCallback(() => {
        const now = new Date();
        const timeString = `${now.getFullYear()}-${
            now.getMonth() + 1
        }-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        download(
            new Blob([JSON.stringify(settings)], { type: 'appliction/json' }),
            `asbplayer-settings-${timeString}.json`
        );
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
    const tabsOrientation = smallScreen ? 'horizontal' : 'vertical';
    const [tutorialStep, setTutorialStep] = useState<TutorialStep>(TutorialStep.ankiConnect);

    const handleCreateDefaultDeck = useCallback(() => {
        anki.createDeck(defaultDeckName)
            .then(() => requestAnkiConnect())
            .then(() => handleSettingChanged('deck', defaultDeckName))
            .catch(console.error);
    }, [anki, requestAnkiConnect, handleSettingChanged]);

    useEffect(() => {
        if (tutorialStep === TutorialStep.deck && deck) {
            setTutorialStep(TutorialStep.noteType);
        }
    }, [tutorialStep, deck]);

    const handleCreateDefaultNoteType = useCallback(() => {
        anki.createModel(defaultNoteType)
            .then(() => requestAnkiConnect())
            .then(() => handleSettingChanged('noteType', defaultNoteType.modelName))
            .then(() =>
                Promise.all([
                    handleSettingChanged('sentenceField', 'Sentence'),
                    handleSettingChanged('definitionField', 'Definition'),
                    handleSettingChanged('wordField', 'Word'),
                    handleSettingChanged('audioField', 'Audio'),
                    handleSettingChanged('imageField', 'Image'),
                    handleSettingChanged('sourceField', 'Source'),
                    handleSettingChanged('urlField', 'URL'),
                ])
            )
            .catch(console.error);
        if (tutorialStep === TutorialStep.ankiFields) {
            setTutorialStep(TutorialStep.testCard);
        }
    }, [anki, tutorialStep, requestAnkiConnect, handleSettingChanged]);

    useEffect(() => {
        if (tutorialStep === TutorialStep.noteType && noteType) {
            setTutorialStep(TutorialStep.ankiFields);
        }
    }, [tutorialStep, noteType]);

    const ankiPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (tutorialStep === TutorialStep.testCard) {
            ankiPanelRef.current?.scrollBy({ behavior: 'smooth', top: 100000 });
        }
    }, [tutorialStep]);

    const handleCreateTestCard = useCallback(async () => {
        if (testCard === undefined) {
            return;
        }

        if (tutorialStep === TutorialStep.testCard) {
            setTutorialStep(TutorialStep.done);
        }

        await exportCard(await testCard(), settings, isMobile ? 'default' : 'gui');
    }, [tutorialStep, settings, testCard]);

    return (
        <div className={classes.root}>
            <Tabs
                orientation={tabsOrientation}
                variant="scrollable"
                value={tabIndex}
                className={classes.tabs}
                onChange={(event, index) => setTabIndex(index)}
                style={{
                    maxWidth: '100vw',
                    marginLeft: smallScreen ? 'auto' : 8,
                    marginRight: smallScreen ? 'auto' : 8,
                }}
            >
                <Tab tabIndex={0} label={t('settings.anki')} id="anki-settings" />
                <Tab tabIndex={1} label={t('settings.mining')} id="mining-settings" />
                <Tab tabIndex={2} label={t('settings.subtitleAppearance')} id="subtitle-appearance" />
                <Tab tabIndex={3} label={t('settings.keyboardShortcuts')} id="keyboard-shortcuts" />
                {extensionSupportsAppIntegration && (
                    <Tab tabIndex={4} label={t('settings.streamingVideo')} id="streaming-video" />
                )}
                <Tab tabIndex={5} label={t('settings.misc')} id="misc-settings" />
                <Tab tabIndex={6} label={t('about.title')} id="about" />
            </Tabs>
            <TabPanel
                ref={ankiPanelRef}
                value={tabIndex}
                index={tabIndicesById['anki-settings']}
                tabsOrientation={tabsOrientation}
            >
                <FormGroup className={classes.formGroup}>
                    <AnkiConnectTutorialBubble
                        show={tutorialStep === TutorialStep.ankiConnect}
                        disabled={!inTutorial}
                        ankiConnectUrlError={Boolean(ankiConnectUrlError)}
                        onConfirm={() => {
                            setTutorialStep(TutorialStep.deck);
                        }}
                    >
                        <TextField
                            label={t('settings.ankiConnectUrl')}
                            value={ankiConnectUrl}
                            error={Boolean(ankiConnectUrlError)}
                            helperText={ankiConnectUrlError}
                            color="primary"
                            onChange={(event) => handleSettingChanged('ankiConnectUrl', event.target.value)}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={requestAnkiConnect}>
                                                <RefreshIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                    </AnkiConnectTutorialBubble>
                    {insideApp && (
                        <FormHelperText>
                            <Trans
                                i18nKey={'settings.corsHelperText'}
                                values={{ origin }}
                                components={[
                                    <Link
                                        key={0}
                                        color="primary"
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
                    <DeckFieldTutorialBubble
                        show={tutorialStep === TutorialStep.deck && !ankiConnectUrlError && !deck}
                        disabled={!inTutorial}
                        noDecks={deckNames === undefined || deckNames.length === 0}
                        onCreateDefaultDeck={handleCreateDefaultDeck}
                    >
                        <SelectableSetting
                            label={t('settings.deck')}
                            value={deck}
                            selections={deckNames}
                            onValueChange={(value) => handleSettingChanged('deck', value)}
                            onOpen={() => {
                                if (tutorialStep === TutorialStep.deck) {
                                    setTutorialStep(TutorialStep.noteType);
                                }
                            }}
                        />
                    </DeckFieldTutorialBubble>
                    <NoteTypeTutorialBubble
                        show={tutorialStep === TutorialStep.noteType && Boolean(deck) && !noteType}
                        disabled={!inTutorial}
                        noNoteTypes={modelNames === undefined || modelNames.length === 0}
                        onCreateDefaultNoteType={handleCreateDefaultNoteType}
                    >
                        <SelectableSetting
                            label={t('settings.noteType')}
                            value={noteType}
                            selections={modelNames}
                            onValueChange={(value) => handleSettingChanged('noteType', value)}
                            onOpen={() => {
                                if (tutorialStep === TutorialStep.noteType) {
                                    setTutorialStep(TutorialStep.ankiFields);
                                }
                            }}
                        />
                    </NoteTypeTutorialBubble>
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
                                    <TutorialBubble
                                        placement="bottom"
                                        disabled={!inTutorial}
                                        show={
                                            tutorialStep === TutorialStep.ankiFields &&
                                            Boolean(deck) &&
                                            Boolean(noteType)
                                        }
                                        disableArrow
                                        text={t('ftue.ankiFields')!}
                                        onConfirm={() => setTutorialStep(TutorialStep.testCard)}
                                    >
                                        <SelectableSetting
                                            label={t('settings.sentenceField')}
                                            value={sentenceField}
                                            selections={fieldNames}
                                            onValueChange={(value) => handleSettingChanged('sentenceField', value)}
                                            {...rest}
                                        />
                                    </TutorialBubble>
                                )}
                                {!model.custom && model.key === 'definition' && (
                                    <SelectableSetting
                                        label={t('settings.definitionField')}
                                        value={definitionField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('definitionField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'word' && (
                                    <SelectableSetting
                                        label={t('settings.wordField')}
                                        value={wordField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('wordField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'audio' && (
                                    <SelectableSetting
                                        label={t('settings.audioField')}
                                        value={audioField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('audioField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'image' && (
                                    <SelectableSetting
                                        label={t('settings.imageField')}
                                        value={imageField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('imageField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'source' && (
                                    <SelectableSetting
                                        label={t('settings.sourceField')}
                                        value={sourceField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('sourceField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom && model.key === 'url' && (
                                    <SelectableSetting
                                        label={t('settings.urlField')}
                                        value={urlField}
                                        selections={fieldNames}
                                        onValueChange={(value) => handleSettingChanged('urlField', value)}
                                        {...rest}
                                    />
                                )}
                                {!model.custom &&
                                    model.key === 'track1' &&
                                    (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                        <SelectableSetting
                                            label={t('settings.track1Field')}
                                            value={track1Field}
                                            selections={fieldNames}
                                            onValueChange={(value) => handleSettingChanged('track1Field', value)}
                                            {...rest}
                                        />
                                    )}
                                {!model.custom &&
                                    model.key === 'track2' &&
                                    (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                        <SelectableSetting
                                            label={t('settings.track2Field')}
                                            value={track2Field}
                                            selections={fieldNames}
                                            onValueChange={(value) => handleSettingChanged('track2Field', value)}
                                            {...rest}
                                        />
                                    )}
                                {!model.custom &&
                                    model.key === 'track3' &&
                                    (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                        <SelectableSetting
                                            label={t('settings.track3Field')}
                                            value={track3Field}
                                            selections={fieldNames}
                                            onValueChange={(value) => handleSettingChanged('track3Field', value)}
                                            {...rest}
                                        />
                                    )}
                                {model.custom && (
                                    <SelectableSetting
                                        label={`${model.key}`}
                                        value={customAnkiFields[model.key]}
                                        selections={fieldNames!}
                                        onValueChange={(value) => handleCustomFieldChange(model.key, value)}
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
                        color="primary"
                        tags={tags}
                        onTagsChange={(tags) => handleSettingChanged('tags', tags)}
                    />
                    {testCard && (
                        <TutorialBubble
                            placement="top"
                            disabled={!inTutorial}
                            show={tutorialStep === TutorialStep.testCard}
                            text={t('ftue.testCard')!}
                            onConfirm={() => setTutorialStep(TutorialStep.done)}
                        >
                            <Button variant="contained" onClick={handleCreateTestCard}>
                                {t('settings.createTestCard')}
                            </Button>
                        </TutorialBubble>
                    )}
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['mining-settings']} tabsOrientation={tabsOrientation}>
                <FormLabel component="legend">{t('settings.clickToMineDefaultAction')}</FormLabel>
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
                <FormLabel component="legend">{t('settings.postMinePlayback')}</FormLabel>
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
                                checked={recordWithAudioPlayback}
                                onChange={(event) =>
                                    handleSettingChanged('recordWithAudioPlayback', event.target.checked)
                                }
                            />
                        }
                        label={t('settings.recordWithAudioPlayback')}
                        labelPlacement="start"
                        className={classes.switchLabel}
                    />
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
                        color="primary"
                        onChange={(event) => handleSettingChanged('audioPaddingStart', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.audioPaddingEnd')}
                        fullWidth
                        value={audioPaddingEnd}
                        color="primary"
                        onChange={(event) => handleSettingChanged('audioPaddingEnd', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                step: 1,
                                min: 0,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.maxImageWidth')}
                        fullWidth
                        value={maxImageWidth}
                        color="primary"
                        onChange={(event) => handleSettingChanged('maxImageWidth', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.maxImageHeight')}
                        fullWidth
                        value={maxImageHeight}
                        color="primary"
                        onChange={(event) => handleSettingChanged('maxImageHeight', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.surroundingSubtitlesCountRadius')}
                        fullWidth
                        value={surroundingSubtitlesCountRadius}
                        color="primary"
                        onChange={(event) =>
                            handleSettingChanged('surroundingSubtitlesCountRadius', Number(event.target.value))
                        }
                        slotProps={{
                            htmlInput: {
                                min: 1,
                                step: 1,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.surroundingSubtitlesTimeRadius')}
                        fullWidth
                        value={surroundingSubtitlesTimeRadius}
                        color="primary"
                        onChange={(event) =>
                            handleSettingChanged('surroundingSubtitlesTimeRadius', Number(event.target.value))
                        }
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['subtitle-appearance']} tabsOrientation={tabsOrientation}>
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
                                    color="primary"
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
                                    color="primary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleSize', Number(event.target.value))
                                    }
                                    slotProps={{
                                        htmlInput: {
                                            min: 1,
                                            step: 1,
                                        },
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
                                    color="primary"
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
                                    color="primary"
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
                                    slotProps={{
                                        htmlInput: {
                                            min: 0,
                                            step: 0.1,
                                        },
                                    }}
                                    color="primary"
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
                                    color="primary"
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
                                    slotProps={{
                                        htmlInput: {
                                            min: 0,
                                            step: 0.1,
                                        },
                                    }}
                                    color="primary"
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
                                    color="primary"
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
                                    slotProps={{
                                        htmlInput: {
                                            min: 0,
                                            max: 1,
                                            step: 0.1,
                                        },
                                    }}
                                    value={subtitleBackgroundOpacity}
                                    color="primary"
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
                                    color="primary"
                                    onChange={(event) =>
                                        handleSubtitleTextSettingChanged('subtitleFontFamily', event.target.value)
                                    }
                                    slotProps={{
                                        input: {
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
                                        },
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

                        {subtitleAlignment !== undefined && (
                            <>
                                <FormLabel component="legend">{t('settings.subtitleAlignment')}</FormLabel>
                                <RadioGroup row>
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={subtitleAlignment === 'bottom'}
                                                value={'bottom'}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    handleSubtitleTextSettingChanged('subtitleAlignment', 'bottom')
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
                                                    handleSubtitleTextSettingChanged('subtitleAlignment', 'top')
                                                }
                                            />
                                        }
                                        label={t('settings.subtitleAlignmentTop')}
                                    />
                                </RadioGroup>
                            </>
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

                        {selectedSubtitleAppearanceTrack === undefined && (
                            <>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        className={classes.textField}
                                        type="number"
                                        color="primary"
                                        fullWidth
                                        label={t('settings.subtitlePositionOffset')}
                                        value={subtitlePositionOffset}
                                        slotProps={{
                                            htmlInput: {
                                                min: 0,
                                                step: 1,
                                            },
                                        }}
                                        onChange={(e) =>
                                            handleSettingChanged('subtitlePositionOffset', Number(e.target.value))
                                        }
                                    />
                                </div>
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        className={classes.textField}
                                        type="number"
                                        color="primary"
                                        fullWidth
                                        label={t('settings.topSubtitlePositionOffset')}
                                        value={topSubtitlePositionOffset}
                                        slotProps={{
                                            htmlInput: {
                                                min: 0,
                                                step: 1,
                                            },
                                        }}
                                        onChange={(e) =>
                                            handleSettingChanged('topSubtitlePositionOffset', Number(e.target.value))
                                        }
                                    />
                                </div>
                                {(!extensionInstalled || extensionSupportsSubtitlesWidthSetting) && (
                                    <div className={classes.subtitleSetting}>
                                        <TextField
                                            className={classes.textField}
                                            color="primary"
                                            fullWidth
                                            label={t('settings.subtitlesWidth')}
                                            disabled={subtitlesWidth === -1}
                                            value={subtitlesWidth === -1 ? 'auto' : subtitlesWidth}
                                            onChange={(e) => {
                                                const numberValue = Number(e.target.value);

                                                if (
                                                    !Number.isNaN(numberValue) &&
                                                    numberValue >= 0 &&
                                                    numberValue <= 100
                                                ) {
                                                    handleSettingChanged('subtitlesWidth', numberValue);
                                                }
                                            }}
                                            slotProps={{
                                                input: {
                                                    endAdornment: (
                                                        <>
                                                            {subtitlesWidth === -1 && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        onClick={() =>
                                                                            handleSettingChanged('subtitlesWidth', 100)
                                                                        }
                                                                    >
                                                                        <EditIcon />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )}
                                                            {subtitlesWidth !== -1 && (
                                                                <>
                                                                    <InputAdornment position="end">%</InputAdornment>
                                                                    <InputAdornment position="end">
                                                                        <IconButton
                                                                            onClick={() =>
                                                                                handleSettingChanged(
                                                                                    'subtitlesWidth',
                                                                                    -1
                                                                                )
                                                                            }
                                                                        >
                                                                            <ClearIcon />
                                                                        </IconButton>
                                                                    </InputAdornment>
                                                                </>
                                                            )}
                                                        </>
                                                    ),
                                                },
                                            }}
                                        />
                                    </div>
                                )}
                                <div className={classes.subtitleSetting}>
                                    <TextField
                                        type="number"
                                        label={t('settings.imageBasedSubtitleScaleFactor')}
                                        placeholder="Inherited"
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                min: 0,
                                                max: 1,
                                                step: 0.1,
                                            },
                                        }}
                                        value={imageBasedSubtitleScaleFactor}
                                        color="primary"
                                        onChange={(event) =>
                                            handleSettingChanged(
                                                'imageBasedSubtitleScaleFactor',
                                                Number(event.target.value)
                                            )
                                        }
                                    />
                                </div>
                            </>
                        )}
                    </FormGroup>
                </Grid>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['keyboard-shortcuts']} tabsOrientation={tabsOrientation}>
                <FormGroup className={classes.formGroup}>
                    {Object.keys(keyBindProperties).map((key) => {
                        const keyBindName = key as KeyBindName;
                        const properties = keyBindProperties[keyBindName];

                        if (properties.hide) {
                            return null;
                        }

                        return (
                            <div key={key}>
                                <KeyBindField
                                    key={key}
                                    label={properties.label}
                                    keys={
                                        extensionInstalled && properties.boundViaChrome
                                            ? (chromeKeyBinds[keyBindName] ?? '')
                                            : keyBindSet[keyBindName].keys
                                    }
                                    boundViaChrome={extensionInstalled && properties.boundViaChrome}
                                    onKeysChange={(keys) => handleKeysChange(keys, keyBindName)}
                                    onOpenExtensionShortcuts={onOpenChromeExtensionShortcuts}
                                />
                                {properties.additionalControl}
                            </div>
                        );
                    })}
                </FormGroup>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['streaming-video']} tabsOrientation={tabsOrientation}>
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
                                color="primary"
                                fullWidth
                                label={t('extension.settings.screenshotCaptureDelay')}
                                value={streamingScreenshotDelay}
                                onChange={(e) =>
                                    handleSettingChanged('streamingScreenshotDelay', Number(e.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
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
                            <LabelWithHoverEffect
                                className={classes.switchLabel}
                                control={
                                    <Switch
                                        checked={streamingAutoSyncPromptOnFailure}
                                        onChange={(e) =>
                                            handleSettingChanged('streamingAutoSyncPromptOnFailure', e.target.checked)
                                        }
                                    />
                                }
                                label={t('extension.settings.autoLoadDetectedSubsFailure')}
                                labelPlacement="start"
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            <TextField
                                className={classes.textField}
                                type="number"
                                color="primary"
                                fullWidth
                                label={t('extension.settings.condensedPlaybackMinSkipInterval')}
                                value={streamingCondensedPlaybackMinimumSkipIntervalMs}
                                onChange={(e) =>
                                    handleSettingChanged(
                                        'streamingCondensedPlaybackMinimumSkipIntervalMs',
                                        Number(e.target.value)
                                    )
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                        </FormGroup>
                    </Grid>
                    <Grid item>
                        <FormGroup className={classes.formGroup}>
                            {!insideApp && (
                                <TextField
                                    className={classes.textField}
                                    color="primary"
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
            <TabPanel value={tabIndex} index={tabIndicesById['misc-settings']} tabsOrientation={tabsOrientation}>
                <Grid container spacing={1} direction="column">
                    <Grid item>
                        <FormControl>
                            <FormLabel>{t('settings.theme')}</FormLabel>
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
                            <TextField
                                select
                                label={t('settings.language')}
                                value={language}
                                color="primary"
                                onChange={(event) => handleSettingChanged('language', event.target.value)}
                            >
                                {supportedLanguages.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        {s}
                                    </MenuItem>
                                ))}
                            </TextField>
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
                                color="primary"
                                onChange={(event) =>
                                    handleSettingChanged('miningHistoryStorageLimit', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                }}
                            />
                            {insideApp && (
                                <TextField
                                    label={t('settings.tabName')}
                                    fullWidth
                                    value={tabName}
                                    color="primary"
                                    onChange={(event) => handleSettingChanged('tabName', event.target.value)}
                                />
                            )}
                            <TextField
                                label={t('settings.subtitleRegexFilter')}
                                fullWidth
                                value={subtitleRegexFilter}
                                color="primary"
                                error={!validRegex}
                                helperText={validRegex ? undefined : 'Invalid regular expression'}
                                onChange={(event) => handleSettingChanged('subtitleRegexFilter', event.target.value)}
                            />
                            <TextField
                                label={t('settings.subtitleRegexFilterTextReplacement')}
                                fullWidth
                                value={subtitleRegexFilterTextReplacement}
                                color="primary"
                                onChange={(event) =>
                                    handleSettingChanged('subtitleRegexFilterTextReplacement', event.target.value)
                                }
                            />
                            <FormControl>
                                <FormLabel>{t('settings.subtitleHtml')}</FormLabel>
                                <RadioGroup row>
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={subtitleHtml === SubtitleHtml.remove}
                                                value={SubtitleHtml.remove}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    handleSettingChanged('subtitleHtml', SubtitleHtml.remove)
                                                }
                                            />
                                        }
                                        label={t('settings.subtitleHtmlRemove')}
                                    />
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={subtitleHtml === SubtitleHtml.render}
                                                value={SubtitleHtml.render}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    handleSettingChanged('subtitleHtml', SubtitleHtml.render)
                                                }
                                            />
                                        }
                                        label={t('settings.subtitleHtmlRender')}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </FormGroup>
                    </Grid>
                    {(!extensionInstalled || extensionSupportsPauseOnHover) && (
                        <Grid item>
                            <FormLabel component="legend">{t('settings.pauseOnHoverMode')}</FormLabel>
                            <RadioGroup row={false}>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={pauseOnHoverMode === PauseOnHoverMode.disabled}
                                            value={PauseOnHoverMode.disabled}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                handleSettingChanged('pauseOnHoverMode', PauseOnHoverMode.disabled)
                                            }
                                        />
                                    }
                                    label={t('pauseOnHoverMode.disabled')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={pauseOnHoverMode === PauseOnHoverMode.inAndOut}
                                            value={PauseOnHoverMode.inAndOut}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                handleSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inAndOut)
                                            }
                                        />
                                    }
                                    label={t('pauseOnHoverMode.inAndOut')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={pauseOnHoverMode === PauseOnHoverMode.inNotOut}
                                            value={PauseOnHoverMode.inNotOut}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                handleSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inNotOut)
                                            }
                                        />
                                    }
                                    label={t('pauseOnHoverMode.inNotOut')}
                                />
                            </RadioGroup>
                        </Grid>
                    )}
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
                                    color="primary"
                                    fullWidth
                                    label={t('settings.webSocketServerUrl')}
                                    value={webSocketServerUrl}
                                    disabled={!webSocketClientEnabled}
                                    onChange={(e) => handleSettingChanged('webSocketServerUrl', e.target.value)}
                                    error={webSocketClientEnabled && webSocketConnectionSucceeded === false}
                                    helperText={webSocketServerUrlHelperText}
                                    slotProps={{
                                        input: {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={pingWebSocketServer}>
                                                        <RefreshIcon />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                            </Grid>
                        </>
                    )}
                    <Grid item>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ width: '100%' }}
                            onClick={handleImportSettings}
                        >
                            {t('action.importSettings')}
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ width: '100%' }}
                            onClick={handleExportSettings}
                        >
                            {t('action.exportSettings')}
                        </Button>
                    </Grid>
                </Grid>
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['about']} tabsOrientation={tabsOrientation}>
                <About
                    appVersion={insideApp ? appVersion : undefined}
                    extensionVersion={extensionInstalled ? extensionVersion : undefined}
                />
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
