import { makeStyles, Theme } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import AppBar from '@material-ui/core/AppBar';
import BugReportIcon from '@material-ui/icons/BugReport';
import FavoriteIcon from '@material-ui/icons/Favorite';
import HelpIcon from '@material-ui/icons/Help';
import IconButton from '@material-ui/core/IconButton';
import HistoryIcon from '@material-ui/icons/History';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import SettingsIcon from '@material-ui/icons/Settings';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import React, { useCallback, useState } from 'react';
import GitHubIcon from '@material-ui/icons/GitHub';
import List from '@material-ui/core/List';
import MuiLink, { LinkProps as MuiLinkProps } from '@material-ui/core/Link';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Popover from '@material-ui/core/Popover';

interface BarProps {
    drawerWidth: number;
    drawerOpen: boolean;
    hidden: boolean;
    title: string;
    subtitleFiles?: File[];
    onFileSelector?: () => void;
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
        background: 'linear-gradient(150deg, #ff1f62, #49007a 160%)',
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
    menu: {
        '&:hover .MuiLink-root': {
            textDecoration: 'none',
        },
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

const Link = ({ children, ...props }: MuiLinkProps) => {
    return (
        <MuiLink component="a" target="_blank" rel="noreferrer" color="inherit" {...props}>
            {children}
        </MuiLink>
    );
};
export default function Bar({
    drawerWidth,
    drawerOpen,
    hidden,
    title,
    subtitleFiles,
    onOpenSettings,
    onOpenCopyHistory,
    onDownloadSubtitleFilesAsSrt,
}: BarProps) {
    const classes = useStyles({ drawerWidth });
    const canSaveAsSrt =
        subtitleFiles !== undefined && subtitleFiles.find((f) => !f.name.endsWith('.sup')) !== undefined;
    const { t } = useTranslation();

    const handleDownloadSubtitleFilesAsSrt = useCallback(() => {
        onDownloadSubtitleFilesAsSrt();
    }, [onDownloadSubtitleFilesAsSrt]);

    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement>();
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const handleMenuClose = useCallback(() => {
        setMenuOpen(false);
    }, []);
    const handleMenuOpen = useCallback((e: React.UIEvent) => {
        setMenuAnchorEl(e.currentTarget as HTMLElement);
        setMenuOpen(true);
    }, []);

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
                    <IconButton edge="end" color="inherit" onClick={handleMenuOpen}>
                        <GitHubIcon />
                    </IconButton>
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
                            <HistoryIcon />
                        </IconButton>
                    </CopyHistoryTooltip>
                </Toolbar>
            </AppBar>
            <Popover
                disableEnforceFocus={true}
                open={menuOpen}
                anchorEl={menuAnchorEl}
                onClose={handleMenuClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <List className={classes.menu} onMouseLeave={handleMenuClose} dense>
                    <Link href="https://github.com/killergerbah/asbplayer#detailed-usage">
                        <ListItem button>
                            <ListItemIcon>
                                <HelpIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('bar.help')!} />
                        </ListItem>
                    </Link>
                    <Link href="https://github.com/killergerbah/asbplayer/issues">
                        <ListItem button>
                            <ListItemIcon>
                                <BugReportIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('bar.submitIssue')!} />
                        </ListItem>
                    </Link>
                    <Link href="https://github.com/killergerbah/asbplayer#donations">
                        <ListItem button>
                            <ListItemIcon>
                                <FavoriteIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('bar.donate')!} />
                        </ListItem>
                    </Link>
                </List>
            </Popover>
        </>
    );
}
