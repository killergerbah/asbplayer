import { makeStyles } from '@material-ui/core/styles';
import { Theme } from '@material-ui/core';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import IconButton from '@material-ui/core/IconButton';
import { CopyHistoryItem } from '@project/common';
import CopyHistoryList from './CopyHistoryList';

interface CopyHistoryProps {
    open: boolean;
    drawerWidth?: number;
    items: CopyHistoryItem[];
    onClose: () => void;
    onDelete: (item: CopyHistoryItem) => void;
    onAnki: (item: CopyHistoryItem) => void;
    onSelect?: (item: CopyHistoryItem) => void;
    onClipAudio: (item: CopyHistoryItem) => void;
    onDownloadImage: (item: CopyHistoryItem) => void;
    onDownloadSectionAsSrt?: (name: string, items: CopyHistoryItem[]) => void;
}

const useStyles = makeStyles<Theme, CopyHistoryProps, string>((theme) => ({
    drawer: {
        width: ({ drawerWidth }) => drawerWidth ?? '100%',
        flexShrink: 0,
    },
    drawerPaper: {
        width: ({ drawerWidth }) => drawerWidth ?? '100%',
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
}));

export default function CopyHistory(props: CopyHistoryProps) {
    const classes = useStyles(props);

    return (
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
            <CopyHistoryList {...props} />
        </Drawer>
    );
}
