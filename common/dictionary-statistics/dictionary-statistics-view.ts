import { Progress } from '@project/common';
import {
    getFullyKnownTokenStatus,
    isTokenStatusKnown,
    NUM_TOKEN_STATUSES,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import {
    DictionaryStatisticsRawTrackSnapshot,
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentences,
    DictionaryStatisticsSnapshot,
} from '@project/common/dictionary-statistics';
import { getCardTokenStatus } from '@project/common/subtitle-annotations';
import { HAS_LETTER_REGEX } from '@project/common/util';

/**
 * This file along with its consumers can be freely modified without concern to version
 * mismatch between the extension and app. Changes to the published snapshots however
 * must be made with consideration to backwards compatibility.
 */

const dictionaryStatisticsFrequencyBuckets = [1000, 2000, 5000, 10000, 20000] as const;
const minimumComprehensionStatus = TokenStatus.UNKNOWN;
const fullyKnownTokenStatus = getFullyKnownTokenStatus();
const comprehensionStatusRange = fullyKnownTokenStatus - minimumComprehensionStatus;

export const dictionaryStatisticsComprehensionBands = [
    { min: 0, max: 60, label: '<60', color: '#c62828', textColor: '#ffffff' },
    { min: 60, max: 70, label: '60+', color: '#ef6c00', textColor: '#ffffff' },
    { min: 70, max: 80, label: '70+', color: '#f9a825', textColor: '#111111' },
    { min: 80, max: 90, label: '80+', color: '#2e7d32', textColor: '#ffffff' },
    { min: 90, max: 95, label: '90+', color: '#1565c0', textColor: '#ffffff' },
    { min: 95, max: 100, label: '95+', color: 'primary.main', textColor: 'primary.contrastText' },
] as const;

export type DictionaryStatisticsSentenceSort = 'index' | 'frequency' | 'occurrences' | 'comprehension';
export type DictionaryStatisticsSentenceSortDirection = 'asc' | 'desc';

export interface DictionaryStatisticsSentenceSortState {
    sort: DictionaryStatisticsSentenceSort;
    direction: DictionaryStatisticsSentenceSortDirection;
}

export type DictionaryStatisticsSentenceDialogBucket =
    | {
          kind: 'allKnown';
      }
    | {
          kind: 'uncollected';
          groupIndex: number;
      };

export interface DictionaryStatisticsTokenStatusCount {
    numUnique: number;
    numOccurrences: number;
}

export type DictionaryStatisticsTokenStatusCounts = Map<TokenStatus, DictionaryStatisticsTokenStatusCount>;
export interface DictionaryStatisticsFrequencyBucketStatusCount {
    numUnique: number;
    numOccurrences: number;
}

export type DictionaryStatisticsFrequencyBucketStatusCounts = Map<
    TokenStatus,
    DictionaryStatisticsFrequencyBucketStatusCount
>;

export interface DictionaryStatisticsSentenceStatusCounts {
    sentence: DictionaryStatisticsSentence;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceTotals {
    processedSentenceCount: number;
    totalWords: number;
    totalKnownWords: number;
    statusCounts: DictionaryStatisticsSentenceStatusCounts[];
}

export interface DictionaryStatisticsFrequencyBucket {
    label: string;
    count: number;
    statusCounts: DictionaryStatisticsFrequencyBucketStatusCounts;
    numOccurrences: number;
    percent: number;
}

export interface DictionaryStatisticsSentenceComprehensionPoint {
    sentence: DictionaryStatisticsSentence;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceBucketEntry {
    sentence: DictionaryStatisticsSentence;
    numConsideredTokens: number;
    numKnownTokens: number;
    numUnknownTokens: number;
    numUncollectedTokens: number;
    lowestFrequency?: number;
    highestOccurrences: number;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceUncollectedBucket {
    tokenCount: number;
    count: number;
    entries: DictionaryStatisticsSentenceBucketEntry[];
}

export interface DictionaryStatisticsSentenceBuckets {
    allKnown: {
        count: number;
        entries: DictionaryStatisticsSentenceBucketEntry[];
    };
    uncollected: DictionaryStatisticsSentenceUncollectedBucket[];
}

export interface DictionaryStatisticsRewatchSnapshot {
    rewatch: number;
    numKnownTokens: number;
    numDictionaryKnownTokens: number;
    knownPercent: number;
    comprehensionPercent: number;
    averageWordsPerSentence: number;
    averageKnownWordsPerSentence: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
}

export interface DictionaryStatisticsTrackSnapshot {
    track: number;
    progress: Progress;
    progressPercent: number;
    statusColors: Record<TokenStatus, string>;
    numDictionaryKnownTokens: number;
    numDictionaryIgnoredTokens: number;
    numUniqueTokens: number;
    consideredTokens: number;
    numIgnoredTokens: number;
    numIgnoredOccurrences: number;
    numKnownTokens: number;
    knownPercent: number;
    comprehensionPercent: number;
    averageWordsPerSentence: number;
    averageKnownWordsPerSentence: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    sentenceComprehensionPoints: DictionaryStatisticsSentenceComprehensionPoint[];
    allSentenceEntries: DictionaryStatisticsSentenceBucketEntry[];
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    frequencyBuckets: DictionaryStatisticsFrequencyBucket[];
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[];
}

interface ProcessedTokenSnapshot {
    status: TokenStatus;
    ignored: boolean;
    frequency: number | null;
    numOccurrences: number;
}
type ProcessedTokenSnapshots = Map<string, ProcessedTokenSnapshot>;

interface ProcessedSentenceSnapshot {
    sentence: DictionaryStatisticsSentence;
    tokens: ProcessedTokenSnapshots;
}

interface EvaluatedSentenceSnapshot {
    sentence: DictionaryStatisticsSentence;
    numConsideredTokens: number;
    numKnownTokens: number;
    numUnknownTokens: number;
    numUncollectedTokens: number;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    consideredTokenKeys: string[];
    uncollectedTokenKeys: string[];
}

interface DictionaryStatisticsDictionaryCounts {
    numKnownTokens: number;
    numIgnoredTokens: number;
}

export function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value));
}

export function percent(value: number, total: number) {
    return total > 0 ? (value / total) * 100 : 0;
}

export function percentDisplay(value: number) {
    const fractionDigits = value === 100 ? 0 : value > 99 ? 3 : 1;
    return `${value.toFixed(fractionDigits)}%`;
}

export function averageDisplay(value: number) {
    return value.toFixed(1);
}

export function countPercentOccurrencesDisplay(count: number, total: number, occurrences: number) {
    return `${count} · ${percentDisplay(percent(count, total))} (${occurrences})`;
}

function averageFromTotals(total: number, count: number) {
    return count > 0 ? total / count : 0;
}

function comprehensionScore(status: TokenStatus): number {
    return (Math.max(status, minimumComprehensionStatus) - minimumComprehensionStatus) / comprehensionStatusRange;
}

function comprehensionFromStatusOccurrences(statusCounts: DictionaryStatisticsTokenStatusCounts): number {
    let totalOccurrences = 0;
    let comprehensionSum = 0;

    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        const numOccurrences = statusCounts.get(status)?.numOccurrences ?? 0;
        totalOccurrences += numOccurrences;
        comprehensionSum += numOccurrences * comprehensionScore(status);
    }

    return totalOccurrences > 0 ? (comprehensionSum / totalOccurrences) * 100 : 0;
}

