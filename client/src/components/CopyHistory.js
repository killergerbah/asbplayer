import React, { useCallback, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import Popover from '@material-ui/core/Popover';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import StarIcon from '@material-ui/icons/Star';
import Tooltip from '@material-ui/core/Tooltip';

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
    listItem: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover
        }
    },
    listItemGutters: {
        paddingLeft: 5,
        paddingRight: 5
    },
    listItemIconRoot: {
        minWidth: 20
    }
}));

function Menu(props) {
    const {open, anchorEl, onClose, onSelect, onClipAudio, onDownloadImage, item} = props;

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(item.text);
        onClose();
    }, [item, onClose]);

    const handleJumpTo = useCallback(() => {
        onSelect(item);
        onClose();
    }, [item, onSelect, onClose]);

    const handleClipAudio = useCallback(() => {
        onClipAudio(item);
        onClose();
    }, [item, onClipAudio, onClose]);

    const handleDownloadImage = useCallback(() => {
        onDownloadImage(item);
        onClose();
    }, [item, onDownloadImage, onClose]);

    if (!item) {
        return null;
    }

    return (
        <Popover
            disableEnforceFocus={true}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'center',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}>
            <List>
                <ListItem button onClick={handleCopy}>
                    <ListItemText primaryTypographyProps={{variant: "body2"}} primary="Copy" />
                </ListItem>
                <ListItem button onClick={handleJumpTo}>
                    <ListItemText primaryTypographyProps={{variant: "body2"}} primary="Jump To" />
                </ListItem>
                {(item.videoFile || item.audioFile || item.audio) && (
                    <ListItem button onClick={handleClipAudio}>
                        <ListItemText primaryTypographyProps={{variant: "body2"}} primary="Download Audio" />
                    </ListItem>
                )}
                {(item.videoFile || item.image) && (
                    <ListItem button onClick={handleDownloadImage}>
                        <ListItemText primaryTypographyProps={{variant: "body2"}} primary="Download Image" />
                    </ListItem>
                )}
            </List>
        </Popover>
    );
}

export default function CopyHistory(props) {
    const classes = useStyles(props.drawerWidth)();
    const scrollToBottomRefCallback =  useCallback(element => {
        if (element) {
            element.scrollIntoView();
        }
    }, []);
    const [menuItem, setMenuItem] = useState();
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState();

    const handleMenu = useCallback((e, item) => {
        setMenuItem(item);
        setMenuOpen(true);
        setMenuAnchorEl(e.currentTarget);
    }, []);

    const handleMenuClosed = useCallback((e, item) => {
        setMenuItem(null);
        setMenuOpen(false);
        setMenuAnchorEl(null);
    }, []);

    const handleDelete = useCallback((item) => {
        props.onDelete(item);
    }, [props]);

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

            content.push((
                <ListItem
                    ref={ref}
                    key={item.timestamp}
                    className={classes.listItem}
                    classes={{gutters: classes.listItemGutters}}
                >
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <Tooltip title="Export to Anki">
                            <IconButton onClick={() => props.onAnki(item)}>
                                <StarIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </ListItemIcon>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton onClick={(e) => handleMenu(e, item)}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemText>{item.text}</ListItemText>
                    <ListItemIcon classes={{root: classes.listItemIconRoot}}>
                        <IconButton onClick={() => handleDelete(item)}>
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
        <React.Fragment>
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
            <Menu
                open={props.open && menuOpen}
                anchorEl={menuAnchorEl}
                item={menuItem}
                onClose={handleMenuClosed}
                onSelect={props.onSelect}
                onClipAudio={props.onClipAudio}
                onDownloadImage={props.onDownloadImage}
            />
        </React.Fragment>
    );
}
