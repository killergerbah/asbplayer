import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { DictionaryProvider } from '../dictionary-db';
import {
    DictionarySimplifiedStatisticsTrackSnapshot,
    DictionaryStatisticsSnapshot,
    percentDisplay,
    processSimplifiedDictionaryStatistics,
} from '../dictionary-statistics';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import StatisticsSentenceDetailsDialog from './StatisticsSentenceDetailsDialog';
import LogoIcon from './LogoIcon';
import LinearProgress from '@mui/material/LinearProgress';

interface StatisticProps {
    label: string;
    value: string | number;
    onClick?: () => void;
}

const Statistic: React.FC<StatisticProps> = ({ label, value, onClick }) => {
    const hoverProps: SxProps<Theme> =
        onClick === undefined
            ? {}
            : {
                  cursor: 'pointer',
                  background: (theme: Theme) => alpha(theme.palette.action.hover, theme.palette.action.hoverOpacity),
              };
    const textDecoration = onClick === undefined ? 'auto' : 'underline';
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                pl: 0.75,
                pr: 0.75,
                borderRadius: 1,
                '&:hover': hoverProps,
            }}
            onClick={onClick}
        >
            <Typography variant="subtitle2">{label}</Typography>
            <Typography variant="subtitle2" sx={{ textDecoration }}>
                {value}
            </Typography>
        </Box>
    );
};

export interface StatisticsOverlayProps {
    dictionaryProvider: DictionaryProvider;
    open: boolean;
    onOpenStatistics: () => void;
    onReceivedSnapshot: (mediaId: string) => void;
    onClose: () => void;
    onSentenceDetailsWereOpened?: () => void;
    onSentenceDetailsWereClosed?: () => void;
    sx?: SxProps<Theme>;
}

const StatisticsOverlay = React.forwardRef<HTMLDivElement, StatisticsOverlayProps>(function StatisticsOverlay(
    {
        dictionaryProvider,
        open,
        onOpenStatistics,
        onReceivedSnapshot,
        onClose,
        onSentenceDetailsWereOpened,
        onSentenceDetailsWereClosed,
        sx,
    },
    ref
) {
    const { t } = useTranslation();
    const [trackSnapshots, setTrackSnapshots] = useState<DictionarySimplifiedStatisticsTrackSnapshot[]>();
    const [sentenceDetailsOpen, setSentenceDetailsOpen] = useState<boolean>(false);
    const [mediaId, setMediaId] = useState<string>();
    const onReceivedSnapshotRef = useRef<(mediaId: string) => void>(onReceivedSnapshot);
    onReceivedSnapshotRef.current = onReceivedSnapshot;
    useEffect(() => {
        const unsubscribeStatistics = dictionaryProvider.onStatisticsSnapshot(
            (snapshot?: DictionaryStatisticsSnapshot) => {
                const nextTrackSnapshots = processSimplifiedDictionaryStatistics(snapshot);
                setMediaId(snapshot?.mediaId);
                setTrackSnapshots(nextTrackSnapshots);
                if (snapshot?.mediaId !== undefined) {
                    onReceivedSnapshotRef.current?.(snapshot.mediaId);
                }
            }
        );
        void dictionaryProvider.requestStatisticsSnapshot();
        return () => {
            unsubscribeStatistics();
        };
    }, [dictionaryProvider]);

    const bestTrackSnapshot = useMemo(() => {
        if (trackSnapshots === undefined || trackSnapshots.length === 0) {
            return undefined;
        }
        let best = trackSnapshots[0];
        for (const s of trackSnapshots) {
            if (s.comprehensionPercent > best.comprehensionPercent) {
                best = s;
            }
        }
        return best;
    }, [trackSnapshots]);
    const iPlusOneSentenceBucket = bestTrackSnapshot?.sentenceBuckets.uncollected.find((b) => b.tokenCount === 1);
    const iPlusOneSentenceCount = iPlusOneSentenceBucket?.entries?.length ?? 0;
    const iPlusOneLabel = `1 ${t('settings.dictionaryTokenStatus0')}`;

    const handleOpenSentenceDetails = useCallback(() => {
        setSentenceDetailsOpen(true);
        onSentenceDetailsWereOpened?.();
    }, [onSentenceDetailsWereOpened]);
    const handleCloseSentenceDetails = useCallback(() => {
        setSentenceDetailsOpen(false);
        onSentenceDetailsWereClosed?.();
    }, [onSentenceDetailsWereClosed]);
    const handleSeekToSentence = useCallback(
        (timestamp: number) => {
            if (!mediaId) {
                return;
            }
            dictionaryProvider.requestStatisticsSeek(mediaId, timestamp);
        },
        [mediaId, dictionaryProvider]
    );
    const handleMineSentence = useCallback(
        (index: number) => {
            if (!mediaId) {
                return;
            }
            dictionaryProvider.requestStatisticsMineSentences(mediaId, [index]);
        },
        [mediaId, dictionaryProvider]
    );

    return (
        <Fade in={bestTrackSnapshot !== undefined && open} timeout={250}>
            <Paper
                ref={ref}
                variant="elevation"
                sx={{
                    background: (theme) => alpha(theme.palette.background.paper, 0.7),
                    zIndex: (theme) => theme.zIndex.modal,
                    p: 1,
                    position: 'relative',
                    ...(sx ?? {}),
                }}
            >
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <LogoIcon sx={{ m: 0.5 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {bestTrackSnapshot && (
                            <Statistic
                                label={t('statistics.comprehension')}
                                value={percentDisplay(bestTrackSnapshot.comprehensionPercent)}
                            />
                        )}
                        <Statistic
                            label={`1 ${t('settings.dictionaryTokenStatus0')}`}
                            value={iPlusOneSentenceCount}
                            onClick={iPlusOneSentenceCount > 0 ? handleOpenSentenceDetails : undefined}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={onOpenStatistics}>
                            <BarChartIcon />
                        </IconButton>
                        <IconButton onClick={onClose}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
                {bestTrackSnapshot && bestTrackSnapshot.progress.current < bestTrackSnapshot.progress.total && (
                    <LinearProgress
                        variant={bestTrackSnapshot.progress.current > 0 ? 'determinate' : 'indeterminate'}
                        value={(bestTrackSnapshot.progress.current / bestTrackSnapshot.progress.total) * 100}
                        sx={{
                            position: 'absolute',
                            width: (theme) => `calc(100% - ${theme.spacing(0.5)})`,
                            left: (theme) => theme.spacing(0.25),
                            bottom: -1,
                            borderRadius: 0,
                            height: 2,
                        }}
                    />
                )}
                {iPlusOneSentenceBucket && bestTrackSnapshot && (
                    <StatisticsSentenceDetailsDialog
                        open={sentenceDetailsOpen}
                        title={iPlusOneLabel}
                        subtitles={[iPlusOneLabel]}
                        entries={iPlusOneSentenceBucket.entries}
                        totalSentences={bestTrackSnapshot.progress.total}
                        miningEnabled
                        onClose={handleCloseSentenceDetails}
                        onSeekToSentence={(s) => handleSeekToSentence(s.start)}
                        onMineSentence={(s) => handleMineSentence(s.index)}
                    />
                )}
            </Paper>
        </Fade>
    );
});

export default StatisticsOverlay;
