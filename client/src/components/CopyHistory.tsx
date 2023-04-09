import React, { useCallback, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { timeDurationDisplay } from '../services/util';
import { ListItemSecondaryAction, Theme } from '@material-ui/core';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Popover from '@material-ui/core/Popover';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import NoteAddIcon from '@material-ui/icons/NoteAdd';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { AudioModel, ImageModel, SubtitleModel } from '@project/common';

export interface CopyHistoryItem extends SubtitleModel {
    name: string;
    id: string;
    timestamp: number;
    surroundingSubtitles: SubtitleModel[];
    audioFile?: File;
    audioFileName?: string;
    audioTrack?: string;
    videoFile?: File;
    videoFileName?: string;
    filePlaybackRate?: number;
    subtitleFileName?: string;
    mediaTimestamp?: number;
    audio?: AudioModel;
    image?: ImageModel;
    url?: string;
}

interface CopyHistoryProps {
    open: boolean;
    drawerWidth: number;
    items: CopyHistoryItem[];
    onClose: () => void;
    onDelete: (item: CopyHistoryItem) => void;
    onAnki: (item: CopyHistoryItem) => void;
    onSelect: (item: CopyHistoryItem) => void;
    onClipAudio: (item: CopyHistoryItem) => void;
    onDownloadImage: (item: CopyHistoryItem) => void;
    onDownloadSectionAsSrt: (name: string, items: CopyHistoryItem[]) => void;
}

const useStyles = makeStyles<Theme, CopyHistoryProps, string>((theme) => ({
    drawer: {
        width: ({ drawerWidth }) => drawerWidth,
        flexShrink: 0,
    },
    drawerPaper: {
        width: ({ drawerWidth }) => drawerWidth,
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
        overflowX: 'hidden',
    },
    listItem: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
    },
    listItemGutters: {
        paddingLeft: 5,
        paddingRight: 5,
    },
    listItemIconRoot: {
        minWidth: 20,
    },
    emptyState: {
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        textAlign: 'center',
        height: '100%',
        padding: 15,
    },
    text: {
        flexGrow: 1,
    },
    emptyText: {
        flexGrow: 1,
        color: theme.palette.text.secondary,
    },
    timestamp: {
        paddingRight: 15,
        paddingLeft: 15,
        color: theme.palette.text.secondary,
    },
}));

interface MenuProps {
    open: boolean;
    item?: CopyHistoryItem;
    anchorEl?: Element;
    onClose: () => void;
    onSelect: (item: CopyHistoryItem) => void;
    onClipAudio: (item: CopyHistoryItem) => void;
    onDownloadImage: (item: CopyHistoryItem) => void;
    onDelete: (item: CopyHistoryItem) => void;
}

function Menu({ open, anchorEl, onClose, onSelect, onClipAudio, onDownloadImage, onDelete, item }: MenuProps) {
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(item!.text);
        onClose();
    }, [item, onClose]);

    const handleJumpTo = useCallback(() => {
        onSelect(item!);
        onClose();
    }, [item, onSelect, onClose]);

    const handleClipAudio = useCallback(() => {
        onClipAudio(item!);
        onClose();
    }, [item, onClipAudio, onClose]);

    const handleDownloadImage = useCallback(() => {
        onDownloadImage(item!);
        onClose();
    }, [item, onDownloadImage, onClose]);

    const handleDelete = useCallback(() => {
        onDelete(item!);
        onClose();
    }, [item, onDelete, onClose]);

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
            }}
        >
            <List>
                <ListItem button onClick={handleCopy}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Copy" />
                </ListItem>
                <ListItem button onClick={handleJumpTo}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Jump To" />
                </ListItem>
                {(item.videoFile || item.audioFile || item.audio) && (
                    <ListItem button onClick={handleClipAudio}>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Download Audio" />
                    </ListItem>
                )}
                {(item.videoFile || item.image) && (
                    <ListItem button onClick={handleDownloadImage}>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Download Image" />
                    </ListItem>
                )}
                <ListItem button onClick={handleDelete}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Delete" />
                </ListItem>
            </List>
        </Popover>
    );
}

