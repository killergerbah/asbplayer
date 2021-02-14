import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';

const useStyles = (drawerWidth) => makeStyles((theme) => ({
    root: {
        height: '64px'
    },
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
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: drawerWidth,
    },
    hide: {
        display: 'none'
    }
}));

export default function Bar(props) {
    const classes = useStyles(props.drawerWidth)();

    return (
        <AppBar
            position="static"
            className={clsx(classes.appBar, {
                [classes.appBarShift]: props.drawerOpen,
            })}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    {props.title}
                </Typography>
                <IconButton
                    edge="end"
                    color="inherit"
                    aria-label="menu"
                    onClick={props.onOpenCopyHistory}
                    className={clsx(props.drawerOpen && classes.hide)}>
                    <ListIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
}