import Drawer from '@project/common/components/Drawer';
import { CopyHistoryItem } from '@project/common';
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
    return (
        <Drawer open={props.open} showBackButton drawerWidth={props.drawerWidth} onClose={props.onClose}>
            <CopyHistoryList {...props} />
        </Drawer>
    );
}
