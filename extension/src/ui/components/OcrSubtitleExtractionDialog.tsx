import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import type { OcrLanguage, OcrOptions, OcrQuality, SubtitleGenerationUiState } from '@project/common';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    generation: SubtitleGenerationUiState;
    onStart: (options: OcrOptions) => void;
    onClose: () => void;
}

/** Configure Chinese OCR without requiring an unreliable browser frame capture. */
export default function OcrSubtitleExtractionDialog({ open, generation, onStart, onClose }: Props) {
    const { t } = useTranslation();
    const [language, setLanguage] = useState<OcrLanguage>('ch');
    const [quality, setQuality] = useState<OcrQuality>('medium');
    const available = generation.capabilities?.ocr?.available === true;

    useEffect(() => {
        if (!open) return;
        setLanguage('ch');
        setQuality('medium');
    }, [open]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{t('extension.ocrExtraction.title')}</DialogTitle>
            <DialogContent>
                {generation.error && <Alert severity="error">{generation.error}</Alert>}
                {generation.capabilities?.ocr?.error && (
                    <Alert severity="error">{generation.capabilities.ocr.error}</Alert>
                )}
                {generation.state === 'ready' && !generation.capabilities?.ocr && (
                    <Alert severity="error">
                        This subtitle generation service does not support burned-in subtitle OCR. Update the service and
                        install its OCR extra.
                    </Alert>
                )}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        fullWidth
                        select
                        label={t('extension.ocrExtraction.language')}
                        value={language}
                        onChange={(event) => setLanguage(event.target.value as OcrLanguage)}
                    >
                        <MenuItem value="ch">{t('extension.ocrExtraction.simplifiedChinese')}</MenuItem>
                        <MenuItem value="chinese_cht">{t('extension.ocrExtraction.traditionalChinese')}</MenuItem>
                    </TextField>
                    <TextField
                        fullWidth
                        select
                        label={t('extension.ocrExtraction.quality')}
                        value={quality}
                        onChange={(event) => setQuality(event.target.value as OcrQuality)}
                    >
                        <MenuItem value="medium">{t('extension.ocrExtraction.medium')}</MenuItem>
                        <MenuItem value="small">{t('extension.ocrExtraction.small')}</MenuItem>
                    </TextField>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('extension.subtitleGeneration.close')}</Button>
                <Button disabled={!available} onClick={() => onStart({ language, quality })}>
                    {t('extension.ocrExtraction.extract')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
