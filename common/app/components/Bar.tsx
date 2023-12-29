import { makeStyles, Theme } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import AppBar from '@material-ui/core/AppBar';
import BugReportIcon from '@material-ui/icons/BugReport';
import FavoriteIcon from '@material-ui/icons/Favorite';
import HelpIcon from '@material-ui/icons/Help';
import FolderIcon from '@material-ui/icons/Folder';
import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import SettingsIcon from '@material-ui/icons/Settings';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import React, { useCallback } from 'react';

interface BarProps {
    drawerWidth: number;
    drawerOpen: boolean;
    hidden: boolean;
    title: string;
    subtitleFiles?: File[];
    onFileSelector: () => void;
    onDownloadSubtitleFilesAsSrt: () => void;
    onOpenSettings: () => void;
    onOpenCopyHistory: () => void;
}

interface StyleProps {
    drawerWidth: number;
}

const useStyles = makeStyles<Theme, StyleProps, string>((theme) => ({
    title: {
        flexGrow: 1,
    },
    leftButton: {
        marginRight: theme.spacing(1),
    },
    appBar: {
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    appBarShift: {
        width: ({ drawerWidth }) => `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: ({ drawerWidth }) => drawerWidth,
    },
    copyHistoryButton: {
        transform: 'scaleX(1)',
        width: 48,
        padding: 12,
        transition: theme.transitions.create(['transform', 'padding', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    copyHistoryButtonShift: {
        transform: 'scaleX(0)',
        width: 0,
        padding: 5,
        transition: theme.transitions.create(['transform', 'padding', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    },
    hide: {
        display: 'none',
    },
}));

interface CopyHistoryTooltipStylesProps {
    show: boolean;
}

interface CopyHistoryTooltipProps extends TooltipProps {
    show: boolean;
}

const useCopyHistoryTooltipStyles = makeStyles<Theme, CopyHistoryTooltipStylesProps, string>((theme) => ({
    tooltip: ({ show }) => ({
        display: show ? 'block' : 'none',
    }),
}));

function CopyHistoryTooltip({ show, ...toolTipProps }: CopyHistoryTooltipProps) {
    const classes = useCopyHistoryTooltipStyles({ show: show });
    return <Tooltip classes={classes} {...toolTipProps} />;
}

export default function Bar({
    drawerWidth,
    drawerOpen,
    hidden,
    title,
    subtitleFiles,
    onOpenSettings,
    onOpenCopyHistory,
    onFileSelector,
    onDownloadSubtitleFilesAsSrt,
}: BarProps) {
    const classes = useStyles({ drawerWidth });
    const canSaveAsSrt =
        subtitleFiles !== undefined && subtitleFiles.find((f) => !f.name.endsWith('.sup')) !== undefined;
    const { t } = useTranslation();
    const handleFileAction = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            onFileSelector();
        },
        [onFileSelector]
    );

    const handleDownloadSubtitleFilesAsSrt = useCallback(() => {
        onDownloadSubtitleFilesAsSrt();
    }, [onDownloadSubtitleFilesAsSrt]);

    return (
        <>
            <AppBar
                position="static"
                elevation={0}
                className={clsx(classes.appBar, {
                    [classes.appBarShift]: drawerOpen,
                    [classes.hide]: hidden,
                })}
            >
                <Toolbar>
                    <Tooltip title={t('action.openFiles')!}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            className={classes.leftButton}
                            onClick={handleFileAction}
                        >
                            <FolderIcon />
                        </IconButton>
                    </Tooltip>
                    {canSaveAsSrt && (
                        <Tooltip title={t('action.downloadSubtitlesAsSrt')!}>
                            <IconButton
                                edge="start"
                                color="inherit"
                                className={classes.leftButton}
                                onClick={handleDownloadSubtitleFilesAsSrt}
                            >
                                <SaveAltIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Typography variant="h6" noWrap className={classes.title}>
                        {title}
                    </Typography>
                    <Tooltip title={t('bar.donate')!}>
                        <IconButton
                            edge="end"
                            color="inherit"
                            component="a"
                            href="https://github.com/killergerbah/asbplayer#donations"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <FavoriteIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('bar.submitIssue')!}>
                        <IconButton
                            edge="end"
                            color="inherit"
                            component="a"
                            href="https://github.com/killergerbah/asbplayer/issues"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <BugReportIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('bar.help')!}>
                        <IconButton
                            edge="end"
                            color="inherit"
                            component="a"
                            href="https://github.com/killergerbah/asbplayer#usage"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <HelpIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('bar.settings')!}>
                        <IconButton edge="end" color="inherit" onClick={onOpenSettings}>
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                    <CopyHistoryTooltip title={t('bar.miningHistory')!} show={!drawerOpen}>
                        <IconButton
                            edge="end"
                            color="inherit"
                            aria-label="menu"
                            className={clsx(classes.copyHistoryButton, {
                                [classes.copyHistoryButtonShift]: drawerOpen,
                            })}
                            onClick={onOpenCopyHistory}
                        >
                            <ListIcon />
                        </IconButton>
                    </CopyHistoryTooltip>
                </Toolbar>
            </AppBar>
        </>
    );
}
