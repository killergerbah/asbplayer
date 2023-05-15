import React, { useCallback } from 'react';
import Box from '@material-ui/core/Box';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Grid from '@material-ui/core/Grid';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Switch from '@material-ui/core/Switch';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { ExtensionKeyBindingsSettings, ExtensionSettings, SubtitleAlignment } from '@project/common';
import { LatestExtensionInfo } from '../../services/version-checker';
import InputAdornment from '@material-ui/core/InputAdornment';
import EditIcon from '@material-ui/icons/Edit';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';

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
    switchLabelClass: string;
}

function SyncedVideoKeyboardShortcutRow({
    label,
    enabled,
    settingsKey,
    onChange,
    switchLabelClass,
}: SyncedVideoKeyboardShortcutRowProps) {
    return (
        <FormControlLabel
            className={switchLabelClass}
            control={<Switch checked={enabled} onChange={(e) => onChange(settingsKey, e.target.checked)} />}
            label={label}
            labelPlacement="start"
        />
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
    'toggle-recording': 'Manually start/stop audio recording, even when a subtitle file is loaded.',
    'toggle-video-select': 'Select subtitle tracks to load.',
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
    bindAdjustOffset: 'Adjust subtitle offset by ±100 ms',
    bindResetOffset: 'Reset subtitle offset',
    bindAdjustPlaybackRate: 'Adjust playback rate by ±0.1',
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

    const handleSubtitleAlignmentChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onSettingsChanged('subtitleAlignment', (event.target as HTMLInputElement).value as SubtitleAlignment);
        },
        [onSettingsChanged]
    );

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
                    <FormLabel component="legend">Subtitles</FormLabel>
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
                            label="Subtitle position offset"
                            value={settings.subtitlePositionOffset}
                            inputProps={{
                                min: 0,
                                step: 1,
                            }}
                            onChange={(e) => onSettingsChanged('subtitlePositionOffset', Number(e.target.value))}
                        />
                    </FormGroup>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Subtitle Alignment</FormLabel>
                    <RadioGroup row>
                        <FormControlLabel
                            control={
                                <Radio
                                    checked={settings.subtitleAlignment === 'bottom'}
                                    value={'bottom'}
                                    onChange={handleSubtitleAlignmentChange}
                                />
                            }
                            label="Bottom"
                        />
                        <FormControlLabel
                            control={
                                <Radio
                                    checked={settings.subtitleAlignment === 'top'}
                                    value={'top'}
                                    onChange={handleSubtitleAlignmentChange}
                                />
                            }
                            label="Top"
                        />
                    </RadioGroup>
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
                        <TextField
                            className={classes.textField}
                            variant="filled"
                            type="number"
                            color="secondary"
                            fullWidth
                            label="Screenshot capture delay"
                            value={settings.imageDelay}
                            onChange={(e) => onSettingsChanged('imageDelay', Number(e.target.value))}
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
                            label="Auto-load detected subtitles"
                            labelPlacement="start"
                        />
                    </FormGroup>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Misc</FormLabel>
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
                    <Grid container direction="row" spacing={1}>
                        <Grid item style={{ flexGrow: 1 }}>
                            <FormLabel component="legend">Playback Keyboard Shortcuts</FormLabel>
                        </Grid>
                        <Grid item>
                            <IconButton style={{ padding: 0 }} onClick={onVideoKeyboardShortcutClicked}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Grid>
                    </Grid>
                    <FormGroup>
                        {Object.keys(keyboardShortcutLabels).map((key) => {
                            const keyBindingSetting = key as keyof ExtensionKeyBindingsSettings;
                            return (
                                <SyncedVideoKeyboardShortcutRow
                                    key={keyBindingSetting}
                                    enabled={settings[keyBindingSetting]}
                                    label={keyboardShortcutLabels[keyBindingSetting]}
                                    settingsKey={keyBindingSetting}
                                    onChange={onSettingsChanged}
                                    switchLabelClass={classes.switchLabel}
                                />
                            );
                        })}
                    </FormGroup>
                </Grid>
            </Grid>
        </Box>
    );
}
