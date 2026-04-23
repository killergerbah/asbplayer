import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAppBarHeight } from '@project/common/hooks/use-app-bar-height';
import Drawer from '@project/common/components/Drawer';
import { CopyHistoryItem } from '@project/common';
import { useTranslation } from 'react-i18next';
import CopyHistoryList from './CopyHistoryList';

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

export default function CopyHistory(props: CopyHistoryProps) {
    const { t } = useTranslation();
    const appBarHeight = useAppBarHeight();

    return (
        <Drawer showBackButton={false} open={props.open} drawerWidth={props.drawerWidth} onClose={props.onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <Paper
                    square
                    sx={{
                        height: appBarHeight === 0 ? 'auto' : appBarHeight,
                        px: 1,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Typography variant="h6" sx={{ flexGrow: 1, pl: 1 }}>
                        {`${t('bar.miningHistory')} (${props.items.length})`}
                    </Typography>
                    <IconButton onClick={props.onClose}>
                        <ChevronRightIcon />
                    </IconButton>
                </Paper>
                <Divider />
                <CopyHistoryList {...props} />
            </div>
        </Drawer>
    );
}
