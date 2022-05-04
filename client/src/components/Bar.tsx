import { makeStyles, Theme } from '@material-ui/core/styles';
import clsx from 'clsx';
import AppBar from '@material-ui/core/AppBar';
import BugReportIcon from '@material-ui/icons/BugReport';
import FavoriteIcon from '@material-ui/icons/Favorite';
import HelpIcon from '@material-ui/icons/Help';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import SettingsIcon from '@material-ui/icons/Settings';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

interface BarProps {
    drawerWidth: number;
    drawerOpen: boolean;
    hidden: boolean;
    title: string;
    onFileSelector: () => void;
    onOpenSettings: () => void;
    onOpenCopyHistory: () => void;
}

const useStyles = makeStyles<Theme, BarProps, string>((theme) => ({
    title: {
        flexGrow: 1,
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

export default function Bar(props: BarProps) {
    const classes = useStyles(props);
    return (
        <AppBar
            position="static"
            elevation={0}
            className={clsx(classes.appBar, {
                [classes.appBarShift]: props.drawerOpen,
                [classes.hide]: props.hidden
            })}
        >
            <Toolbar>
                <Tooltip title="Open Files">
                    <IconButton edge="start" color="inherit" onClick={props.onFileSelector}>
                        <FolderOpenIcon />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" className={classes.title}>
                    {props.title}
                </Typography>
                <Tooltip title="Donate">
                    <IconButton
                        edge="end"
                        color="inherit"
                        component="a"
                        href="https://github.com/sponsors/killergerbah?frequency=one-time"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <FavoriteIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Submit Issue">
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
                <Tooltip title="Help">
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
                <Tooltip title="Settings">
                    <IconButton edge="end" color="inherit" onClick={props.onOpenSettings}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
                <CopyHistoryTooltip title="Copy History" show={!props.drawerOpen}>
                    <IconButton
                        edge="end"
                        color="inherit"
                        aria-label="menu"
                        className={clsx(classes.copyHistoryButton, {
                            [classes.copyHistoryButtonShift]: props.drawerOpen,
                        })}
                        onClick={props.onOpenCopyHistory}
                    >
                        <ListIcon />
                    </IconButton>
                </CopyHistoryTooltip>
            </Toolbar>
        </AppBar>
    );
}
