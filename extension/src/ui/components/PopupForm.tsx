import React from 'react';
import {
    Box,
    FormGroup,
    FormControlLabel,
    FormLabel,
    Grid,
    Checkbox,
    TableContainer,
    Table,
    TableBody,
    TableRow,
    TableCell,
    TextField,
    Typography,
    Link,
    Button,
    IconButton,
    Switch,
} from '@material-ui/core';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import { ExtensionKeyBindingsSettings, ExtensionSettings } from '@project/common';
import { LatestExtensionInfo } from '../../services/VersionChecker';
import InputAdornment from '@material-ui/core/InputAdornment';
import EditIcon from '@material-ui/icons/Edit';

const useStyles = makeStyles((theme) => ({
    root: {
        backgroundColor: theme.palette.background.paper,
        width: 400,
        padding: `${theme.spacing(2)}px ${theme.spacing(2)}px ${theme.spacing(1)}px ${theme.spacing(2)}px`,
    },
    textField: {
        margin: `${theme.spacing(1)}px 0px ${theme.spacing(1)}px 0px`,
    },
    switchLabel: {
        justifyContent: 'space-between',
        marginLeft: 0,
    },
}));

const SmallTableCell = withStyles({
    sizeSmall: {
        padding: 0,
    },
})(TableCell);

interface ExtensionKeyboardShortcutRowProps {
    label: string;
    command: string;
    onClick: () => void;
}

function ExtensionKeyboardShortcutRow({ label, command, onClick }: ExtensionKeyboardShortcutRowProps) {
    return (
        <TableRow>
            <TableCell style={{ paddingLeft: 0 }}>{label}</TableCell>
            <TableCell style={{ paddingRight: 0 }} align="right">
                <Link variant="subtitle2" underline="always" href="#" color="inherit" onClick={onClick}>
                    {command ?? 'Unbound'}
                </Link>
            </TableCell>
        </TableRow>
    );
}

interface SyncedVideoKeyboardShortcutRowProps {
    label: string;
    enabled: boolean;
    settingsKey: keyof ExtensionKeyBindingsSettings;
    onChange: <K extends keyof ExtensionKeyBindingsSettings>(key: K, enabled: boolean) => void;
    onClick: () => void;
}

function SyncedVideoKeyboardShortcutRow({
    label,
    enabled,
    settingsKey,
    onChange,
    onClick,
}: SyncedVideoKeyboardShortcutRowProps) {
    return (
        <TableRow>
            <TableCell style={{ paddingLeft: 0 }}>
                <Typography variant="subtitle2">{label}</Typography>
            </TableCell>
            <SmallTableCell>
                <IconButton size="small" onClick={onClick}>
                    <EditIcon />
                </IconButton>
            </SmallTableCell>
            <SmallTableCell style={{ paddingRight: 0 }}>
                <Switch checked={enabled} onChange={(e) => onChange(settingsKey, e.target.checked)} />
            </SmallTableCell>
        </TableRow>
    );
}

const extensionKeyboardShortcutLabels: any = {
    'copy-subtitle':
        'Mine current subtitle.\nWhen video is synced without a subtitle file, starts/stops recording audio.',
    'copy-subtitle-with-dialog':
        'Mine current subtitle and open Anki export dialog.\nWhen video is synced without a subtitle file, starts/stops recording audio.',
    'update-last-card':
        'Update last-created Anki card with asbplayer-captured media.\nWhen video is synced without a subtitle file, starts/stops recording audio.',
    'take-screenshot': 'Manually take screenshot, overriding the one that is automatically taken when mining.',
    'toggle-video-select':
        'Select video element to mine without a subtitle file, or with detected subtitles on supported sites.',
};

const keyboardShortcutLabels: { [key in keyof ExtensionKeyBindingsSettings]: string } = {
    bindPlay: 'Play/pause',
    bindAutoPause: 'Toggle auto-pause',
    bindCondensedPlayback: 'Toggle condensed playback',
    bindToggleSubtitles: 'Toggle subtitles',
    bindToggleSubtitleTrackInVideo: 'Toggle subtitle track in video',
    bindToggleSubtitleTrackInAsbplayer: 'Toggle subtitle track in asbplayer',
    bindSeekBackwardOrForward: 'Seek backward/forward 10 seconds',
    bindSeekToSubtitle: 'Seek to previous/next subtitle',
    bindSeekToBeginningOfCurrentSubtitle: 'Seek to beginning of current subtitle',
    bindAdjustOffsetToSubtitle: 'Adjust subtitle offset so that previous/next subtitle is at current timestamp',
    bindAdjustOffset: 'Adjust offset by +/- 100 ms',
};

interface PopupFormProps {
    commands: any;
    settings: any;
    latestVersionInfo?: LatestExtensionInfo;
    onSettingsChanged: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
    onOpenExtensionShortcuts: () => void;
    onOpenUpdateUrl: (url: string) => void;
    onVideoKeyboardShortcutClicked: () => void;
}

