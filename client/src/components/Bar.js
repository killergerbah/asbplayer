import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import AppBar from '@material-ui/core/AppBar';
import BugReportIcon from '@material-ui/icons/BugReport';
import HelpIcon from '@material-ui/icons/Help';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import SettingsIcon from '@material-ui/icons/Settings';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
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
        width: ({drawerWidth}) => `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: ({drawerWidth}) => drawerWidth,
    },
    copyHistoryButton: {
        transform: 'scaleX(1)',
        width: 48,
        padding: 12,
        transition: theme.transitions.create(['transform', 'padding', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        })
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
        display: 'none'
    }
}));

export default function Bar(props) {
    const classes = useStyles(props);
    return (
        <AppBar
            position="static"
            className={clsx(classes.appBar, {
                [classes.appBarShift]: props.drawerOpen,
            })}
        >
            <Toolbar>
                <Tooltip title="Open Files">
                    <IconButton
                        edge="start"
                        color="inherit"
                        onClick={props.onFileSelector}
                    >
                        <FolderOpenIcon />
                    </IconButton>
                </Tooltip>
                <Typography variant="h6" className={classes.title}>
                    {props.title}
                </Typography>
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
                        onClick={props.onOpenHelp}
                    >
                        <HelpIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                    <IconButton
                        edge="end"
                        color="inherit"
                        onClick={props.onOpenSettings}
                    >
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Copy History">
                    <IconButton
                        edge="end"
                        color="inherit"
                        aria-label="menu"
                        onClick={props.onOpenCopyHistory}
                        className={clsx(classes.copyHistoryButton, {
                            [classes.copyHistoryButtonShift]: props.drawerOpen,
                        })}
                    >
                        <ListIcon />
                    </IconButton>
                </Tooltip>
            </Toolbar>
        </AppBar>
    );
}