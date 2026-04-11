import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import StatisticsSentenceDetailsDialog from './StatisticsSentenceDetailsDialog';

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
            <Typography>{label}</Typography>
            <Typography sx={{ textDecoration }}>{value}</Typography>
        </Box>
    );
};

export interface StatisticsOverlayProps {
    dictionaryProvider: DictionaryProvider;
    open: boolean;
    onOpenStatistics: () => void;
    onOpen: () => void;
    onClose: () => void;
    sx?: SxProps<Theme>;
}

const StatisticsOverlay: React.FC<StatisticsOverlayProps> = ({
    dictionaryProvider,
    open,
    onOpenStatistics,
    onOpen,
    onClose,
    sx,
}) => {
    const { t } = useTranslation();
    const [trackSnapshots, setTrackSnapshots] = useState<DictionarySimplifiedStatisticsTrackSnapshot[]>();
    const [sentenceDetailsOpen, setSentenceDetailsOpen] = useState<boolean>(false);
    const [mediaId, setMediaId] = useState<string>();
    useEffect(() => {
        const unsubscribeStatistics = dictionaryProvider.onStatisticsSnapshot(
            (snapshot?: DictionaryStatisticsSnapshot) => {
                const nextTrackSnapshots = processSimplifiedDictionaryStatistics(snapshot);
                setMediaId(snapshot?.mediaId);
                setTrackSnapshots(nextTrackSnapshots);
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

    const handleOpenSentenceDetails = useCallback(() => setSentenceDetailsOpen(true), []);
    const handleCloseSentenceDetails = useCallback(() => setSentenceDetailsOpen(false), []);
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
                variant="elevation"
                sx={{
                    background: (theme) => alpha(theme.palette.background.paper, 0.7),
                    zIndex: (theme) => theme.zIndex.modal,
                    p: 1,
                    ...(sx ?? {}),
                }}
            >
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <BarChartIcon color="primary" />
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
                        <IconButton size="small" onClick={onOpenStatistics}>
                            <OpenInNewIcon />
                        </IconButton>
                        <IconButton size="small" onClick={onClose}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
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
};

export default StatisticsOverlay;
