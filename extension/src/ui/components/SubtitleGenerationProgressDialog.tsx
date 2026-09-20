import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import type { SubtitleGenerationUiState } from '@project/common';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    generation: SubtitleGenerationUiState;
    onPoll: (jobId: string) => void;
    onCancel: (jobId: string) => void;
    onClose: () => void;
}

const activeStates = new Set([
    'queued',
    'downloading',
    'loading-model',
    'transcribing',
    'analyzing-video',
    'recognizing-text',
]);
const jobPollIntervalMs = 1_000;

const formatRemainingTime = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondsPart = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(secondsPart).padStart(2, '0');
    return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`;
};

/** A non-editable progress window displayed for the lifetime of a subtitle job. */
export default function SubtitleGenerationProgressDialog({ open, generation, onPoll, onCancel, onClose }: Props) {
    const { t } = useTranslation();
    const activeJob = generation.job && activeStates.has(generation.job.state) ? generation.job : undefined;
    const activeJobId = activeJob?.id;

    useEffect(() => {
        if (!activeJobId) return;
        onPoll(activeJobId);
        const timer = window.setInterval(() => onPoll(activeJobId), jobPollIntervalMs);
        return () => window.clearInterval(timer);
    }, [activeJobId, onPoll]);

    const close = () => {
        if (activeJob) onCancel(activeJob.id);
        onClose();
    };

    const ocr = (activeJob?.generator ?? generation.generator) === 'ocr';
    const stateText =
        ocr && activeJob?.state === 'downloading' && activeJob.progress !== undefined
            ? `${t('extension.ocrExtraction.downloadingVideo')} (${activeJob.progress}%)`
            : ocr && activeJob?.state === 'downloading'
              ? t('extension.ocrExtraction.downloadingVideo')
              : ocr && activeJob?.state === 'loading-model'
                ? t('extension.ocrExtraction.loadingModel')
                : ocr && activeJob?.state === 'analyzing-video'
                  ? t('extension.ocrExtraction.analyzingVideo')
                  : ocr && activeJob?.state === 'recognizing-text'
                    ? activeJob.progress === undefined
                        ? t('extension.ocrExtraction.recognizingText')
                        : `${t('extension.ocrExtraction.recognizingText')} (${activeJob.progress}%)`
                    : activeJob?.state === 'downloading' && activeJob.progress !== undefined
                      ? t('extension.subtitleGeneration.downloading', { progress: activeJob.progress })
                      : activeJob?.state === 'loading-model' && activeJob.progress !== undefined
                        ? t('extension.subtitleGeneration.downloadingModel', { progress: activeJob.progress })
                        : activeJob?.state === 'loading-model'
                          ? t('extension.subtitleGeneration.loadingModel')
                          : activeJob?.state === 'transcribing'
                            ? activeJob.progress === undefined
                                ? t('extension.subtitleGeneration.transcribing')
                                : `${t('extension.subtitleGeneration.transcribing')} (${activeJob.progress}%)`
                            : t('extension.subtitleGeneration.queued');

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>{t(ocr ? 'extension.ocrExtraction.title' : 'extension.subtitleGeneration.title')}</DialogTitle>
            <DialogContent>
                {generation.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generation.error}
                    </Alert>
                )}
                {generation.job?.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generation.job.error}
                    </Alert>
                )}
                {activeJob && (
                    <Box sx={{ mb: 2 }}>
                        <Typography aria-live="polite" variant="body2" sx={{ mb: 1 }}>
                            {stateText}
                        </Typography>
                        <LinearProgress
                            variant={activeJob.progress !== undefined ? 'determinate' : 'indeterminate'}
                            value={activeJob.progress}
                        />
                        {activeJob.modelDownloaded !== undefined && activeJob.modelTotal !== undefined && (
                            <Typography aria-live="polite" variant="caption" sx={{ display: 'block', mt: 1 }}>
                                {t('extension.subtitleGeneration.modelProgress', {
                                    current: activeJob.modelDownloaded,
                                    total: activeJob.modelTotal,
                                })}
                            </Typography>
                        )}
                        {activeJob.completedFrames !== undefined && activeJob.totalFrames !== undefined && (
                            <Typography aria-live="polite" variant="caption" sx={{ display: 'block', mt: 1 }}>
                                {t('extension.subtitleGeneration.frameProgress', {
                                    current: activeJob.completedFrames.toLocaleString(),
                                    total: activeJob.totalFrames.toLocaleString(),
                                })}
                            </Typography>
                        )}
                        {activeJob.remainingSeconds !== undefined && activeJob.remainingSeconds > 0 && (
                            <Typography aria-live="polite" variant="caption" sx={{ display: 'block' }}>
                                {t('extension.subtitleGeneration.timeRemaining', {
                                    time: formatRemainingTime(activeJob.remainingSeconds),
                                })}
                            </Typography>
                        )}
                    </Box>
                )}
                {!activeJob && !generation.error && !generation.job?.error && generation.job?.state !== 'completed' && (
                    <Box sx={{ mb: 2 }}>
                        <Typography aria-live="polite" variant="body2" sx={{ mb: 1 }}>
                            {t('extension.subtitleGeneration.queued')}
                        </Typography>
                        <LinearProgress />
                    </Box>
                )}
                {generation.job?.state === 'completed' && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {t('extension.subtitleGeneration.completed')}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                {activeJob ? (
                    <Button onClick={close}>{t('extension.subtitleGeneration.cancel')}</Button>
                ) : (
                    <Button onClick={onClose}>{t('extension.subtitleGeneration.close')}</Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
