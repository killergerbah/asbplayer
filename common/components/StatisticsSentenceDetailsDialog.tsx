import { useMemo, useState } from 'react';
import {
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
} from '@project/common/dictionary-statistics';
import { timeDurationDisplay } from '@project/common/util';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import Tooltip from './Tooltip';
import { useTranslation } from 'react-i18next';

type SentenceSort = 'index' | 'frequency' | 'occurrences';

interface Props {
    open: boolean;
    title: string;
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
    miningEnabled: boolean;
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
    miningDisabledReason,
    onClose,
    onSeekToSentence,
    onMineSentence,
}: Props) {
    const { t } = useTranslation();
    const [sort, setSort] = useState<SentenceSort>('index');
    const mineTooltip = miningEnabled ? t('action.mine') : (miningDisabledReason ?? t('action.mine'));
    const maximumDisplayedTimestamp = useMemo(
        () => entries.reduce((maximum, entry) => Math.max(maximum, entry.sentence.end), 0),
        [entries]
    );

    const sortedEntries = useMemo(() => {
        const next = entries.slice();
        next.sort((left, right) => {
            if (sort === 'frequency') {
                const leftFrequency = left.lowestFrequency ?? Number.POSITIVE_INFINITY;
                const rightFrequency = right.lowestFrequency ?? Number.POSITIVE_INFINITY;
                if (leftFrequency !== rightFrequency) return leftFrequency - rightFrequency;
            } else if (sort === 'occurrences') {
                if (left.highestOccurrences !== right.highestOccurrences) {
                    return right.highestOccurrences - left.highestOccurrences;
                }
                const leftFrequency = left.lowestFrequency ?? Number.POSITIVE_INFINITY;
                const rightFrequency = right.lowestFrequency ?? Number.POSITIVE_INFINITY;
                if (leftFrequency !== rightFrequency) return leftFrequency - rightFrequency;
            }
            return left.sentence.index - right.sentence.index;
        });
        return next;
    }, [entries, sort]);

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
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
                        <TextField
                            select
                            size="small"
                            label={t('statistics.sortBy')}
                            value={sort}
                            sx={{ minWidth: 180 }}
                            onChange={(event) => setSort(event.target.value as SentenceSort)}
                        >
                            <MenuItem value="index">{t('statistics.sortByIndex')}</MenuItem>
                            <MenuItem value="frequency">{t('statistics.sortByFrequency')}</MenuItem>
                            <MenuItem value="occurrences">{t('statistics.sortByOccurrences')}</MenuItem>
                        </TextField>
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
                            return (
                                <Paper
                                    key={sentence.index}
                                    variant="outlined"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        overflow: 'hidden',
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
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ flexShrink: 0, minWidth: 36 }}
                                            >
                                                {`#${sentence.index + 1}`}
                                            </Typography>
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
