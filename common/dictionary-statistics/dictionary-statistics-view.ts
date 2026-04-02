import { Progress } from '@project/common';
import { isTokenStatusKnown, NUM_TOKEN_STATUSES, TokenState, TokenStatus } from '@project/common/settings';
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
}

export interface DictionaryStatisticsSentenceBucketEntry {
    sentence: DictionaryStatisticsSentence;
    numConsideredTokens: number;
    numKnownTokens: number;
    numUnknownTokens: number;
    numUncollectedTokens: number;
    lowestFrequency?: number;
    highestOccurrences: number;
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
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
}

export interface DictionaryStatisticsTrackSnapshot {
    track: number;
    progress: Progress;
    statusColors: Record<TokenStatus, string>;
    numDictionaryKnownTokens: number;
    numDictionaryIgnoredTokens: number;
    numUniqueTokens: number;
    numIgnoredTokens: number;
    numIgnoredOccurrences: number;
    numKnownTokens: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
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
        statusCounts: sentenceSnapshots.map((sentenceSnapshot) => ({
            sentence: sentenceSnapshot.sentence,
            statusCounts: sentenceSnapshot.statusCounts,
        })),
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

    return {
        sentence: sentenceSnapshot.sentence,
        numConsideredTokens: sentenceSnapshot.numConsideredTokens,
        numKnownTokens: sentenceSnapshot.numKnownTokens,
        numUnknownTokens: sentenceSnapshot.numUnknownTokens,
        numUncollectedTokens: sentenceSnapshot.numUncollectedTokens,
        lowestFrequency,
        highestOccurrences,
    };
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

    const frequencyBuckets: DictionaryStatisticsFrequencyBucket[] = dictionaryStatisticsFrequencyBuckets.map(
        (curr, index) => {
            const prev = dictionaryStatisticsFrequencyBuckets[index - 1];
            return {
                label: prev === undefined ? `1-${curr}` : `${prev + 1}-${curr}`,
                count: frequencyCounts[index],
                statusCounts: frequencyStatusCounts[index],
                numOccurrences: frequencyOccurrenceCounts[index],
            };
        }
    );
    frequencyBuckets.push({
        label: `${dictionaryStatisticsFrequencyBuckets[dictionaryStatisticsFrequencyBuckets.length - 1]}+`,
        count: overflowFrequencyCount,
        statusCounts: overflowFrequencyStatusCounts,
        numOccurrences: overflowFrequencyOccurrences,
    });
    frequencyBuckets.push({
        label: 'Unknown',
        count: unknownFrequencyCount,
        statusCounts: unknownFrequencyStatusCounts,
        numOccurrences: unknownFrequencyOccurrences,
    });

    return {
        statusCounts,
        frequencyBuckets,
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
    currentKnownTokens: number
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

        rewatchSnapshots.push({
            rewatch: rewatchSnapshots.length + 1,
            numKnownTokens: projectedKnownTokens,
            numDictionaryKnownTokens: dictionaryKnownTokens + (projectedKnownTokens - currentKnownTokens),
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

    const { statusCounts, frequencyBuckets, numIgnoredTokens, numIgnoredOccurrences, numKnownTokens } =
        statusCountsAndFrequencies(tokens);
    const evaluatedSentenceSnapshots = sentenceSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot)
    );
    const currentSentenceTotals = sentenceTotals(evaluatedSentenceSnapshots);
    const currentSentenceBuckets = buildSentenceBucketData(evaluatedSentenceSnapshots, tokens);
    const rewatchSnapshots = rewatchSnapshotsFromRaw(
        dictionaryCounts.numKnownTokens,
        tokens,
        sentenceSnapshots,
        numKnownTokens
    );

    return {
        track: trackSnapshot.track,
        progress: trackSnapshot.progress,
        statusColors: trackSnapshot.statusColors,
        numDictionaryKnownTokens: dictionaryCounts.numKnownTokens,
        numDictionaryIgnoredTokens: dictionaryCounts.numIgnoredTokens,
        numUniqueTokens: tokens.size,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
        sentenceTotals: currentSentenceTotals,
        statusCounts,
        frequencyBuckets,
        sentenceBuckets: currentSentenceBuckets,
        rewatchSnapshots,
    };
}

export function processDictionaryStatisticsSnapshot(
    snapshot?: DictionaryStatisticsSnapshot
): DictionaryStatisticsTrackSnapshot[] {
    return snapshot?.snapshots.map(processDictionaryStatisticsTrackSnapshot) ?? [];
}