function comprehensionBandIndexForPercent(value: number): number {
    const clampedValue = clampPercent(value);
    for (let i = 0; i < dictionaryStatisticsComprehensionBands.length - 1; ++i) {
        if (clampedValue < dictionaryStatisticsComprehensionBands[i].max) return i;
    }
    return dictionaryStatisticsComprehensionBands.length - 1;
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

function sentenceComprehensionPointsFromSentenceTotals(
    sentenceTotals: DictionaryStatisticsSentenceTotals
): DictionaryStatisticsSentenceComprehensionPoint[] {
    return sentenceTotals.statusCounts.map(({ sentence, comprehensionPercent, comprehensionBandIndex }) => ({
        sentence,
        comprehensionPercent,
        comprehensionBandIndex,
    }));
}

export function sentenceComprehensionPointLabel(point: DictionaryStatisticsSentenceComprehensionPoint) {
    return `#${point.sentence.index + 1} · ${percentDisplay(point.comprehensionPercent)}`;
}

export function sentenceComprehensionXAxisLabels(points: DictionaryStatisticsSentenceComprehensionPoint[]) {
    const total = points.length;
    if (total <= 0) return [{ value: 1, position: 0 }];

    const values = new Set<number>([1, total]);
    for (let value = 50; value < total; value += 50) values.add(value);

    const denominator = Math.max(total - 1, 1);
    return Array.from(values)
        .sort((left, right) => left - right)
        .map((value) => ({
            value,
            position: total === 1 ? 0 : ((value - 1) / denominator) * 100,
        }));
}

function emptyStatusCounts(): DictionaryStatisticsTokenStatusCounts {
    const counts: DictionaryStatisticsTokenStatusCounts = new Map();
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        counts.set(status, {
            numUnique: 0,
            numOccurrences: 0,
        });
    }
    return counts;
}

