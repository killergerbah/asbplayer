import React, { useEffect, useState } from 'react';
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
        backgroundImage: `url(${coloredBackground})`,
    },
}));

export default function LandingPage(props) {
    const classes = useStyles();
    const {extension, latestExtensionVersion, extensionUrl, loading, dragging} = props;
    const [installedExtensionVersion, setInstalledExtensionVersion] = useState();

    useEffect(() => {
        async function fetchInstalledExtensionVersion() {
            setInstalledExtensionVersion(await extension.installedVersion());
        }

        fetchInstalledExtensionVersion();
    }, [extension]);

    const extensionUpdateAvailable = latestExtensionVersion > installedExtensionVersion;
    const extensionNotInstalled = !installedExtensionVersion;

    return (
        <React.Fragment>
            <Fade in={!loading && !dragging} timeout={500}>
                <div className={`${classes.background} ${classes.defaultBackground}`}>
                    <Typography>
                        Drag and drop srt, ass, vtt, mp3, m4a, and mkv files. <br />
                        {extensionNotInstalled && (
                            <span>
                                Install the <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>extension</Link> to sync subtitles with videos in other tabs.
                            </span>
                        )}
                        {extensionUpdateAvailable && (
                            <span>
                                An extension <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>update</Link> is available.
                            </span>
                        )}
                    </Typography>
                </div>
            </Fade>
        </React.Fragment>
    );
}
