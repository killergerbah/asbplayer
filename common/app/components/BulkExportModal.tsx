import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

interface BulkExportModalProps {
    open: boolean;
    currentIndex: number; // completed count
    totalItems: number; // total count
    onCancel: () => void;
}

export default function BulkExportModal({ open, currentIndex, totalItems, onCancel }: BulkExportModalProps) {
    const { t } = useTranslation();
    const progress = totalItems > 0 ? (currentIndex / totalItems) * 100 : 0;
    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
                onCancel();
            }}
            fullWidth
            maxWidth="sm"
            aria-labelledby="bulk-export-title"
            aria-describedby="bulk-export-description"
            disableEscapeKeyDown
            sx={{
                '& .MuiDialog-paper': {
                    bgcolor: 'background.default',
                },
            }}
            BackdropProps={{ sx: { backgroundColor: 'rgba(0, 0, 0, 1)' } }}
        >
            <DialogTitle id="bulk-export-title">{t('info.bulkExport.title', 'Bulk Export in Progress')}</DialogTitle>
            <DialogContent dividers>
                <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
                    <CircularProgress size={64} color="primary" />
                </Box>
                <Typography id="bulk-export-description" variant="body1" align="center" gutterBottom>
                    {t('info.bulkExport.description', 'Exporting subtitles to Anki. Please wait...')}
                </Typography>
                <Box width="100%" mt={3}>
                    <Typography variant="h6" align="center" gutterBottom>
                        {t('info.bulkExport.progressCompleted', 'Exported {{current}} of {{total}}', {
                            current: currentIndex,
                            total: totalItems,
                        })}
                    </Typography>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                </Box>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center' }}>
                <Button onClick={onCancel} variant="outlined" color="primary" data-testid="bulk-export-cancel-button">
                    {t('action.cancel', 'Cancel')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