function emptyFrequencyBucketStatusCounts(): DictionaryStatisticsFrequencyBucketStatusCounts {
    const counts: DictionaryStatisticsFrequencyBucketStatusCounts = new Map();
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        counts.set(status, {
            numUnique: 0,
            numOccurrences: 0,
        });
    }
    return counts;
}

function emptySentenceBuckets(): DictionaryStatisticsSentenceBuckets {
    return {
        allKnown: {
            count: 0,
            entries: [],
        },
        uncollected: [
            {
                tokenCount: 1,
                count: 0,
                entries: [],
            },
            {
                tokenCount: 2,
                count: 0,
                entries: [],
            },
        ],
    };
}

function uncollectedSentenceBucketForCount(
    sentenceBuckets: DictionaryStatisticsSentenceUncollectedBucket[],
    tokenCount: number
) {
    if (tokenCount <= 0) return;
    return tokenCount === 1 ? sentenceBuckets[0] : sentenceBuckets[1];
}

function mergeTokenSnapshot(
    prev: ProcessedTokenSnapshot | undefined,
    curr: ProcessedTokenSnapshot
): ProcessedTokenSnapshot {
    if (!prev) return { ...curr };
    return {
        status: Math.max(prev.status, curr.status),
        ignored: prev.ignored && curr.ignored,
        frequency:
            prev.frequency != null && curr.frequency != null
                ? Math.min(prev.frequency, curr.frequency)
                : (prev.frequency ?? curr.frequency),
        numOccurrences: prev.numOccurrences + curr.numOccurrences,
    };
}

function processSentenceSnapshots(sentences: DictionaryStatisticsSentences): ProcessedSentenceSnapshot[] {
    const sentenceSnapshots: ProcessedSentenceSnapshot[] = [];
    for (const sentence of Object.values(sentences).sort((left, right) => left.index - right.index)) {
        const tokens: ProcessedTokenSnapshots = new Map();
        for (const token of sentence.tokenization?.tokens ?? []) {
            const key = token.groupingKey;
            if (!key) continue;
            const tokenText = sentence.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(tokenText)) continue;
            tokens.set(
                key,
                mergeTokenSnapshot(tokens.get(key), {
                    status: token.status ?? TokenStatus.UNCOLLECTED,
                    ignored: token.states.includes(TokenState.IGNORED),
                    frequency: token.frequency ?? null,
                    numOccurrences: 1,
                })
            );
        }
        sentenceSnapshots.push({ sentence, tokens });
    }
    return sentenceSnapshots;
}

