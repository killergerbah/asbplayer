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
import VideocamIcon from '@material-ui/icons/Videocam';

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
            onBackdropClick={() => onClose()}
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
                        simultaneously e.g. mkv+srt, mp3+ass, etc.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Syncing with streaming video in another tab
                </Typography>
                <Typography component="ol">
                    <li>
                        Install the Chrome <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>extension</Link>.
                    </li>
                    <li>
                        Load a subtitle file.
                    </li>
                    <li>
                        <div className={classes.inlineIcon}>
                            Use the &nbsp;<VideocamIcon fontSize="small" />&nbsp; button in the bottom right.
                        </div>
                    </li>
                    <li>
                        If the icon does not appear try refreshing the video in the other tab.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Anki
                </Typography>
                <Typography component="ul">
                    <li>
                        <div className={classes.inlineIcon}>
                            Use the &nbsp;<StarIcon fontSize="small" />&nbsp; button in the copy history.
                        </div>
                    </li>
                    <li>
                        Audio/image will be exported only if an audio/image source was available when the subtitle was copied.
                    </li>
                    <li>
                        Configure Anki settings with the settings button in the top right.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Changing subtitle offset
                </Typography>
                <Typography component="ol">
                    <li>
                        Click on the subtitle offset input field in the controls.
                    </li>
                    <li>
                        Type in a number and hit enter.
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Condensed playback of local media files
                </Typography>
                <Typography component="ol">
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
                                <TableCell><Typography>Left/Right</Typography></TableCell>
                                <TableCell><Typography>Previous/next subtitle</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Space</Typography></TableCell>
                                <TableCell><Typography>Play/pause</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+A</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle</Typography></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><Typography>Ctrl+Shift+Z</Typography></TableCell>
                                <TableCell><Typography>Copy current subtitle (streaming video in another tab)</Typography></TableCell>
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
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=7v0Hly_Q_Bs">Sentence mining video files</Link>
                    </li>
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=m55HbFJMilk">Sentence mining streaming video</Link>
                    </li>
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://www.youtube.com/watch?v=kJXVVixD8H8">Sentence mining streaming video (drag and drop)</Link>
                    </li>
                </Typography>
                <br />
                <Typography variant="h6">
                    Guides
                </Typography>
                <Typography component="ul">
                    <li>
                        <Link color="secondary" target="_blank" rel="noreferrer" href="https://learnjapanese.moe/streamworkflow/">Sentence mining streaming workflow</Link>
                    </li>
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose()}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}