export default function PopupForm({
    commands,
    settings,
    latestVersionInfo,
    onSettingsChanged,
    onOpenExtensionShortcuts,
    onOpenUpdateUrl,
    onVideoKeyboardShortcutClicked,
}: PopupFormProps) {
    const classes = useStyles();

    return (
        <Box className={classes.root}>
            <Grid container direction="column" spacing={2}>
                <Grid item>
                    <Typography variant="caption">v{chrome.runtime.getManifest().version}</Typography>
                </Grid>
                {latestVersionInfo && (
                    <Grid item>
                        <Button
                            fullWidth
                            onClick={() => onOpenUpdateUrl(latestVersionInfo.url)}
                            variant="contained"
                            color="secondary"
                        >
                            Update Available
                        </Button>
                    </Grid>
                )}
                <Grid item>
                    <FormLabel component="legend">Playback</FormLabel>
                    <FormGroup>
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.displaySubtitles}
                                    onChange={(e) => onSettingsChanged('displaySubtitles', e.target.checked)}
                                />
                            }
                            label="Display subtitles"
                            labelPlacement="start"
                        />
                        <TextField
                            className={classes.textField}
                            variant="filled"
                            type="number"
                            color="secondary"
                            fullWidth
                            label="Subtitle position offset from bottom"
                            value={settings.subtitlePositionOffsetBottom}
                            inputProps={{
                                min: 0,
                                step: 1,
                            }}
                            onChange={(e) => onSettingsChanged('subtitlePositionOffsetBottom', Number(e.target.value))}
                        />
                        <TextField
                            className={classes.textField}
                            variant="filled"
                            type="number"
                            color="secondary"
                            fullWidth
                            label="Condensed playback minimum skip interval"
                            value={settings.condensedPlaybackMinimumSkipIntervalMs}
                            onChange={(e) =>
                                onSettingsChanged('condensedPlaybackMinimumSkipIntervalMs', Number(e.target.value))
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
                    <FormLabel component="legend">Mining</FormLabel>
                    <FormGroup>
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.recordMedia}
                                    onChange={(e) => onSettingsChanged('recordMedia', e.target.checked)}
                                />
                            }
                            label="Record audio"
                            labelPlacement="start"
                        />
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.screenshot}
                                    onChange={(e) => onSettingsChanged('screenshot', e.target.checked)}
                                />
                            }
                            label="Take screenshot"
                            labelPlacement="start"
                        />
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.cleanScreenshot}
                                    onChange={(e) => onSettingsChanged('cleanScreenshot', e.target.checked)}
                                />
                            }
                            label="Clean screenshot"
                            labelPlacement="start"
                        />
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.cropScreenshot}
                                    onChange={(e) => onSettingsChanged('cropScreenshot', e.target.checked)}
                                />
                            }
                            label="Crop screenshot"
                            labelPlacement="start"
                        />
                    </FormGroup>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Syncing</FormLabel>
                    <FormGroup>
                        <TextField
                            className={classes.textField}
                            variant="filled"
                            color="secondary"
                            fullWidth
                            label="asbplayer URL"
                            value={settings.asbplayerUrl}
                            onChange={(e) => onSettingsChanged('asbplayerUrl', e.target.value)}
                        />
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.subsDragAndDrop}
                                    onChange={(e) => onSettingsChanged('subsDragAndDrop', e.target.checked)}
                                />
                            }
                            label="Allow subtitle file drag-and-drop"
                            labelPlacement="start"
                        />
                        <FormControlLabel
                            className={classes.switchLabel}
                            control={
                                <Switch
                                    checked={settings.autoSync}
                                    onChange={(e) => onSettingsChanged('autoSync', e.target.checked)}
                                />
                            }
                            label="Auto-sync detected subtitles"
                            labelPlacement="start"
                        />
                    </FormGroup>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Mining Keyboard Shortcuts</FormLabel>
                    <TableContainer>
                        <Table size="small">
                            <TableBody>
                                {Object.keys(extensionKeyboardShortcutLabels).map((commandName) => {
                                    return (
                                        <ExtensionKeyboardShortcutRow
                                            key={commandName}
                                            label={extensionKeyboardShortcutLabels[commandName]}
                                            command={commands[commandName]}
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Playback Keyboard Shortcuts</FormLabel>
                    <TableContainer>
                        <Table size="small">
                            <TableBody>
                                {Object.keys(keyboardShortcutLabels).map((key) => {
                                    const keyBindingSetting = key as keyof ExtensionKeyBindingsSettings;
                                    return (
                                        <SyncedVideoKeyboardShortcutRow
                                            key={keyBindingSetting}
                                            enabled={settings[keyBindingSetting]}
                                            label={keyboardShortcutLabels[keyBindingSetting]}
                                            settingsKey={keyBindingSetting}
                                            onChange={onSettingsChanged}
                                            onClick={onVideoKeyboardShortcutClicked}
                                        />
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
            </Grid>
        </Box>
    );
}
