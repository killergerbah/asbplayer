import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Link from '@material-ui/core/Link';
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
                    <Typography>
                        <ul>
                            <li>
                                Drag and drop mkv, srt, ass, or mp3 files into the player.
                            </li>
                            <li>
                                Multiple files can be dragged and dropped
                                simultaneously e.g. mkv+srt, mp3+ass, etc.
                            </li>
                        </ul>
                    </Typography>
                <Typography variant="h6">
                    Syncing with streaming video in another tab
                </Typography>
                <Typography>
                    <ol>
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
                    </ol>
                </Typography>
                <Typography variant="h6">
                    Anki
                </Typography>
                <Typography>
                    <ul>
                        <li>
                            <div className={classes.inlineIcon}>
                                Use the &nbsp;<StarIcon fontSize="small" />&nbsp; button next to any subtitle in the copy history.
                            </div>
                        </li>
                        <li>
                            Audio will be exported only if the subtitle was copied from a local audio/video file, or from streaming video while audio recording was enabled.
                        </li>
                        <li>
                            Make sure your Anki deck/note type settings are configured correctly by using the settings button in the top right.
                        </li>
                    </ul>
                </Typography>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose()}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}