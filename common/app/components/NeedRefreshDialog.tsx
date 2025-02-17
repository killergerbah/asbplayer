import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    onRefresh: () => void;
    onClose: () => void;
}

const NeedRefreshDialog = ({ open, onRefresh, onClose }: Props) => {
    const { t } = useTranslation();
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{t('app.pwaUpdatePromptTitle')}</DialogTitle>
            <DialogContent>{t('app.pwaUpdatePromptBody')}</DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
                <Button onClick={onRefresh}>{t('action.ok')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default NeedRefreshDialog;
