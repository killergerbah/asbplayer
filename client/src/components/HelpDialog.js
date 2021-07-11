import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Link from '@material-ui/core/Link';
import SpeedIcon from '@material-ui/icons/Speed';
import StarIcon from '@material-ui/icons/Star';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableContainer from '@material-ui/core/TableContainer';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
    inlineIcon: {
        maxWidth: '80%',
        height: 20,
        display: "inline-flex",
        flexDirection: "column",
        flexWrap: "wrap",
        alignItems: "start",
        textAlign: "left"
    }
}));
export default function HelpDialog(props) {
    const classes = useStyles();
    const {open, extensionUrl, onClose} = props;

    return (
        <Dialog
            open={open}
            onBackdropClick={onClose}
            onEscapeKeyDown={onClose}
        >
            <DialogContent>
                <Typography variant="h6">
                    Loading files
                </Typography>
                <Typography component="ul">
                    <li>
                        Drag and drop mkv, srt, ass, or mp3 files into the player.
                    </li>
                    <li>
                        Multiple files can be dragged and dropped
                        simultaneously e.g. mkv+srt, mp3+ass etc.
                    </li>
                    <li>
                        Multiple subtitle files can loaded simultaneously. When multiple subtitle files are loaded,
                        they can be toggled on and off in-video using S+1, S+2, etc.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Syncing with streaming video in another tab
                </Typography>
                <Typography component="ul">
                    <li>
                        Install the Chrome <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>extension</Link>.
                    </li>
                    <li>Drag-and-drop a subtitle file into the video element you want to sync.</li>
                    <li>
                        Or, load a subtitle file into asbplayer and use the camera button in the bottom right.
                    </li>
                    <li>
                        If the icon does not appear try refreshing the video in the other tab.
                    </li>
                    <li>
                        It is recommended to use the extension keyboard shortcut (Ctrl+Alt+X by default) to mine subtitles since that will include audio/screenshots.
                        If the keyboard shortcut  is not working for some reason try:
                        <Typography component="ul">
                            <li>Uninstalling and reinstalling the extension and restarting Chrome.</li>
                            <li>Verifying the keyboard shortcut is  bound as in this <Link color="secondary" target="_blank" rel="noreferrer" href="https://youtu.be/wYWbgovfNlI">video</Link>.</li>
                        </Typography>
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Anki
                </Typography>
                <Typography component="ul">
                    <li>Synchronous workflow:</li>
                    <ul>
                        <li>
                            For synced streaming video, open the Anki dialog during playback by using Ctrl+Shift+X.
                        </li>
                        <li>
                            For local file playback, open the Anki dialog during playback by using Ctrl+Shift+Q.
                        </li>
                    </ul>
                    <li>Asynchronous workflow:</li>
                    <ul>
                        <li>
                            For synced streaming video, copy the current subtitle by using Ctrl+Shift+Z.
                        </li>
                        <li>
                            For local file playback, copy the current subtitle by using Ctrl+Shift+A.
                        </li>
                        <li>
                            <div className={classes.inlineIcon}>
                                Use the &nbsp;<StarIcon fontSize="small" />&nbsp; button in the copy history.
                            </div>
                        </li>
                    </ul>
                    <li>
                        For synced streaming video, an audio/image will only be available if an extension keyboard shortcut was used (Ctrl+Alt+X or Ctrl+Alt+Z by default).
                    </li>
                    <li>
                        Configure Anki settings with the settings button in the top right. See this <Link color="secondary" target="_blank" rel="noreferrer" href="https://youtu.be/Mv7fEVb6PHo?t=44">video</Link> for how to configure AnkiConnect so that asbplayer can connect to Anki.
                    </li>
                    <li>
                        If asbplayer still cannot connect to Anki after setting everything up, check that your browser or an ad blocker isn't blocking the request.
                        A good place to start is by opening your browser's developer console and looking for errors.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Changing subtitle offset
                </Typography>
                <Typography component="ul">
                    <li>
                        Use Ctrl+Left/Right to cause the previous/next subtitle to appear at the current timestamp.
                    </li>
                    <li>
                        Use Ctrl+Shift+Left/Right to adjust timing further by 100 ms increments.
                    </li>
                    <li>
                        Or, click on the subtitle offset input field in the controls, type a number, and hit Enter.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Condensed playback of local media files
                </Typography>
                <Typography component="ul">
                    <li>
                        Load an audio/video file with a subtitle file.
                    </li>
                    <li>
                        <div className={classes.inlineIcon}>
                            Use the &nbsp;<SpeedIcon fontSize="small" />&nbsp; button in the bottom right.
                        </div>
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Keyboard shortcuts
                </Typography>
                <TableContainer>
                    <Table size="small">
                        <TableBody>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+A</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+Q</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle and open Anki export dialog</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+Z</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle (streaming video in another tab)</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+X</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle and open Anki export dialog (streaming video in another tab)</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Space</Typography></TableCell>
                                <TableCell><Typography>Play/pause</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>S</Typography></TableCell>
                                <TableCell><Typography>Toggle subtitles</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>S+1, S+2...</Typography></TableCell>
                                <TableCell><Typography>Toggle subtitle track 1, 2... in video</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>D+1, D+2...</Typography></TableCell>
                                <TableCell><Typography>Toggle subtitle track 1, 2... in asbplayer</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Left/Right</Typography></TableCell>
                                <TableCell><Typography>Seek to previous/next subtitle</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Left/Right or Shift+Left/Right</Typography></TableCell>
                                <TableCell><Typography>Adjust offset to previous/next subtitle</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+Left/Right</Typography></TableCell>
                                <TableCell><Typography>Adjust offset by +/- 100 ms</Typography></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
                <br />
                <Typography variant="h6">
                    Demos
                </Typography>
                <Typography component="ul">
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=W9Lf3C7sRzc">Sentence mining streaming video (synchronous workflow)</Link>
                    </li>
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=kJXVVixD8H8">Sentence mining streaming video (asynchronous workflow)</Link>
                    </li>
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=J3E82spYqIk">Sentence mining video files (synchronous workflow)</Link>
                    </li>
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=HsrrpnfM4pI">Sentence mining video files (asynchronous workflow)</Link>
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Browser Compatibility
                </Typography>
                <Typography component="ul">
                    <li>
                        The asbplayer application and extension have only been tested on Chrome 91 and later and likely work on other Chromium-based browsers.
                    </li>
                    <li>
                        Local file playback is supported only for codecs supported by the browser.
                        The <Link color="secondary" target="_blank" rel="noreferrer" href="https://github.com/animebook/animebook.github.io#video-format-support">animebook</Link> readme has a detailed explanation of this and links
                        to browsers that have good compatibility. Personally, I use Microsoft Edge and paid one dollar for HEVC support.
                    </li>
                    <li>
                        Audio track selection for mkv files is available if experimental web platform features are enabled from chrome://flags.
                    </li>
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose()}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}