export default function CopyHistory(props: CopyHistoryProps) {
    const onDelete = props.onDelete;
    const classes = useStyles(props);
    const scrollToBottomRefCallback = useCallback((element: HTMLElement | null) => {
        if (element) {
            element.scrollIntoView();
        }
    }, []);
    const [menuItem, setMenuItem] = useState<CopyHistoryItem>();
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<Element>();

    const handleMenu = useCallback((e: React.MouseEvent, item: CopyHistoryItem) => {
        setMenuItem(item);
        setMenuOpen(true);
        setMenuAnchorEl(e.currentTarget);
    }, []);

    const handleMenuClosed = useCallback(() => {
        setMenuItem(undefined);
        setMenuOpen(false);
        setMenuAnchorEl(undefined);
    }, []);

    const handleDelete = useCallback(
        (item: CopyHistoryItem) => {
            onDelete(item);
        },
        [onDelete]
    );

    let content;

    if (props.items.length > 0) {
        const items = [];
        let lastSeenItemName = null;
        let i = 0;
        const itemNameCounters: { [name: string]: number } = {};
        let itemsBySection: { [key: string]: CopyHistoryItem[] } = {};
        let currentKey: string | undefined;

        for (const item of props.items) {
            if (lastSeenItemName === null || lastSeenItemName !== item.name) {
                if (item.name in itemNameCounters) {
                    itemNameCounters[item.name]++;
                } else {
                    itemNameCounters[item.name] = 0;
                }

                const key = item.name + '-' + itemNameCounters[item.name];
                itemsBySection[key] = [];
                lastSeenItemName = item.name;
                currentKey = key;

                items.push(
                    <ListItem key={key}>
                        <Typography color="textSecondary">{item.name}</Typography>
                        <ListItemSecondaryAction>
                            <Tooltip title="Download as SRT">
                                <IconButton
                                    onClick={() => props.onDownloadSectionAsSrt(item.name, itemsBySection[key])}
                                    edge="end"
                                >
                                    <SaveAltIcon />
                                </IconButton>
                            </Tooltip>
                        </ListItemSecondaryAction>
                    </ListItem>
                );
            }

            itemsBySection[currentKey!].push(item);
            const ref = i === props.items.length - 1 ? scrollToBottomRefCallback : null;

            items.push(
                <ListItem
                    ref={ref}
                    key={item.id}
                    className={classes.listItem}
                    classes={{ gutters: classes.listItemGutters }}
                >
                    <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                        <Tooltip title="Export to Anki">
                            <IconButton onClick={() => props.onAnki(item)}>
                                <NoteAddIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </ListItemIcon>
                    <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                        <IconButton onClick={(e) => handleMenu(e, item)}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Grid wrap="nowrap" container>
                                <Grid item className={item.text === '' ? classes.emptyText : classes.text}>
                                    {item.text === '' ? 'No text' : item.text}
                                </Grid>
                                <Grid item className={classes.timestamp}>
                                    {timeDurationDisplay(item.start, item.start, false)}
                                </Grid>
                            </Grid>
                        }
                    />
                </ListItem>
            );

            ++i;
        }

        content = (
            <div className={classes.listContainer}>
                <List>{items}</List>
            </div>
        );
    } else {
        content = (
            <div className={classes.emptyState}>
                <Typography variant="h6">Mining history is empty.</Typography>
            </div>
        );
    }

    return (
        <React.Fragment>
            <Drawer
                variant="persistent"
                anchor="right"
                open={props.open}
                className={classes.drawer}
                classes={{
                    paper: classes.drawerPaper,
                }}
            >
                <div className={classes.drawerHeader}>
                    <IconButton onClick={props.onClose}>
                        <ChevronRightIcon />
                    </IconButton>
                </div>
                <Divider />
                {content}
            </Drawer>
            <Menu
                open={props.open && menuOpen}
                anchorEl={menuAnchorEl}
                item={menuItem}
                onClose={handleMenuClosed}
                onSelect={props.onSelect}
                onClipAudio={props.onClipAudio}
                onDownloadImage={props.onDownloadImage}
                onDelete={handleDelete}
            />
        </React.Fragment>
    );
}
