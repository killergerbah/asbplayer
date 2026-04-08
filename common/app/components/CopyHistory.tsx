import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { CopyHistoryItem } from '@project/common';
import CopyHistoryList from './CopyHistoryList';
import { useTranslation } from 'react-i18next';

interface CopyHistoryProps {
    open: boolean;
    drawerWidth?: number;
    items: CopyHistoryItem[];
    forceShowDownloadOptions?: boolean;
    onClose: () => void;
    onDelete: (item: CopyHistoryItem) => void;
    onDeleteAll: () => void;
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
    headerTitle: {
        flexGrow: 1,
        marginLeft: theme.spacing(1),
    },
}));

export default function CopyHistory(props: CopyHistoryProps) {
    const classes = useStyles(props);
    const { t } = useTranslation();

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
            <Paper className={classes.drawerHeader}>
                <Typography variant="h6" className={classes.headerTitle}>
                    {`${t('bar.miningHistory')} (${props.items.length})`}
                </Typography>
                <IconButton onClick={props.onClose}>
                    <ChevronRightIcon />
                </IconButton>
            </Paper>
            <Divider />
            <CopyHistoryList {...props} />
        </Drawer>
    );
}