function evaluateSentenceSnapshot(
    sentenceSnapshot: ProcessedSentenceSnapshot,
    projectedStatuses?: Map<string, TokenStatus>
): EvaluatedSentenceSnapshot {
    const statusCounts = emptyStatusCounts();
    let numConsideredTokens = 0;
    let numKnownTokens = 0;
    let numUnknownTokens = 0;
    let numUncollectedTokens = 0;
    const consideredTokenKeys: string[] = [];
    const uncollectedTokenKeys: string[] = [];

    for (const [tokenKey, token] of sentenceSnapshot.tokens.entries()) {
        if (token.ignored) continue;

        const status = projectedStatuses?.get(tokenKey) ?? token.status;
        numConsideredTokens += 1;
        consideredTokenKeys.push(tokenKey);
        const count = statusCounts.get(status)!;
        count.numUnique += 1;
        count.numOccurrences += token.numOccurrences;

        if (isTokenStatusKnown(status)) {
            numKnownTokens += 1;
            continue;
        }
        if (status === TokenStatus.UNKNOWN) {
            numUnknownTokens += 1;
            continue;
        }
        if (status === TokenStatus.UNCOLLECTED) {
            numUncollectedTokens += 1;
            uncollectedTokenKeys.push(tokenKey);
        }
    }

    return {
        sentence: sentenceSnapshot.sentence,
        numConsideredTokens,
        numKnownTokens,
        numUnknownTokens,
        numUncollectedTokens,
        statusCounts,
        consideredTokenKeys,
        uncollectedTokenKeys,
    };
}

function sentenceTotals(sentenceSnapshots: EvaluatedSentenceSnapshot[]): DictionaryStatisticsSentenceTotals {
    const totalWords = sentenceSnapshots.reduce(
        (sum, sentenceSnapshot) => sum + sentenceSnapshot.numConsideredTokens,
        0
    );
    const totalKnownWords = sentenceSnapshots.reduce(
        (sum, sentenceSnapshot) => sum + sentenceSnapshot.numKnownTokens,
        0
    );

    return {
        processedSentenceCount: sentenceSnapshots.length,
        totalWords,
        totalKnownWords,
        statusCounts: sentenceSnapshots.map((sentenceSnapshot) => {
            const comprehensionPercent = comprehensionFromStatusOccurrences(sentenceSnapshot.statusCounts);
            return {
                sentence: sentenceSnapshot.sentence,
                statusCounts: sentenceSnapshot.statusCounts,
                comprehensionPercent,
                comprehensionBandIndex: comprehensionBandIndexForPercent(comprehensionPercent),
            };
        }),
    };
}

