import React from 'react';
import { makeStyles } from '@material-ui/styles';
import Fade from '@material-ui/core/Fade';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import background from './background.png';
import coloredBackground from './background-colored.png';

const useStyles = makeStyles((theme) => ({
    background: {
        position: "absolute",
        height: 'calc(100vh - 64px)',
        width: "100%",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 15,
        textAlign: "center",
        backgroundSize: "500px 500px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center"
    },
    defaultBackground: {
        backgroundImage: `url(${background})`
    },
    coloredBackground: {
        backgroundImage: `url(${coloredBackground})`
    }
}));

export default function LandingPage(props) {
    const classes = useStyles();
    const {loading} = props;

    return (
        <React.Fragment>
            <div className={`${classes.background} ${classes.defaultBackground}`}>
                <Fade in={!loading} timeout={500}>
                    <Typography>
                        Drag and drop srt, ass, mp3, or mkv files. <br />
                        Install the <Link color="secondary" target="_blank" rel="noreferrer" href="https://github.com/killergerbah/asbplayer/releases/tag/v0.3.0">extension</Link> to sync subtitles with videos in other tabs.
                    </Typography>
                </Fade>
            </div>
            <Fade in={loading} timeout={5000}>
                <div className={`${classes.background} ${classes.coloredBackground}`} />
            </Fade>
        </React.Fragment>
    );
}