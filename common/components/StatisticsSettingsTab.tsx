import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    DictionaryStatisticsFrequencyBucketStatusCounts,
    DictionaryStatisticsTrackSnapshot,
    DictionaryStatisticsRewatchSnapshot,
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSentenceBuckets,
    DictionaryStatisticsSentenceBucketStatus,
    DictionaryStatisticsSentenceTotals,
    DictionaryStatisticsSentenceStatusBucket,
    DictionaryStatisticsSnapshot,
    DictionaryStatisticsTokenStatusCounts,
} from '@project/common/dictionary-statistics';
import { getFullyKnownTokenStatus, TokenStatus } from '@project/common/settings';
import StatisticsSentenceDetailsDialog from '@project/common/components/StatisticsSentenceDetailsDialog';
import { useTranslation } from 'react-i18next';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Tooltip from '@mui/material/Tooltip';

interface Props {
    dictionaryProvider: DictionaryProvider;
    onSeekRequested?: (mediaId: string) => void;
    onMineRequested?: (mediaId: string) => void;
}

interface SentenceDialogState {
    track: number;
    scope: 'current' | 'projected';
    bucket: SentenceDialogBucket;
}

type SentenceDialogBucket =
    | {
          kind: 'allKnown';
      }
    | {
          kind: 'status';
          status: DictionaryStatisticsSentenceBucketStatus;
          groupIndex: number;
      };

const comprehensionBands = [
    { min: 0, max: 60, label: '<60', color: '#c62828', textColor: '#ffffff' },
    { min: 60, max: 70, label: '60+', color: '#ef6c00', textColor: '#ffffff' },
    { min: 70, max: 80, label: '70+', color: '#f9a825', textColor: '#111111' },
    { min: 80, max: 90, label: '80+', color: '#2e7d32', textColor: '#ffffff' },
    { min: 90, max: 95, label: '90+', color: '#1565c0', textColor: '#ffffff' },
    { min: 95, max: 100, label: '95+', color: 'primary.main', textColor: 'primary.contrastText' },
] as const;

const statusOrder: TokenStatus[] = [
    TokenStatus.MATURE,
    TokenStatus.YOUNG,
    TokenStatus.GRADUATED,
    TokenStatus.LEARNING,
    TokenStatus.UNKNOWN,
    TokenStatus.UNCOLLECTED,
];

const sentenceBucketStatusOrder: DictionaryStatisticsSentenceBucketStatus[] = [TokenStatus.UNCOLLECTED];
const emptySentenceBuckets: DictionaryStatisticsSentenceBuckets = {
    allKnown: {
        count: 0,
        entries: [],
    },
    byStatus: {
        [TokenStatus.UNCOLLECTED]: [],
    },
};

const percentDisplay = (value: number) => {
    const fractionDigits = value > 99 ? 3 : 1;
    return `${value.toFixed(fractionDigits)}%`;
};
const averageDisplay = (value: number) => value.toFixed(1);
const averageFromTotals = (total: number, count: number) => (count > 0 ? total / count : 0);
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const percent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const labelWithCount = (label: string, count: number) => `${label}: ${count}`;
const emptySentenceTotals: DictionaryStatisticsSentenceTotals = {
    processedSentenceCount: 0,
    totalWords: 0,
    totalKnownWords: 0,
    statusCounts: [],
};
const distributionBarHeight = 6;
const sentenceComprehensionBucketSize = 20;
const sentenceComprehensionBucketCount = 5;
const minimumComprehensionStatus = TokenStatus.UNKNOWN;
const fullyKnownTokenStatus = getFullyKnownTokenStatus();
const comprehensionStatusRange = fullyKnownTokenStatus - minimumComprehensionStatus;

interface SentenceComprehensionDistributionBucket {
    start: number;
    end: number;
    count: number;
}

function comprehensionScore(status: TokenStatus): number {
    return (Math.max(status, minimumComprehensionStatus) - minimumComprehensionStatus) / comprehensionStatusRange;
}

function comprehensionFromStatusOccurrences(statusCounts: DictionaryStatisticsTokenStatusCounts): number {
    let totalOccurrences = 0;
    let comprehensionSum = 0;
    for (const status of statusOrder) {
        const numOccurrences = statusCounts[status].numOccurrences;
        totalOccurrences += numOccurrences;
        comprehensionSum += numOccurrences * comprehensionScore(status);
    }
    return totalOccurrences > 0 ? (comprehensionSum / totalOccurrences) * 100 : 0;
}

