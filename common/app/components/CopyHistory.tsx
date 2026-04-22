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

    return (
        <Drawer showBackButton open={props.open} drawerWidth={props.drawerWidth} onClose={props.onClose}>
            <CopyHistoryList {...props} title={`${t('bar.miningHistory')} (${props.items.length})`} />
        </Drawer>
    );
}
