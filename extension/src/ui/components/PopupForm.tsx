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
} from '@material-ui/core';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import { ExtensionKeyBindingsSettings, ExtensionSettings } from '@project/common';
import { LatestExtensionInfo } from '../../services/VersionChecker';
import InputAdornment from '@material-ui/core/InputAdornment';

const useStyles = makeStyles((theme) => ({
    root: {
        backgroundColor: theme.palette.background.paper,
        width: 400,
        padding: `${theme.spacing(2)}px ${theme.spacing(2)}px ${theme.spacing(1)}px ${theme.spacing(2)}px`,
    },
    textField: {
        margin: `${theme.spacing(1)}px 0px ${theme.spacing(1)}px 0px`,
    },
}));

const SmallTableCell = withStyles({
    sizeSmall: {
        padding: 0,
    },
})(TableCell);

interface ExtensionKeyboardShortcutProps {
    commands: any;
    commandName: string;
    onClick: () => void;
}

function ExtensionKeyboardShortcut({ commands, commandName, onClick }: ExtensionKeyboardShortcutProps) {
    const commandIsBound = commandName in commands && commands[commandName];

    return (
        <Link variant="subtitle2" underline="always" href="#" color="inherit" onClick={onClick}>
            {commandIsBound ? commands[commandName] : 'Unbound'}
        </Link>
    );
}

interface SyncedVideoKeyboardShortcutRowProps {
    label: string;
    enabled: boolean;
    settingsKey: keyof ExtensionKeyBindingsSettings;
    onChange: <K extends keyof ExtensionKeyBindingsSettings>(key: K, enabled: boolean) => void;
}

function SyncedVideoKeyboardShortcutRow({
    label,
    enabled,
    settingsKey,
    onChange,
}: SyncedVideoKeyboardShortcutRowProps) {
    return (
        <TableRow>
            <SmallTableCell>
                <Checkbox checked={enabled} onChange={(e) => onChange(settingsKey, e.target.checked)} />
            </SmallTableCell>
            <TableCell>
                <Typography variant="subtitle2">{label}</Typography>
            </TableCell>
        </TableRow>
    );
}

const keyboardShortcutLabels: { [key in keyof ExtensionKeyBindingsSettings]: string } = {
    bindPlay: 'Play/pause',
    bindAutoPause: 'Toggle auto-pause',
    bindCondensedPlayback: 'Toggle condensed-mode',
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
}

export default function PopupForm({
    commands,
    settings,
    latestVersionInfo,
    onSettingsChanged,
    onOpenExtensionShortcuts,
    onOpenUpdateUrl,
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
                            control={
                                <Checkbox
                                    checked={settings.displaySubtitles}
                                    onChange={(e) => onSettingsChanged('displaySubtitles', e.target.checked)}
                                />
                            }
                            label="Display subtitles in synced video elements"
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
                            control={
                                <Checkbox
                                    checked={settings.recordMedia}
                                    onChange={(e) => onSettingsChanged('recordMedia', e.target.checked)}
                                />
                            }
                            label="Record audio"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.screenshot}
                                    onChange={(e) => onSettingsChanged('screenshot', e.target.checked)}
                                />
                            }
                            label="Take screenshot"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.cleanScreenshot}
                                    onChange={(e) => onSettingsChanged('cleanScreenshot', e.target.checked)}
                                />
                            }
                            label="Clean screenshot"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.cropScreenshot}
                                    onChange={(e) => onSettingsChanged('cropScreenshot', e.target.checked)}
                                />
                            }
                            label="Crop screenshot"
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
                            control={
                                <Checkbox
                                    checked={settings.subsDragAndDrop}
                                    onChange={(e) => onSettingsChanged('subsDragAndDrop', e.target.checked)}
                                />
                            }
                            label="Allow file drag-and-drop to sync"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.autoSync}
                                    onChange={(e) => onSettingsChanged('autoSync', e.target.checked)}
                                />
                            }
                            label="Automatically sync detected subtitles"
                        />
                    </FormGroup>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Mining Keyboard Shortcuts</FormLabel>
                    <TableContainer>
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <TableCell>
                                        <ExtensionKeyboardShortcut
                                            commands={commands}
                                            commandName="copy-subtitle"
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">Mine current subtitle.</Typography>
                                        <Typography variant="subtitle2">
                                            When video is synced without a subtitle file, starts/stops recording audio.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <ExtensionKeyboardShortcut
                                            commands={commands}
                                            commandName="copy-subtitle-with-dialog"
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Mine current subtitle and open Anki export dialog.
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            When video is synced without a subtitle file, starts/stops recording audio.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <ExtensionKeyboardShortcut
                                            commands={commands}
                                            commandName="update-last-card"
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Update last-created Anki card with asbplayer-captured screenshot, audio,
                                            etc.
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            When video is synced without a subtitle file, starts/stops recording audio.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <ExtensionKeyboardShortcut
                                            commands={commands}
                                            commandName="take-screenshot"
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Manually take screenshot, overriding the one that is automatically taken
                                            when mining.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <ExtensionKeyboardShortcut
                                            commands={commands}
                                            commandName="toggle-video-select"
                                            onClick={onOpenExtensionShortcuts}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Select video element to mine without a subtitle file, or with detected
                                            subtitles on supported sites.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
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
                                            enabled={settings[keyBindingSetting]}
                                            label={keyboardShortcutLabels[keyBindingSetting]}
                                            settingsKey={keyBindingSetting}
                                            onChange={onSettingsChanged}
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