function ComprehensionScale({ value }: { value: number }) {
    const clampedValue = clampPercent(value);
    return (
        <Box>
            <Box sx={{ position: 'relative', pt: 0.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        height: 18,
                        overflow: 'hidden',
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    {comprehensionBands.map((band) => (
                        <Box
                            key={band.label}
                            sx={{
                                width: `${band.max - band.min}%`,
                                backgroundColor: band.color,
                            }}
                        />
                    ))}
                </Box>
                <Box
                    sx={{
                        position: 'absolute',
                        top: -3,
                        bottom: -3,
                        left: `${clampedValue}%`,
                        width: 3,
                        transform: 'translateX(-50%)',
                        borderRadius: 999,
                        backgroundColor: 'text.primary',
                        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.65)',
                    }}
                />
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: comprehensionBands.map((band) => `${band.max - band.min}fr`).join(' '),
                    gap: 0.5,
                    mt: 0.75,
                }}
            >
                {comprehensionBands.map((band) => (
                    <Box
                        key={band.label}
                        sx={{
                            px: 0.5,
                            py: 0.25,
                            borderRadius: 0.5,
                            backgroundColor: band.color,
                            color: band.textColor,
                            textAlign: 'center',
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'inherit', lineHeight: 1.2 }}>
                            {band.label}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function FrequencyDistributionBar({
    totalPercent,
    count,
    statusCounts,
    statusColors,
}: {
    totalPercent: number;
    count: number;
    statusCounts: DictionaryStatisticsFrequencyBucketStatusCounts;
    statusColors: DictionaryStatisticsTrackSnapshot['statusColors'];
}) {
    const clampedTotalPercent = clampPercent(totalPercent);
    return (
        <Box
            sx={{
                position: 'relative',
                height: distributionBarHeight,
                overflow: 'hidden',
                borderRadius: 999,
                backgroundColor: 'grey.700',
            }}
        >
            {clampedTotalPercent > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: `${clampedTotalPercent}%`,
                        display: 'flex',
                        overflow: 'hidden',
                    }}
                >
                    {statusOrder.map((status) => {
                        const statusCount = statusCounts[status];
                        if (statusCount <= 0 || count <= 0) return null;
                        return (
                            <Box
                                key={status}
                                sx={{
                                    width: `${(statusCount / count) * 100}%`,
                                    backgroundColor: statusColors[status],
                                }}
                            />
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

function StatusDistributionBar({ value, color }: { value: number; color: string }) {
    const clampedValue = clampPercent(value);
    return (
        <Box
            sx={{
                position: 'relative',
                height: distributionBarHeight,
                overflow: 'hidden',
                borderRadius: 999,
                backgroundColor: 'grey.700',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${clampedValue}%`,
                    backgroundColor: color,
                }}
            />
        </Box>
    );
}

function comprehensionDistributionFromSentenceTotals(
    sentenceTotals: DictionaryStatisticsSentenceTotals
): SentenceComprehensionDistributionBucket[] {
    const comprehensionDistribution = Array.from(
        {
            length: sentenceComprehensionBucketCount,
        },
        (_, index) => ({
            start: index * sentenceComprehensionBucketSize,
            end: (index + 1) * sentenceComprehensionBucketSize,
            count: 0,
        })
    );
    for (const sentenceStatusCounts of sentenceTotals.statusCounts) {
        const comprehensionPercent = comprehensionFromStatusOccurrences(sentenceStatusCounts);
        const bucketIndex = Math.min(
            comprehensionDistribution.length - 1,
            Math.floor(comprehensionPercent / sentenceComprehensionBucketSize)
        );
        comprehensionDistribution[bucketIndex].count += 1;
    }
    return comprehensionDistribution;
}

function comprehensionDistributionLabel(bucket: SentenceComprehensionDistributionBucket) {
    return `${bucket.start}-${bucket.end}%`;
}

function SentenceComprehensionDistribution({
    buckets,
    totalSentences,
}: {
    buckets: SentenceComprehensionDistributionBucket[];
    totalSentences: number;
}) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            {buckets.map((bucket) => {
                const bucketPercent = percent(bucket.count, totalSentences);
                return (
                    <Box key={`${bucket.start}-${bucket.end}`}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                            <Typography variant="body2">{comprehensionDistributionLabel(bucket)}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {bucket.count} · {percentDisplay(bucketPercent)}
                            </Typography>
                        </Box>
                        <StatusDistributionBar value={bucketPercent} color="primary.main" />
                    </Box>
                );
            })}
        </Box>
    );
}

function StatisticsInfoTooltip({ label, lines }: { label: string; lines: string[] }) {
    return (
        <Tooltip
            placement="top"
            title={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {lines.map((line) => (
                        <Typography key={line} variant="caption" sx={{ color: 'inherit', lineHeight: 1.4 }}>
                            {line}
                        </Typography>
                    ))}
                </Box>
            }
        >
            <IconButton aria-label={label} size="small" sx={{ p: 0.25, color: 'text.secondary' }}>
                <InfoOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
        </Tooltip>
    );
}

function StatisticsSectionHeading({ title, infoLines }: { title: string; infoLines?: string[] }) {
    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="subtitle2">{title}</Typography>
            {infoLines !== undefined && <StatisticsInfoTooltip label={title} lines={infoLines} />}
        </Box>
    );
}

function sentenceStatusBucketLabel(bucket: DictionaryStatisticsSentenceStatusBucket, statusLabel: string) {
    if (bucket.overflow) return `${bucket.tokenCount}+ ${statusLabel}`;
    return `${bucket.tokenCount} ${statusLabel}`;
}

function sentenceDialogBucketData(
    bucket: SentenceDialogBucket,
    sentenceBuckets: DictionaryStatisticsSentenceBuckets,
    statusLabels: Record<TokenStatus, string>,
    t: (key: string, options?: any) => string
) {
    if (bucket.kind === 'allKnown') {
        return {
            label: t('statistics.knownSentences'),
            entries: sentenceBuckets.allKnown.entries,
        };
    }
    const statusBucket = sentenceBuckets.byStatus[bucket.status][bucket.groupIndex];
    if (!statusBucket) return;
    return {
        label: sentenceStatusBucketLabel(statusBucket, statusLabels[bucket.status]),
        entries: statusBucket.entries,
    };
}

function selectedRewatchSnapshotForTrack(
    trackSnapshot: DictionaryStatisticsTrackSnapshot,
    selectedRewatchesByTrack: Record<number, number>
): DictionaryStatisticsRewatchSnapshot | undefined {
    if (!trackSnapshot.rewatchSnapshots.length) return;
    const selectedRewatch = Math.min(
        selectedRewatchesByTrack[trackSnapshot.track] ?? 1,
        trackSnapshot.rewatchSnapshots.length
    );
    return trackSnapshot.rewatchSnapshots[selectedRewatch - 1];
}

interface SentenceStatsPanelProps {
    title: string;
    totalSentences: number;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    comprehensionDistribution: SentenceComprehensionDistributionBucket[];
    statusLabels: Record<TokenStatus, string>;
    comprehensionDistributionLabel: string;
    totalSentencesLabel: string;
    uniqueWordsPerSentenceLabel: string;
    uniqueWordsPerSentence: number;
    knownWordsPerSentenceLabel: string;
    knownWordsPerSentence: number;
    knownSentencesLabel: string;
    knownWordsCount: number;
    knownWordsLabel: string;
    knownWordsPercent: number;
    comprehensionLabel: string;
    comprehensionPercent: number;
    globalKnownLabel: string;
    globalKnownCount: number;
    onOpenSentenceBucketDetails: (bucket: SentenceDialogBucket) => void;
    headerAction?: ReactNode;
    emptyMessage?: string;
}

function SentenceStatsPanel({
    title,
    totalSentences,
    sentenceBuckets,
    comprehensionDistribution,
    statusLabels,
    comprehensionDistributionLabel,
    totalSentencesLabel,
    uniqueWordsPerSentenceLabel,
    uniqueWordsPerSentence,
    knownWordsPerSentenceLabel,
    knownWordsPerSentence,
    knownSentencesLabel,
    knownWordsCount,
    knownWordsLabel,
    knownWordsPercent,
    comprehensionLabel,
    comprehensionPercent,
    globalKnownLabel,
    globalKnownCount,
    headerAction,
    emptyMessage,
    onOpenSentenceBucketDetails,
}: SentenceStatsPanelProps) {
    const interleavedSentenceStatusBuckets = useMemo(() => {
        const maxBucketCount = sentenceBucketStatusOrder.reduce(
            (maximum, status) => Math.max(maximum, sentenceBuckets.byStatus[status].length),
            0
        );
        const rows: {
            bucket: SentenceDialogBucket;
            label: string;
            count: number;
            entries: DictionaryStatisticsSentenceBucketEntry[];
        }[] = [];

        for (let groupIndex = 0; groupIndex < maxBucketCount; ++groupIndex) {
            for (const status of sentenceBucketStatusOrder) {
                const statusBuckets = sentenceBuckets.byStatus[status];
                const bucket = statusBuckets[groupIndex];
                if (!bucket) continue;
                rows.push({
                    bucket: { kind: 'status', status, groupIndex },
                    label: sentenceStatusBucketLabel(bucket, statusLabels[status]),
                    count: bucket.count,
                    entries: bucket.entries,
                });
            }
        }

        return rows;
    }, [sentenceBuckets, statusLabels]);

    const renderSentenceBucketRow = useCallback(
        (
            bucket: SentenceDialogBucket,
            label: string,
            count: number,
            entries: DictionaryStatisticsSentenceBucketEntry[]
        ) => {
            const content = `${label} · ${count} · ${percentDisplay(percent(count, totalSentences))}`;
            const canOpen = entries.length > 0;
            if (!canOpen) return <Typography color="text.secondary">{content}</Typography>;
            return (
                <ButtonBase
                    sx={{
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: 1,
                        px: 1,
                        py: 0.75,
                        border: '1px solid',
                        borderColor: 'divider',
                        color: 'text.primary',
                        textAlign: 'left',
                        transition: (theme) => theme.transitions.create(['background-color', 'border-color']),
                        '&:hover': {
                            backgroundColor: 'action.hover',
                            borderColor: 'text.secondary',
                        },
                    }}
                    onClick={() => onOpenSentenceBucketDetails(bucket)}
                >
                    <Typography color="inherit">{content}</Typography>
                    <ChevronRightRoundedIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                </ButtonBase>
            );
        },
        [onOpenSentenceBucketDetails, totalSentences]
    );

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Box
                        sx={{
                            minWidth: 160,
                            minHeight: 40,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'flex-start',
                            flexShrink: 0,
                        }}
                    >
                        {headerAction}
                    </Box>
                </Box>
                {emptyMessage ? (
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                ) : (
                    <>
                        <Typography color="text.secondary">
                            {`${comprehensionLabel}: ${percentDisplay(comprehensionPercent)}`}
                        </Typography>
                        <Typography color="text.secondary">
                            {`${knownWordsLabel}: ${knownWordsCount} · ${percentDisplay(knownWordsPercent)}`}
                        </Typography>
                        <Typography color="text.secondary">{`${globalKnownLabel}: ${globalKnownCount}`}</Typography>
                        <Divider flexItem sx={{ my: 0.25 }} />
                        {renderSentenceBucketRow(
                            { kind: 'allKnown' },
                            knownSentencesLabel,
                            sentenceBuckets.allKnown.count,
                            sentenceBuckets.allKnown.entries
                        )}
                        {interleavedSentenceStatusBuckets.map(({ bucket, label, count, entries }) =>
                            renderSentenceBucketRow(bucket, label, count, entries)
                        )}
                        <Typography color="text.secondary">
                            {labelWithCount(totalSentencesLabel, totalSentences)}
                        </Typography>
                        <Typography color="text.secondary">
                            {`${uniqueWordsPerSentenceLabel}: ${averageDisplay(uniqueWordsPerSentence)}`}
                        </Typography>
                        <Typography color="text.secondary">
                            {`${knownWordsPerSentenceLabel}: ${averageDisplay(knownWordsPerSentence)}`}
                        </Typography>
                        <Typography variant="subtitle2">{comprehensionDistributionLabel}</Typography>
                        <SentenceComprehensionDistribution
                            buckets={comprehensionDistribution}
                            totalSentences={totalSentences}
                        />
                    </>
                )}
            </Box>
        </Box>
    );
}

function sentenceAveragesFromTotals(sentenceTotals: DictionaryStatisticsSentenceTotals) {
    return {
        averageWordsPerSentence: averageFromTotals(sentenceTotals.totalWords, sentenceTotals.processedSentenceCount),
        averageKnownWordsPerSentence: averageFromTotals(
            sentenceTotals.totalKnownWords,
            sentenceTotals.processedSentenceCount
        ),
    };
}

export default function StatisticsSettingsTab({ dictionaryProvider, onSeekRequested, onMineRequested }: Props) {
    const { t } = useTranslation();
    const [snapshot, setSnapshot] = useState<DictionaryStatisticsSnapshot>();
    const [generationRequested, setGenerationRequested] = useState(false);
    const [selectedRewatchesByTrack, setSelectedRewatchesByTrack] = useState<Record<number, number>>({});
    const [sentenceDialogState, setSentenceDialogState] = useState<SentenceDialogState>();
    const trackSnapshots = useMemo(() => snapshot?.snapshots ?? [], [snapshot]);
    const mediaId = snapshot?.mediaId;
    const hasTracks = trackSnapshots.length > 0;
    const allTrackProgressComplete = useMemo(
        () =>
            hasTracks &&
            trackSnapshots.every((trackSnapshot) => trackSnapshot.progress.current >= trackSnapshot.progress.total),
        [hasTracks, trackSnapshots]
    );
    const isGenerating = generationRequested && (!hasTracks || !allTrackProgressComplete);

    useEffect(() => {
        const unsubscribeStatistics = dictionaryProvider.onStatisticsSnapshot(
            (snapshot?: DictionaryStatisticsSnapshot) => {
                setSnapshot(snapshot);
                if (
                    snapshot?.snapshots.length &&
                    snapshot.snapshots.every(
                        (trackSnapshot) => trackSnapshot.progress.current >= trackSnapshot.progress.total
                    )
                ) {
                    setGenerationRequested(false);
                }
            }
        );
        const unsubscribeGeneration = dictionaryProvider.onRequestStatisticsGeneration(() => {
            setGenerationRequested(true);
        });
        void dictionaryProvider.requestStatisticsSnapshot();
        return () => {
            unsubscribeStatistics();
            unsubscribeGeneration();
        };
    }, [dictionaryProvider]);

    const handleGenerate = useCallback(() => {
        setGenerationRequested(true);
        void dictionaryProvider.requestStatisticsGeneration(mediaId);
    }, [dictionaryProvider, mediaId]);

    useEffect(() => {
        if (!generationRequested) return;
        if (hasTracks) return;
        const timeout = setTimeout(() => {
            setGenerationRequested(false);
        }, 5000);
        return () => clearTimeout(timeout);
    }, [generationRequested, hasTracks, snapshot]);

    const handleSelectedRewatchChanged = useCallback((track: number, rewatch: number) => {
        setSelectedRewatchesByTrack((current) => ({ ...current, [track]: rewatch }));
    }, []);
    const handleOpenCurrentSentenceBucketDetails = useCallback((track: number, bucket: SentenceDialogBucket) => {
        setSentenceDialogState({ track, scope: 'current', bucket });
    }, []);
    const handleOpenProjectedSentenceBucketDetails = useCallback((track: number, bucket: SentenceDialogBucket) => {
        setSentenceDialogState({ track, scope: 'projected', bucket });
    }, []);
    const handleCloseSentenceBucketDetails = useCallback(() => setSentenceDialogState(undefined), []);
    const handleSeekSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => {
            if (mediaId === undefined) return;
            void dictionaryProvider.requestStatisticsSeek(mediaId, sentence.start);
            onSeekRequested?.(mediaId);
        },
        [dictionaryProvider, mediaId, onSeekRequested]
    );
    const handleMineSentence = useCallback(
        async (sentence: DictionaryStatisticsSentence) => {
            if (mediaId === undefined) return;
            const trackSnapshot = snapshot?.snapshots.find((candidate) => candidate.track === sentence.track);
            if (!trackSnapshot || trackSnapshot.progress.current < trackSnapshot.progress.total) return;
            await Promise.resolve(dictionaryProvider.requestStatisticsMineSentences(mediaId, [sentence.index]));
            onMineRequested?.(mediaId);
        },
        [dictionaryProvider, onMineRequested, snapshot, mediaId]
    );
    const statusLabels = useMemo(
        () => ({
            [TokenStatus.UNCOLLECTED]: t('settings.dictionaryTokenStatus0'),
            [TokenStatus.UNKNOWN]: t('settings.dictionaryTokenStatus1'),
            [TokenStatus.LEARNING]: t('settings.dictionaryTokenStatus2'),
            [TokenStatus.GRADUATED]: t('settings.dictionaryTokenStatus3'),
            [TokenStatus.YOUNG]: t('settings.dictionaryTokenStatus4'),
            [TokenStatus.MATURE]: t('settings.dictionaryTokenStatus5'),
        }),
        [t]
    );
    const comprehensionInfoLines = useMemo(() => [t('statistics.info.comprehension')], [t]);
    const globalKnownInfoLines = useMemo(() => [t('statistics.info.globalKnownWords')], [t]);
    const wordDistributionInfoLines = useMemo(
        () => [t('statistics.info.wordDistribution'), t('statistics.info.occurrences'), t('statistics.info.frequency')],
        [t]
    );
    const sentenceStatisticsInfoLines = useMemo(
        () => [
            t('statistics.info.sentenceStatistics'),
            `${t('statistics.projectedRewatch')}: ${t('statistics.info.projectedRewatch')}`,
        ],
        [t]
    );
    const uniqueWordsPerSentenceLabel = t('statistics.uniqueWordsPerSentence');
    const knownWordsPerSentenceLabel = t('statistics.knownWordsPerSentence');
    const activeSentenceDialog = useMemo(() => {
        if (!sentenceDialogState || !snapshot) return;
        const trackSnapshot = snapshot.snapshots.find((candidate) => candidate.track === sentenceDialogState.track);
        if (!trackSnapshot) return;

        const trackTitle = `${t('settings.subtitleTrackChoice', { trackNumber: trackSnapshot.track + 1 })}`;
        const selectedRewatchSnapshot = selectedRewatchSnapshotForTrack(trackSnapshot, selectedRewatchesByTrack);
        const sourceSentenceBuckets = (() => {
            if (sentenceDialogState.scope === 'current') return trackSnapshot.sentenceBuckets;
            return selectedRewatchSnapshot?.sentenceBuckets;
        })();
        if (sourceSentenceBuckets === undefined) return;

        const bucketData = sentenceDialogBucketData(sentenceDialogState.bucket, sourceSentenceBuckets, statusLabels, t);
        if (!bucketData) return;

        const miningEnabled = trackSnapshot.progress.current >= trackSnapshot.progress.total;
        if (sentenceDialogState.scope === 'current') {
            return {
                title: `${trackTitle} · ${t('statistics.currentPass')} · ${bucketData.label}`,
                entries: bucketData.entries,
                totalSentences: trackSnapshot.progress.total,
                miningEnabled,
            };
        }

        if (selectedRewatchSnapshot === undefined) return;
        return {
            title: `${trackTitle} · ${t('statistics.projectedRewatch')} · ${t('statistics.rewatchOption', {
                rewatch: selectedRewatchSnapshot.rewatch,
            })} · ${bucketData.label}`,
            entries: bucketData.entries,
            totalSentences: trackSnapshot.progress.total,
            miningEnabled,
        };
    }, [sentenceDialogState, snapshot, statusLabels, t, selectedRewatchesByTrack]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box>
                    <Typography variant="h6">{t('statistics.title')}</Typography>
                    {!hasTracks && <Typography color="text.secondary">{t('statistics.description')}</Typography>}
                </Box>
                {!hasTracks &&
                    (isGenerating ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <CircularProgress size={20} />
                            <Typography color="text.secondary">{t('statistics.generationInProgress')}</Typography>
                        </Box>
                    ) : (
                        <Button variant="contained" onClick={handleGenerate}>
                            {t('statistics.generate')}
                        </Button>
                    ))}
            </Box>

            {!hasTracks && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography>{t('statistics.empty')}</Typography>
                </Paper>
            )}

            {trackSnapshots.map((trackSnapshot) => {
                const consideredTokens = trackSnapshot.numUniqueTokens - trackSnapshot.numIgnoredTokens;
                const totalSentences = trackSnapshot.progress.total;
                const trackTitle = `${t('settings.subtitleTrackChoice', { trackNumber: trackSnapshot.track + 1 })}`;
                const trackProgressPercent = percent(trackSnapshot.progress.current, totalSentences);
                const knownPercent = percent(trackSnapshot.numKnownTokens, consideredTokens);
                const comprehension = comprehensionFromStatusOccurrences(trackSnapshot.statusCounts);
                const { averageWordsPerSentence, averageKnownWordsPerSentence } = sentenceAveragesFromTotals(
                    trackSnapshot.sentenceTotals
                );
                const currentSentenceComprehensionDistribution = comprehensionDistributionFromSentenceTotals(
                    trackSnapshot.sentenceTotals
                );
                const selectedRewatchSnapshot = selectedRewatchSnapshotForTrack(
                    trackSnapshot,
                    selectedRewatchesByTrack
                );
                const maxRewatches = trackSnapshot.rewatchSnapshots.length;
                const projectedSentenceBuckets = selectedRewatchSnapshot?.sentenceBuckets ?? emptySentenceBuckets;
                const projectedKnownCount = selectedRewatchSnapshot?.numKnownTokens ?? 0;
                const projectedKnownPercent = selectedRewatchSnapshot
                    ? percent(selectedRewatchSnapshot.numKnownTokens, consideredTokens)
                    : 0;
                const projectedComprehension = selectedRewatchSnapshot
                    ? comprehensionFromStatusOccurrences(selectedRewatchSnapshot.statusCounts)
                    : 0;
                const projectedGlobalKnownCount = selectedRewatchSnapshot?.numDictionaryKnownTokens ?? 0;
                const {
                    averageWordsPerSentence: projectedAverageWordsPerSentence,
                    averageKnownWordsPerSentence: projectedAverageKnownWordsPerSentence,
                } = sentenceAveragesFromTotals(selectedRewatchSnapshot?.sentenceTotals ?? emptySentenceTotals);
                const projectedSentenceComprehensionDistribution = comprehensionDistributionFromSentenceTotals(
                    selectedRewatchSnapshot?.sentenceTotals ?? emptySentenceTotals
                );
                const currentPassTitle = t('statistics.currentPass');

                return (
                    <Paper
                        key={trackSnapshot.track}
                        variant="outlined"
                        sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                        {(!trackSnapshot.progress.current || trackSnapshot.progress.current < totalSentences) && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {`${trackSnapshot.progress.current} / ${totalSentences} · ${percentDisplay(trackProgressPercent)}`}
                                </Typography>
                                <LinearProgress
                                    variant={totalSentences > 0 ? 'determinate' : 'indeterminate'}
                                    value={trackProgressPercent}
                                    sx={{ height: 6, borderRadius: 999 }}
                                />
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 2,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Typography variant="h6">{trackTitle}</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 'auto' }}>
                                <StatisticsSectionHeading
                                    title={t('statistics.globalKnownWords')}
                                    infoLines={globalKnownInfoLines}
                                />
                                <Typography variant="h5">{trackSnapshot.numDictionaryKnownTokens}</Typography>
                                <Typography color="text.secondary">
                                    {`${t('settings.dictionaryTokenStateIgnored')}: ${trackSnapshot.numDictionaryIgnoredTokens}`}
                                </Typography>
                            </Box>
                        </Box>

                        <Box>
                            <StatisticsSectionHeading
                                title={t('statistics.comprehension')}
                                infoLines={comprehensionInfoLines}
                            />
                            <Typography color="text.secondary" sx={{ mb: 1 }}>
                                {percentDisplay(comprehension)}
                            </Typography>
                            <ComprehensionScale value={comprehension} />
                        </Box>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)' },
                                gap: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="subtitle2">{t('statistics.uniqueWords')}</Typography>
                                <Typography variant="h5">{trackSnapshot.numUniqueTokens}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2">{t('statistics.knownWords')}</Typography>
                                <Typography variant="h5">{trackSnapshot.numKnownTokens}</Typography>
                                <Typography color="text.secondary">{percentDisplay(knownPercent)}</Typography>
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: 2,
                            }}
                        >
                            <Box sx={{ gridColumn: '1 / -1' }}>
                                <StatisticsSectionHeading
                                    title={t('statistics.wordDistribution')}
                                    infoLines={wordDistributionInfoLines}
                                />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    {t('statistics.statusDistribution')}
                                </Typography>
                                {[
                                    ...statusOrder.map((status) => ({
                                        key: `${status}`,
                                        label: statusLabels[status],
                                        count: trackSnapshot.statusCounts[status].numUnique,
                                        occurrences: trackSnapshot.statusCounts[status].numOccurrences,
                                        color: trackSnapshot.statusColors[status],
                                    })),
                                    {
                                        key: 'ignored',
                                        label: t('settings.dictionaryTokenStateIgnored'),
                                        count: trackSnapshot.numIgnoredTokens,
                                        occurrences: trackSnapshot.numIgnoredOccurrences,
                                        color: '#e0e0e0',
                                    },
                                ].map((statusRow) => (
                                    <Box key={statusRow.key} sx={{ mb: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2">{statusRow.label}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {statusRow.count} ·{' '}
                                                {percentDisplay(
                                                    percent(statusRow.count, trackSnapshot.numUniqueTokens)
                                                )}
                                                {` (${statusRow.occurrences})`}
                                            </Typography>
                                        </Box>
                                        <StatusDistributionBar
                                            value={percent(statusRow.count, trackSnapshot.numUniqueTokens)}
                                            color={statusRow.color}
                                        />
                                    </Box>
                                ))}
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    {t('statistics.frequencyDistribution')}
                                </Typography>
                                {trackSnapshot.frequencyBuckets.map((bucket) => {
                                    const bucketLabel =
                                        bucket.label === 'Unknown' ? statusLabels[TokenStatus.UNKNOWN] : bucket.label;
                                    const bucketPercent = percent(bucket.count, consideredTokens);

                                    return (
                                        <Box key={bucket.label} sx={{ mb: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="body2">{bucketLabel}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {bucket.count} · {percentDisplay(bucketPercent)}
                                                    {` (${bucket.occurrences})`}
                                                </Typography>
                                            </Box>
                                            <FrequencyDistributionBar
                                                totalPercent={bucketPercent}
                                                count={bucket.count}
                                                statusCounts={bucket.statusCounts}
                                                statusColors={trackSnapshot.statusColors}
                                            />
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: 2,
                            }}
                        >
                            <Box sx={{ gridColumn: '1 / -1' }}>
                                <StatisticsSectionHeading
                                    title={t('statistics.sentenceStatistics')}
                                    infoLines={sentenceStatisticsInfoLines}
                                />
                            </Box>
                            <Box>
                                <SentenceStatsPanel
                                    title={currentPassTitle}
                                    totalSentences={totalSentences}
                                    sentenceBuckets={trackSnapshot.sentenceBuckets}
                                    comprehensionDistribution={currentSentenceComprehensionDistribution}
                                    statusLabels={statusLabels}
                                    comprehensionDistributionLabel={t('statistics.comprehensionDistribution')}
                                    totalSentencesLabel={t('statistics.totalSentences')}
                                    uniqueWordsPerSentenceLabel={uniqueWordsPerSentenceLabel}
                                    uniqueWordsPerSentence={averageWordsPerSentence}
                                    knownWordsPerSentenceLabel={knownWordsPerSentenceLabel}
                                    knownWordsPerSentence={averageKnownWordsPerSentence}
                                    knownSentencesLabel={t('statistics.knownSentences')}
                                    knownWordsCount={trackSnapshot.numKnownTokens}
                                    knownWordsLabel={t('statistics.knownWords')}
                                    knownWordsPercent={knownPercent}
                                    comprehensionLabel={t('statistics.comprehension')}
                                    comprehensionPercent={comprehension}
                                    globalKnownLabel={t('statistics.globalKnownWords')}
                                    globalKnownCount={trackSnapshot.numDictionaryKnownTokens}
                                    onOpenSentenceBucketDetails={(bucket) =>
                                        handleOpenCurrentSentenceBucketDetails(trackSnapshot.track, bucket)
                                    }
                                />
                            </Box>
                            <Box>
                                <SentenceStatsPanel
                                    title={t('statistics.projectedRewatch')}
                                    totalSentences={totalSentences}
                                    sentenceBuckets={projectedSentenceBuckets}
                                    comprehensionDistribution={projectedSentenceComprehensionDistribution}
                                    statusLabels={statusLabels}
                                    comprehensionDistributionLabel={t('statistics.comprehensionDistribution')}
                                    totalSentencesLabel={t('statistics.totalSentences')}
                                    uniqueWordsPerSentenceLabel={uniqueWordsPerSentenceLabel}
                                    uniqueWordsPerSentence={projectedAverageWordsPerSentence}
                                    knownWordsPerSentenceLabel={knownWordsPerSentenceLabel}
                                    knownWordsPerSentence={projectedAverageKnownWordsPerSentence}
                                    knownSentencesLabel={t('statistics.knownSentences')}
                                    knownWordsCount={projectedKnownCount}
                                    knownWordsLabel={t('statistics.knownWords')}
                                    knownWordsPercent={projectedKnownPercent}
                                    comprehensionLabel={t('statistics.comprehension')}
                                    comprehensionPercent={projectedComprehension}
                                    globalKnownLabel={t('statistics.globalKnownWords')}
                                    globalKnownCount={projectedGlobalKnownCount}
                                    headerAction={
                                        selectedRewatchSnapshot !== undefined ? (
                                            <TextField
                                                select
                                                size="small"
                                                label={t('statistics.rewatchSelect')}
                                                value={selectedRewatchSnapshot.rewatch}
                                                sx={{ minWidth: 160 }}
                                                onChange={(event) =>
                                                    handleSelectedRewatchChanged(
                                                        trackSnapshot.track,
                                                        Number(event.target.value)
                                                    )
                                                }
                                            >
                                                {trackSnapshot.rewatchSnapshots.map((rewatchSnapshot) => (
                                                    <MenuItem
                                                        key={rewatchSnapshot.rewatch}
                                                        value={rewatchSnapshot.rewatch}
                                                    >
                                                        {t('statistics.rewatchOption', {
                                                            rewatch: rewatchSnapshot.rewatch,
                                                        })}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        ) : undefined
                                    }
                                    emptyMessage={maxRewatches === 0 ? t('statistics.noMoreRewatches') : undefined}
                                    onOpenSentenceBucketDetails={(bucket) =>
                                        handleOpenProjectedSentenceBucketDetails(trackSnapshot.track, bucket)
                                    }
                                />
                            </Box>
                        </Box>
                    </Paper>
                );
            })}
            {activeSentenceDialog !== undefined && (
                <StatisticsSentenceDetailsDialog
                    open
                    title={activeSentenceDialog.title}
                    entries={activeSentenceDialog.entries}
                    totalSentences={activeSentenceDialog.totalSentences}
                    miningEnabled={activeSentenceDialog.miningEnabled}
                    miningDisabledReason={t('statistics.miningDisabledUntilComplete')}
                    onClose={handleCloseSentenceBucketDetails}
                    onSeekToSentence={handleSeekSentence}
                    onMineSentence={handleMineSentence}
                />
            )}
        </Box>
    );
}
