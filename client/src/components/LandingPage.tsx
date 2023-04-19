import React, { useEffect, useState } from 'react';
import { Trans } from 'react-i18next';
import { makeStyles } from '@material-ui/styles';
import gt from 'semver/functions/gt';
import Fade from '@material-ui/core/Fade';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import ChromeExtension from '../services/chrome-extension';
import { Theme } from '@material-ui/core/styles';

interface StylesProps {
    appBarHidden: boolean;
}

const useStyles = makeStyles<Theme, StylesProps>((theme) => ({
    background: ({ appBarHidden }) => ({
        position: 'absolute',
        height: appBarHidden ? '100vh' : 'calc(100vh - 64px)',
        width: '100%',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        textAlign: 'center',
    }),
    browseLink: {
        cursor: 'pointer',
    },
}));

interface Props {
    extension: ChromeExtension;
    latestExtensionVersion: string;
    extensionUrl: string;
    loading: boolean;
    dragging: boolean;
    appBarHidden: boolean;
    onFileSelector: React.MouseEventHandler<HTMLAnchorElement> &
        React.MouseEventHandler<HTMLSpanElement> &
        React.MouseEventHandler<HTMLLabelElement>;
}

export default function LandingPage({
    extension,
    latestExtensionVersion,
    extensionUrl,
    loading,
    dragging,
    appBarHidden,
    onFileSelector,
}: Props) {
    const classes = useStyles({ appBarHidden });
    const [installedExtensionVersion, setInstalledExtensionVersion] = useState<string>();

    useEffect(() => {
        async function fetchInstalledExtensionVersion() {
            setInstalledExtensionVersion(extension.version);
        }

        fetchInstalledExtensionVersion();
    }, [extension]);

    const extensionUpdateAvailable = installedExtensionVersion && gt(latestExtensionVersion, installedExtensionVersion);
    const extensionNotInstalled = !installedExtensionVersion;

    return (
        <React.Fragment>
            <Fade in={!loading && !dragging} timeout={500}>
                <div className={classes.background}>
                    <Typography variant="h6">
                        <Trans i18nKey={'landing.cta'}>
                            Drag and drop subtitle and media files, or
                            <Link
                                target="#"
                                className={classes.browseLink}
                                onClick={onFileSelector}
                                color="secondary"
                                component="label"
                            >
                                browse
                            </Link>
                            .
                        </Trans>
                        <br />
                        {extensionNotInstalled && (
                            <Trans i18nKey="landing.extensionNotInstalled">
                                Install the
                                <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>
                                    Chrome extension
                                </Link>
                                to sync subtitles with streaming video.
                            </Trans>
                        )}
                        {extensionUpdateAvailable && (
                            <Trans i18nKey="landing.extensionUpdateAvailable">
                                An extension
                                <Link color="secondary" target="_blank" rel="noreferrer" href={extensionUrl}>
                                    update
                                </Link>{' '}
                                is available.
                            </Trans>
                        )}
                    </Typography>
                </div>
            </Fade>
        </React.Fragment>
    );
}
