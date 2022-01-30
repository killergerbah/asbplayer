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
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

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

interface PopupFormProps {
    commands: any;
    settings: any;
    onSettingsChanged: (key: string, value: any) => void;
    onOpenExtensionShortcuts: () => void;
}

export default function PopupForm({ commands, settings, onSettingsChanged, onOpenExtensionShortcuts }: PopupFormProps) {
    const classes = useStyles();

    return (
        <Box className={classes.root}>
            <Grid container direction="column" spacing={2}>
                <Grid item>
                    <FormLabel component="legend">Subtitles</FormLabel>
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
                            onChange={(e) => onSettingsChanged('subtitlePositionOffsetBottom', e.target.value)}
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
                            label="Record audio when copying subtitle"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.screenshot}
                                    onChange={(e) => onSettingsChanged('screenshot', e.target.checked)}
                                />
                            }
                            label="Take screenshot when copying subtitle"
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
                    <FormLabel component="legend">Extension Keyboard Shortcuts</FormLabel>
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
                                        <Typography variant="subtitle2">Copy current subtitle</Typography>
                                        <Typography variant="subtitle2">
                                            When video is synced without a subtitle file, starts/stops recording audio
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
                                            Copy current subtitle and open Anki export dialog
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            When video is synced without a subtitle file, starts/stops recording audio
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
                                            subtitles on supported sites
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
                <Grid item>
                    <FormLabel component="legend">Synced Video Keyboard Shortcuts</FormLabel>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={settings.bindKeys}
                                    onChange={(e) => onSettingsChanged('bindKeys', e.target.checked)}
                                />
                            }
                            label="Bind keyboard shortcuts"
                        />
                    </FormGroup>
                    <TableContainer>
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">Space</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">Play/pause</Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography>S</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">Toggle subtitles</Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">S+1, S+2...</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Toggle subtitle track 1, 2... in video
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">D+1, D+2...</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Toggle subtitle track 1, 2... in asbplayer
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">Left/Right</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">Seek to previous/next subtitle</Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">Ctrl+Left/Right or Shift+Left/Right</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">
                                            Adjust offset to previous/next subtitle
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        <Typography variant="subtitle2">Ctrl+Shift+Left/Right</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">Adjust offset by +/- 100 ms</Typography>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
            </Grid>
        </Box>
    );
}
