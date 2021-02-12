import { useCallback } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import ForwardIcon from '@material-ui/icons/Forward';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';

const useStyles = (drawerWidth) => makeStyles((theme) => ({
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
    },
    drawerPaper: {
        width: drawerWidth,
    },
    drawerHeader: {
        display: 'flex',
        alignItems: 'center',
        position: 'static',
        padding: theme.spacing(0, 1),
        // necessary for content to be below app bar
        ...theme.mixins.toolbar,
        justifyContent: 'flex-start',
    },
    listContainer: {
        position: 'relative',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden'
    },
    listItemIconRoot: {
        minWidth: 20
    }
}));

export default function CopyHistory(props) {
    const classes = useStyles(props.drawerWidth)();
    const scrollToBottomRefCallback =  useCallback(element => {
        if (element) {
            element.scrollIntoView();
        }
    }, []);

    let content = null;

    if (props.items.length > 0) {
        content = [];
        let lastSeenItemName = null;
        let i = 0;

        for (const item of props.items) {
            if (lastSeenItemName === null || lastSeenItemName !== item.name) {
                lastSeenItemName = item.name;
                content.push((<ListSubheader disableSticky={true} key={item.name}>{item.name}</ListSubheader>));
            }

            const ref = i === props.items.length - 1 ? scrollToBottomRefCallback : null;
            console.log(item);
            content.push((
                <ListItem ref={ref} key={item.timestamp}>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton onClick={(e) => navigator.clipboard.writeText(item.text)}>
                            <FileCopyIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton disabled={!item.audioFile && !item.videoFile} onClick={() => props.onClipAudio(item)}>
                            <AudiotrackIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton onClick={() => props.onSelect(item)}>
                            <ForwardIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemText>{item.text}</ListItemText>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton onClick={() => props.onDelete(item)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                </ListItem>
            ));

            ++i;
        }

    } else {
        content = (<ListItem>Copy history is empty.</ListItem>);
    }

    const list = (<List>{content}</List>);

    return (
        <Drawer
            variant="persistent"
            anchor="right"
            open={props.open}
            className={classes.drawer}
            classes={{
                paper: classes.drawerPaper,
            }}>
            <div className={classes.drawerHeader}>
                <IconButton onClick={props.onClose}>
                    <ChevronRightIcon />
                </IconButton>
            </div>
            <Divider />
            <div className={classes.listContainer}>
                {list}
            </div>
        </Drawer>
    );
}
