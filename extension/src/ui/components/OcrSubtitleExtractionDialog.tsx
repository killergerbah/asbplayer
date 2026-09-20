import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type {
    NormalizedOcrCrop,
    OcrLanguage,
    OcrOptions,
    OcrQuality,
    SubtitleGenerationUiState,
} from '@project/common';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    preview?: string;
    generation: SubtitleGenerationUiState;
    onStart: (options: OcrOptions) => void;
    onClose: () => void;
}

const defaultCrop: NormalizedOcrCrop = { left: 0, top: 0.65, width: 1, height: 0.35 };

/** Select the subtitle band from a screenshot captured before the modal was opened. */
export default function OcrSubtitleExtractionDialog({ open, preview, generation, onStart, onClose }: Props) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState<NormalizedOcrCrop>(defaultCrop);
    const [language, setLanguage] = useState<OcrLanguage>('ch');
    const [quality, setQuality] = useState<OcrQuality>('medium');
    const start = useRef<{ x: number; y: number } | undefined>(undefined);
    const available = generation.capabilities?.ocr?.available === true;

    useEffect(() => {
        if (!open) return;
        // Crop data is deliberately video-local; a new selector opening starts
        // from the lower-third default rather than reusing a previous video.
        setCrop(defaultCrop);
        setLanguage('ch');
        setQuality('medium');
    }, [open, preview]);

    const pointForEvent = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
    };

    const updateCrop = (point: { x: number; y: number }) => {
        if (!start.current) return;
        setCrop({
            left: Math.min(start.current.x, point.x),
            top: Math.min(start.current.y, point.y),
            width: Math.abs(point.x - start.current.x),
            height: Math.abs(point.y - start.current.y),
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{t('extension.ocrExtraction.title')}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>{t('extension.ocrExtraction.instructions')}</DialogContentText>
                {!preview && <Alert severity="warning">{t('extension.ocrExtraction.previewUnavailable')}</Alert>}
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
                {preview && (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Box
                            onPointerDown={(event) => {
                                start.current = pointForEvent(event);
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setCrop({ left: start.current.x, top: start.current.y, width: 0, height: 0 });
                            }}
                            onPointerMove={(event) => updateCrop(pointForEvent(event))}
                            onPointerUp={(event) => {
                                updateCrop(pointForEvent(event));
                                start.current = undefined;
                            }}
                            sx={{
                                position: 'relative',
                                display: 'inline-block',
                                maxWidth: '100%',
                                cursor: 'crosshair',
                                lineHeight: 0,
                                userSelect: 'none',
                            }}
                        >
                            <Box
                                component="img"
                                src={preview}
                                alt="Current video frame"
                                sx={{ display: 'block', maxWidth: '100%', maxHeight: 440 }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: `${crop.left * 100}%`,
                                    top: `${crop.top * 100}%`,
                                    width: `${crop.width * 100}%`,
                                    height: `${crop.height * 100}%`,
                                    border: '2px solid',
                                    borderColor: 'primary.main',
                                    backgroundColor: 'rgba(25, 118, 210, 0.16)',
                                    pointerEvents: 'none',
                                }}
                            />
                        </Box>
                    </Box>
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
                <Button
                    disabled={!available || !preview || crop.width <= 0 || crop.height <= 0}
                    onClick={() => onStart({ crop, language, quality })}
                >
                    {t('extension.ocrExtraction.extract')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
