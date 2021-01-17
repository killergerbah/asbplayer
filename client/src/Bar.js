import { makeStyles } from '@material-ui/core/styles';
import { useParams } from 'react-router-dom';
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import ListIcon from '@material-ui/icons/List';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
    root: {
        height: '64px'
    },
    title: {
        flexGrow: 1,
    },
}));

export default function Bar(props) {
    const classes = useStyles();

    // If we are in browser
    let { path } = useParams();

    if (!path) {
        // If we are in player
        const params = new URLSearchParams(window.location.search);
        path = params.get('name');
    }

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    {path || '/'}
                </Typography>
                <IconButton edge="end" color="inherit" aria-label="menu" onClick={props.onOpenCopyHistory}>
                    <ListIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
}