function sentenceBucketEntry(
    sentenceSnapshot: EvaluatedSentenceSnapshot,
    relevantTokenKeys: string[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBucketEntry {
    let lowestFrequency: number | undefined;
    let highestOccurrences = 0;

    for (const tokenKey of relevantTokenKeys) {
        const token = tokens.get(tokenKey); // Using global counts is more accurate but filtered views may have 3 sentences with a token above 4 sentences with another token
        if (!token || token.ignored) continue;

        if (token.frequency != null && (lowestFrequency === undefined || token.frequency < lowestFrequency)) {
            lowestFrequency = token.frequency;
        }

        if (token.numOccurrences > highestOccurrences) highestOccurrences = token.numOccurrences;
    }

    const comprehensionPercent = comprehensionFromStatusOccurrences(sentenceSnapshot.statusCounts);

    return {
        sentence: sentenceSnapshot.sentence,
        numConsideredTokens: sentenceSnapshot.numConsideredTokens,
        numKnownTokens: sentenceSnapshot.numKnownTokens,
        numUnknownTokens: sentenceSnapshot.numUnknownTokens,
        numUncollectedTokens: sentenceSnapshot.numUncollectedTokens,
        lowestFrequency,
        highestOccurrences,
        comprehensionPercent,
        comprehensionBandIndex: comprehensionBandIndexForPercent(comprehensionPercent),
    };
}

function allSentenceEntries(
    sentenceSnapshots: EvaluatedSentenceSnapshot[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBucketEntry[] {
    return sentenceSnapshots.map((sentenceSnapshot) =>
        sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.consideredTokenKeys, tokens)
    );
}

function buildSentenceBucketData(
    sentenceSnapshots: EvaluatedSentenceSnapshot[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBuckets {
    const sentenceBuckets = emptySentenceBuckets();

    for (const sentenceSnapshot of sentenceSnapshots) {
        if (
            sentenceSnapshot.numConsideredTokens &&
            sentenceSnapshot.numKnownTokens === sentenceSnapshot.numConsideredTokens
        ) {
            sentenceBuckets.allKnown.count += 1;
            sentenceBuckets.allKnown.entries.push(
                sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.consideredTokenKeys, tokens)
            );
        }

        const uncollectedBucket = uncollectedSentenceBucketForCount(
            sentenceBuckets.uncollected,
            sentenceSnapshot.numUncollectedTokens
        );
        if (!uncollectedBucket) continue;

        uncollectedBucket.count += 1;
        uncollectedBucket.entries.push(
            sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.uncollectedTokenKeys, tokens)
        );
    }

    return sentenceBuckets;
}

function statusCountsAndFrequencies(tokens: ProcessedTokenSnapshots) {
    const statusCounts = emptyStatusCounts();
    const frequencyCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
    const frequencyStatusCounts = Array.from({ length: dictionaryStatisticsFrequencyBuckets.length }, () =>
        emptyFrequencyBucketStatusCounts()
    );
    const frequencyOccurrenceCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
    let overflowFrequencyCount = 0;
    const overflowFrequencyStatusCounts = emptyFrequencyBucketStatusCounts();
    let overflowFrequencyOccurrences = 0;
    let unknownFrequencyCount = 0;
    const unknownFrequencyStatusCounts = emptyFrequencyBucketStatusCounts();
    let unknownFrequencyOccurrences = 0;
    let numIgnoredTokens = 0;
    let numIgnoredOccurrences = 0;
    let numKnownTokens = 0;

    for (const token of tokens.values()) {
        if (token.ignored) {
            numIgnoredTokens += 1;
            numIgnoredOccurrences += token.numOccurrences;
            continue;
        }

        const count = statusCounts.get(token.status)!;
        count.numUnique += 1;
        count.numOccurrences += token.numOccurrences;
        if (isTokenStatusKnown(token.status)) numKnownTokens += 1;

        if (token.frequency == null) {
            unknownFrequencyCount += 1;
            const unknownFrequencyStatusCount = unknownFrequencyStatusCounts.get(token.status)!;
            unknownFrequencyStatusCount.numUnique += 1;
            unknownFrequencyStatusCount.numOccurrences += token.numOccurrences;
            unknownFrequencyOccurrences += token.numOccurrences;
            continue;
        }

        let isOverflow = true;
        for (let i = 0; i < dictionaryStatisticsFrequencyBuckets.length; ++i) {
            if (token.frequency > dictionaryStatisticsFrequencyBuckets[i]) continue;
            frequencyCounts[i] += 1;
            const frequencyStatusCount = frequencyStatusCounts[i].get(token.status)!;
            frequencyStatusCount.numUnique += 1;
            frequencyStatusCount.numOccurrences += token.numOccurrences;
            frequencyOccurrenceCounts[i] += token.numOccurrences;
            isOverflow = false;
            break;
        }

        if (isOverflow) {
            overflowFrequencyCount += 1;
            const overflowFrequencyStatusCount = overflowFrequencyStatusCounts.get(token.status)!;
            overflowFrequencyStatusCount.numUnique += 1;
            overflowFrequencyStatusCount.numOccurrences += token.numOccurrences;
            overflowFrequencyOccurrences += token.numOccurrences;
        }
    }

    const consideredTokens = Array.from(statusCounts.values()).reduce((sum, count) => sum + count.numUnique, 0);

    const frequencyBuckets: DictionaryStatisticsFrequencyBucket[] = dictionaryStatisticsFrequencyBuckets.map(
        (curr, index) => {
            const prev = dictionaryStatisticsFrequencyBuckets[index - 1];
            return {
                label: prev === undefined ? `1-${curr}` : `${prev + 1}-${curr}`,
                count: frequencyCounts[index],
                statusCounts: frequencyStatusCounts[index],
                numOccurrences: frequencyOccurrenceCounts[index],
                percent: percent(frequencyCounts[index], consideredTokens),
            };
        }
    );
    frequencyBuckets.push({
        label: `${dictionaryStatisticsFrequencyBuckets[dictionaryStatisticsFrequencyBuckets.length - 1]}+`,
        count: overflowFrequencyCount,
        statusCounts: overflowFrequencyStatusCounts,
        numOccurrences: overflowFrequencyOccurrences,
        percent: percent(overflowFrequencyCount, consideredTokens),
    });
    frequencyBuckets.push({
        label: 'Unknown',
        count: unknownFrequencyCount,
        statusCounts: unknownFrequencyStatusCounts,
        numOccurrences: unknownFrequencyOccurrences,
        percent: percent(unknownFrequencyCount, consideredTokens),
    });

    return {
        statusCounts,
        frequencyBuckets,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
    };
}

function dictionaryCountsFromRaw(
    dictionary: DictionaryStatisticsRawTrackSnapshot['stats']['dictionary']
): DictionaryStatisticsDictionaryCounts {
    let numKnownTokens = 0;
    let numIgnoredTokens = 0;
    for (const token of Object.values(dictionary.tokens)) {
        if (token.states.includes(TokenState.IGNORED)) {
            numIgnoredTokens += 1;
            continue;
        }
        const status = getCardTokenStatus(token.statuses, dictionary.dictionaryAnkiTreatSuspended);
        if (isTokenStatusKnown(status)) numKnownTokens += 1;
    }
    return { numKnownTokens, numIgnoredTokens };
}

function rewatchSnapshotsFromRaw(
    dictionaryKnownTokens: number,
    tokens: ProcessedTokenSnapshots,
    sentenceSnapshots: ProcessedSentenceSnapshot[],
    currentKnownTokens: number,
    consideredTokens: number
): DictionaryStatisticsRewatchSnapshot[] {
    const tokenEntries = Array.from(tokens.entries());
    const projectedStatuses = new Map<string, TokenStatus>(
        tokenEntries
            .filter(([, token]) => token.status === TokenStatus.UNKNOWN)
            .map(([tokenKey]) => [tokenKey, TokenStatus.LEARNING])
    );
    const rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[] = [];

    while (true) {
        const tokensToPromote = new Set<string>();
        for (const sentenceSnapshot of sentenceSnapshots) {
            const evaluated = evaluateSentenceSnapshot(sentenceSnapshot, projectedStatuses);
            const isIPlusOneUncollected =
                evaluated.numConsideredTokens > 0 && evaluated.numKnownTokens === evaluated.numConsideredTokens - 1;
            if (!isIPlusOneUncollected) continue;
            if (evaluated.uncollectedTokenKeys.length === 1 && evaluated.numUnknownTokens === 0) {
                tokensToPromote.add(evaluated.uncollectedTokenKeys[0]);
            }
        }
        if (!tokensToPromote.size) break;

        for (const tokenKey of Array.from(tokensToPromote).sort()) {
            const currentStatus = projectedStatuses.get(tokenKey) ?? tokens.get(tokenKey)?.status;
            if (currentStatus !== undefined && currentStatus < TokenStatus.LEARNING) {
                projectedStatuses.set(tokenKey, TokenStatus.LEARNING);
            }
        }

        const evaluatedProjectedSentences = sentenceSnapshots.map((sentenceSnapshot) =>
            evaluateSentenceSnapshot(sentenceSnapshot, projectedStatuses)
        );
        const projectedSentenceTotals = sentenceTotals(evaluatedProjectedSentences);
        const projectedSentenceBuckets = buildSentenceBucketData(evaluatedProjectedSentences, tokens);
        const { averageWordsPerSentence, averageKnownWordsPerSentence } =
            sentenceAveragesFromTotals(projectedSentenceTotals);
        const projectedStatusCounts = emptyStatusCounts();
        let projectedKnownTokens = 0;

        for (const [tokenKey, token] of tokenEntries) {
            if (token.ignored) continue;
            const projectedStatus = projectedStatuses.get(tokenKey) ?? token.status;
            const count = projectedStatusCounts.get(projectedStatus)!;
            count.numUnique += 1;
            count.numOccurrences += token.numOccurrences;
            if (isTokenStatusKnown(projectedStatus)) projectedKnownTokens += 1;
        }

        const comprehensionPercent = comprehensionFromStatusOccurrences(projectedStatusCounts);

        rewatchSnapshots.push({
            rewatch: rewatchSnapshots.length + 1,
            numKnownTokens: projectedKnownTokens,
            numDictionaryKnownTokens: dictionaryKnownTokens + (projectedKnownTokens - currentKnownTokens),
            knownPercent: percent(projectedKnownTokens, consideredTokens),
            comprehensionPercent,
            averageWordsPerSentence,
            averageKnownWordsPerSentence,
            sentenceTotals: projectedSentenceTotals,
            statusCounts: projectedStatusCounts,
            sentenceBuckets: projectedSentenceBuckets,
        });
    }

    return rewatchSnapshots;
}

function processDictionaryStatisticsTrackSnapshot(
    trackSnapshot: DictionaryStatisticsRawTrackSnapshot
): DictionaryStatisticsTrackSnapshot {
    const { dictionary, sentences } = trackSnapshot.stats;
    const sentenceSnapshots = processSentenceSnapshots(sentences);
    const dictionaryCounts = dictionaryCountsFromRaw(dictionary);

    const tokens: ProcessedTokenSnapshots = new Map();
    for (const { tokens: sentenceTokens } of sentenceSnapshots) {
        for (const [k, token] of sentenceTokens.entries()) tokens.set(k, mergeTokenSnapshot(tokens.get(k), token));
    }

    const {
        statusCounts,
        frequencyBuckets,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
    } = statusCountsAndFrequencies(tokens);
    const evaluatedSentenceSnapshots = sentenceSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot)
    );
    const currentSentenceTotals = sentenceTotals(evaluatedSentenceSnapshots);
    const { averageWordsPerSentence, averageKnownWordsPerSentence } = sentenceAveragesFromTotals(currentSentenceTotals);
    const currentSentenceBuckets = buildSentenceBucketData(evaluatedSentenceSnapshots, tokens);
    const sentenceComprehensionPoints = sentenceComprehensionPointsFromSentenceTotals(currentSentenceTotals);
    const trackAllSentenceEntries = allSentenceEntries(evaluatedSentenceSnapshots, tokens);
    const comprehensionPercent = comprehensionFromStatusOccurrences(statusCounts);
    const rewatchSnapshots = rewatchSnapshotsFromRaw(
        dictionaryCounts.numKnownTokens,
        tokens,
        sentenceSnapshots,
        numKnownTokens,
        consideredTokens
    );

    return {
        track: trackSnapshot.track,
        progress: trackSnapshot.progress,
        progressPercent: percent(trackSnapshot.progress.current, trackSnapshot.progress.total),
        statusColors: trackSnapshot.statusColors,
        numDictionaryKnownTokens: dictionaryCounts.numKnownTokens,
        numDictionaryIgnoredTokens: dictionaryCounts.numIgnoredTokens,
        numUniqueTokens: tokens.size,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
        knownPercent: percent(numKnownTokens, consideredTokens),
        comprehensionPercent,
        averageWordsPerSentence,
        averageKnownWordsPerSentence,
        sentenceTotals: currentSentenceTotals,
        sentenceComprehensionPoints,
        allSentenceEntries: trackAllSentenceEntries,
        statusCounts,
        frequencyBuckets,
        sentenceBuckets: currentSentenceBuckets,
        rewatchSnapshots,
    };
}

function compareSentenceFrequency(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    const leftFrequency = left.lowestFrequency ?? Number.POSITIVE_INFINITY;
    const rightFrequency = right.lowestFrequency ?? Number.POSITIVE_INFINITY;
    return leftFrequency - rightFrequency;
}

function compareSentenceOccurrences(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.highestOccurrences - right.highestOccurrences;
}

function compareSentenceComprehension(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.comprehensionPercent - right.comprehensionPercent;
}

function compareSentenceIndex(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.sentence.index - right.sentence.index;
}

function compareWithDirection(comparison: number, direction: DictionaryStatisticsSentenceSortDirection) {
    return direction === 'desc' ? -comparison : comparison;
}

function frequencyDirection(preferMostFrequent: boolean): DictionaryStatisticsSentenceSortDirection {
    return preferMostFrequent ? 'asc' : 'desc';
}

function countDirection(preferHighest: boolean): DictionaryStatisticsSentenceSortDirection {
    return preferHighest ? 'desc' : 'asc';
}

export function defaultDictionaryStatisticsSentenceSortDirection(sort: DictionaryStatisticsSentenceSort) {
    return sort === 'occurrences' || sort === 'comprehension' ? 'desc' : 'asc';
}

export function defaultDictionaryStatisticsSentenceSortState(
    sort: DictionaryStatisticsSentenceSort = 'index'
): DictionaryStatisticsSentenceSortState {
    return {
        sort,
        direction: defaultDictionaryStatisticsSentenceSortDirection(sort),
    };
}

export function nextDictionaryStatisticsSentenceSortState(
    current: DictionaryStatisticsSentenceSortState,
    sort: DictionaryStatisticsSentenceSort
): DictionaryStatisticsSentenceSortState {
    if (current.sort === sort) {
        return {
            sort,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
    }

    return defaultDictionaryStatisticsSentenceSortState(sort);
}

export function uncollectedSentenceBucketLabel(
    bucket: DictionaryStatisticsSentenceUncollectedBucket,
    uncollectedLabel: string
) {
    if (bucket.tokenCount > 1) return `${bucket.tokenCount}+ ${uncollectedLabel}`;
    return `${bucket.tokenCount} ${uncollectedLabel}`;
}

export function sentenceDialogBucketData(
    bucket: DictionaryStatisticsSentenceDialogBucket,
    sentenceBuckets: DictionaryStatisticsSentenceBuckets,
    labels: {
        knownSentencesLabel: string;
        uncollectedLabel: string;
    }
) {
    if (bucket.kind === 'allKnown') {
        return {
            label: labels.knownSentencesLabel,
            entries: sentenceBuckets.allKnown.entries,
        };
    }
    const uncollectedBucket = sentenceBuckets.uncollected[bucket.groupIndex];
    if (!uncollectedBucket) return;
    return {
        label: uncollectedSentenceBucketLabel(uncollectedBucket, labels.uncollectedLabel),
        entries: uncollectedBucket.entries,
    };
}

export function selectedRewatchSnapshotForTrack(
    trackSnapshot: DictionaryStatisticsTrackSnapshot,
    selectedRewatchesByTrack: Record<number, number>
) {
    if (!trackSnapshot.rewatchSnapshots.length) return;
    const selectedRewatch = Math.min(
        selectedRewatchesByTrack[trackSnapshot.track] ?? 1,
        trackSnapshot.rewatchSnapshots.length
    );
    return trackSnapshot.rewatchSnapshots[selectedRewatch - 1];
}

export function sortDictionaryStatisticsSentenceBucketEntries(
    entries: DictionaryStatisticsSentenceBucketEntry[],
    sortState: DictionaryStatisticsSentenceSortState
) {
    const next = entries.slice();
    next.sort((left, right) => {
        if (sortState.sort === 'comprehension') {
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                sortState.direction
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const preferHighest = sortState.direction === 'desc';
            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                frequencyDirection(preferHighest)
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                countDirection(preferHighest)
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            return compareSentenceIndex(left, right);
        }

        if (sortState.sort === 'frequency') {
            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                sortState.direction
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            const preferHighest = sortState.direction === 'asc';
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                countDirection(preferHighest)
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                countDirection(preferHighest)
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            return compareSentenceIndex(left, right);
        }

        if (sortState.sort === 'occurrences') {
            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                sortState.direction
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            const preferHighest = sortState.direction === 'desc';
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                countDirection(preferHighest)
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                frequencyDirection(preferHighest)
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            return compareSentenceIndex(left, right);
        }

        const indexComparison = compareWithDirection(compareSentenceIndex(left, right), sortState.direction);
        if (indexComparison !== 0) return indexComparison;

        const frequencyComparison = compareWithDirection(compareSentenceFrequency(left, right), 'asc');
        if (frequencyComparison !== 0) return frequencyComparison;

        const occurrenceComparison = compareWithDirection(compareSentenceOccurrences(left, right), 'desc');
        if (occurrenceComparison !== 0) return occurrenceComparison;

        const comprehensionComparison = compareWithDirection(compareSentenceComprehension(left, right), 'desc');
        if (comprehensionComparison !== 0) return comprehensionComparison;

        return compareSentenceIndex(left, right);
    });
    return next;
}

export function processDictionaryStatisticsSnapshot(
    snapshot?: DictionaryStatisticsSnapshot
): DictionaryStatisticsTrackSnapshot[] {
    return snapshot?.snapshots.map(processDictionaryStatisticsTrackSnapshot) ?? [];
}
