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
import SettingsIcon from '@material-ui/icons/Settings';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Popover from '@material-ui/core/Popover';
import { useCallback, useState } from 'react';

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
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement>();
    const canSaveAsSrt =
        subtitleFiles !== undefined && subtitleFiles.find((f) => !f.name.endsWith('.sup')) !== undefined;
    const { t } = useTranslation();
    const handleFileAction = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            if (canSaveAsSrt) {
                setMenuAnchorEl(event.currentTarget);
                setMenuOpen(true);
            } else {
                onFileSelector();
            }
        },
        [onFileSelector, canSaveAsSrt]
    );

    const handleMenuClose = useCallback(() => {
        setMenuOpen(false);
    }, []);

    const handleOpenFilesFromMenu = useCallback(() => {
        setMenuOpen(false);
        onFileSelector();
    }, [onFileSelector]);

    const handleDownloadSubtitleFilesAsSrt = useCallback(() => {
        setMenuOpen(false);
        onDownloadSubtitleFilesAsSrt();
    }, [onDownloadSubtitleFilesAsSrt]);

    return (
        <>
            {canSaveAsSrt && (
                <Popover
                    open={menuOpen}
                    anchorEl={menuAnchorEl}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'center',
                    }}
                >
                    <List>
                        <ListItem button onClick={handleOpenFilesFromMenu}>
                            {t('action.openFiles')}
                        </ListItem>
                        <ListItem button onClick={handleDownloadSubtitleFilesAsSrt}>
                            {t('action.downloadSubtitlesAsSrt')}
                        </ListItem>
                    </List>
                </Popover>
            )}
            <AppBar
                position="static"
                elevation={0}
                className={clsx(classes.appBar, {
                    [classes.appBarShift]: drawerOpen,
                    [classes.hide]: hidden,
                })}
            >
                <Toolbar>
                    <Tooltip
                        disableFocusListener={canSaveAsSrt}
                        disableHoverListener={canSaveAsSrt}
                        disableTouchListener={canSaveAsSrt}
                        title={t('action.openFiles')!}
                    >
                        <IconButton
                            edge="start"
                            color="inherit"
                            className={classes.leftButton}
                            onClick={handleFileAction}
                        >
                            <FolderIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" noWrap className={classes.title}>
                        {title}
                    </Typography>
                    <Tooltip title={t('bar.donate')!}>
                        <IconButton
                            edge="end"
                            color="inherit"
                            component="a"
                            href="https://github.com/killergerbah/asbplayer#supporters"
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
