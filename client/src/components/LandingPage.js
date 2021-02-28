import { makeStyles } from '@material-ui/styles';
import Fade from '@material-ui/core/Fade';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import background from './background.png';

const useStyles = makeStyles((theme) => ({
    root: {
        position: "absolute",
        height: 'calc(100vh - 64px)',
        width: "100%",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundImage: "url(" + background + ")",
        backgroundSize: "500px 500px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        padding: 15,
        textAlign: "center"
    }
}));

export default function LandingPage(props) {
    const classes = useStyles();
    const {loading} = props;

    return (
        <div className={classes.root}>
            <Fade in={!loading} timeout={500}>
                <Typography>
                    Drag and drop srt, ass, mp3, or mkv files. <br />
                    Install the <Link color="secondary" target="_blank" rel="noreferrer" href="https://github.com/killergerbah/asbplayer/releases/tag/v0.2.1">extension</Link> to sync subtitles with videos in other tabs.
                </Typography>
            </Fade>
        </div>
    );
}