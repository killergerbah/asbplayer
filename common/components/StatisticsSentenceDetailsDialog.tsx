import { useEffect, useMemo, useRef, useState } from 'react';
import {
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSentenceSort,
    DictionaryStatisticsSentenceSortState,
    defaultDictionaryStatisticsSentenceSortDirection,
    defaultDictionaryStatisticsSentenceSortState,
    dictionaryStatisticsComprehensionBands,
    nextDictionaryStatisticsSentenceSortState,
    percentDisplay,
    sortDictionaryStatisticsSentenceBucketEntries,
} from '@project/common/dictionary-statistics';
import { timeDurationDisplay } from '@project/common/util';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { alpha } from '@mui/material/styles';
import Tooltip from './Tooltip';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    title: string;
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
    miningEnabled: boolean;
    highlightedSentenceIndex?: number;
    miningDisabledReason?: string;
    onClose: () => void;
    onSeekToSentence: (sentence: DictionaryStatisticsSentence) => void;
    onMineSentence: (sentence: DictionaryStatisticsSentence) => void;
}

export default function StatisticsSentenceDetailsDialog({
    open,
    title,
    entries,
    totalSentences,
    miningEnabled,
    highlightedSentenceIndex,
    miningDisabledReason,
    onClose,
    onSeekToSentence,
    onMineSentence,
}: Props) {
    const { t } = useTranslation();
    const [sortState, setSortState] = useState<DictionaryStatisticsSentenceSortState>(
        defaultDictionaryStatisticsSentenceSortState()
    );
    const [activeHighlightedSentenceIndex, setActiveHighlightedSentenceIndex] = useState<number>();
    const entryRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const mineTooltip = miningEnabled ? t('action.mine') : (miningDisabledReason ?? t('action.mine'));
    const maximumDisplayedTimestamp = useMemo(
        () => entries.reduce((maximum, entry) => Math.max(maximum, entry.sentence.end), 0),
        [entries]
    );

    useEffect(() => {
        if (!open || highlightedSentenceIndex === undefined) {
            setActiveHighlightedSentenceIndex(undefined);
            return;
        }

        setActiveHighlightedSentenceIndex(highlightedSentenceIndex);
        const scrollTimeout = window.setTimeout(() => {
            entryRefs.current[highlightedSentenceIndex]?.scrollIntoView({
                block: 'center',
                behavior: 'smooth',
            });
        }, 0);
        const highlightTimeout = window.setTimeout(() => {
            setActiveHighlightedSentenceIndex((current) =>
                current === highlightedSentenceIndex ? undefined : current
            );
        }, 5000);

        return () => {
            window.clearTimeout(scrollTimeout);
            window.clearTimeout(highlightTimeout);
        };
    }, [open, highlightedSentenceIndex]);

    const sortedEntries = useMemo(() => {
        return sortDictionaryStatisticsSentenceBucketEntries(entries, sortState);
    }, [entries, sortState]);

    const sortOptions: { sort: DictionaryStatisticsSentenceSort; label: string }[] = [
        { sort: 'index', label: t('statistics.sentenceIndex') },
        { sort: 'comprehension', label: t('statistics.comprehension') },
        { sort: 'frequency', label: t('statistics.frequency') },
        { sort: 'occurrences', label: t('statistics.occurrences') },
    ];

    return (
        <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
            <DialogTitle sx={{ pr: 7 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                        <Typography variant="h6">{title}</Typography>
                        <Typography color="text.secondary">
                            {`${t('statistics.matchingSentences')}: ${entries.length}/${totalSentences}`}
                        </Typography>
                        {!miningEnabled && miningDisabledReason !== undefined && (
                            <Typography color="text.secondary">{miningDisabledReason}</Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('statistics.sortBy')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
                            {sortOptions.map(({ sort, label }) => {
                                const isActive = sortState.sort === sort;
                                const direction = isActive
                                    ? sortState.direction
                                    : defaultDictionaryStatisticsSentenceSortDirection(sort);
                                const ArrowIcon = direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;

                                return (
                                    <Button
                                        key={sort}
                                        size="small"
                                        variant={isActive ? 'contained' : 'outlined'}
                                        color={isActive ? 'primary' : 'inherit'}
                                        endIcon={<ArrowIcon fontSize="small" />}
                                        onClick={() =>
                                            setSortState((current) =>
                                                nextDictionaryStatisticsSentenceSortState(current, sort)
                                            )
                                        }
                                    >
                                        {label}
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
                <IconButton
                    aria-label={t('action.cancel')}
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {sortedEntries.length === 0 ? (
                    <Typography color="text.secondary">{t('statistics.sentenceDetailsEmpty')}</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {sortedEntries.map((entry) => {
                            const sentence = entry.sentence;
                            const comprehensionBand =
                                dictionaryStatisticsComprehensionBands[entry.comprehensionBandIndex] ??
                                dictionaryStatisticsComprehensionBands[
                                    dictionaryStatisticsComprehensionBands.length - 1
                                ];
                            const isHighlighted = activeHighlightedSentenceIndex === sentence.index;
                            return (
                                <Paper
                                    key={sentence.index}
                                    variant="outlined"
                                    ref={(node: HTMLDivElement | null) => {
                                        entryRefs.current[sentence.index] = node;
                                    }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        overflow: 'hidden',
                                        transition: (theme) =>
                                            theme.transitions.create(['background-color', 'border-color'], {
                                                duration: 1000,
                                            }),
                                        backgroundColor: (theme) =>
                                            isHighlighted ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
                                        borderColor: (theme) =>
                                            isHighlighted ? theme.palette.primary.main : undefined,
                                    }}
                                >
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            px: 2,
                                            py: 1.5,
                                            cursor: 'pointer',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                        }}
                                        onClick={() => onSeekToSentence(sentence)}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter' && event.key !== ' ') return;
                                            event.preventDefault();
                                            onSeekToSentence(sentence);
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                alignItems: 'flex-start',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 0.5,
                                                    flexShrink: 0,
                                                    minWidth: 72,
                                                }}
                                            >
                                                <Typography variant="body2" color="text.secondary">
                                                    {`#${sentence.index + 1}`}
                                                </Typography>
                                                <Tooltip title={t('statistics.comprehension')}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: comprehensionBand.color,
                                                            lineHeight: 1.2,
                                                            fontWeight: 600,
                                                            width: 'fit-content',
                                                        }}
                                                    >
                                                        {percentDisplay(entry.comprehensionPercent)}
                                                    </Typography>
                                                </Tooltip>
                                            </Box>
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflowWrap: 'anywhere',
                                                    whiteSpace: 'pre-wrap',
                                                    '& .asb-frequency rt': { fontSize: '0.5em' },
                                                    '& .asb-frequency-hover rt': { fontSize: '0.5em' },
                                                }}
                                            >
                                                <span
                                                    dangerouslySetInnerHTML={{
                                                        __html: sentence.richText ?? sentence.text,
                                                    }}
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    flexShrink: 0,
                                                    ml: 'auto',
                                                }}
                                            >
                                                <Tooltip title={mineTooltip!}>
                                                    <span>
                                                        <IconButton
                                                            disabled={!miningEnabled}
                                                            onClick={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                onMineSentence(sentence);
                                                            }}
                                                        >
                                                            <NoteAddIcon />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ whiteSpace: 'nowrap', pl: 0.5, textAlign: 'right' }}
                                                >
                                                    {timeDurationDisplay(
                                                        sentence.start,
                                                        maximumDisplayedTimestamp,
                                                        true
                                                    )}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
