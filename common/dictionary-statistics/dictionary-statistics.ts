import { Progress, Token } from '@project/common';
import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    dictionaryTrackEnabled,
    isTokenStatusKnown,
    NUM_TOKEN_STATUSES,
    SettingsProvider,
    TokenState,
    TokenStatusConfig,
    TokenStatus,
} from '@project/common/settings';
import { HAS_LETTER_REGEX } from '@project/common/util';

const dictionaryStatisticsFrequencyBuckets = [1000, 2000, 5000, 10000, 20000] as const; // Overflow and unknown appears after these
const dictionaryStatisticsSentenceBucketTokenCounts = [1] as const;
const dictionaryStatisticsSentenceBucketOverflowTokenCount =
    dictionaryStatisticsSentenceBucketTokenCounts[dictionaryStatisticsSentenceBucketTokenCounts.length - 1] + 1;

export type DictionaryStatisticsSentenceBucketStatus = TokenStatus.UNCOLLECTED;

export interface DictionaryStatisticsSentence {
    text: string;
    start: number;
    end: number;
    track: number;
    index: number;
    richText?: string;
}

export interface DictionaryStatisticsTokenStatusCount {
    numUnique: number;
    numOccurrences: number;
}

export type DictionaryStatisticsTokenStatusCounts = Record<TokenStatus, DictionaryStatisticsTokenStatusCount>;

function emptyStatusCounts(): DictionaryStatisticsTokenStatusCounts {
    const counts = {} as DictionaryStatisticsTokenStatusCounts;
    for (let i: TokenStatus = 0; i < NUM_TOKEN_STATUSES; ++i) {
        counts[i] = {
            numUnique: 0,
            numOccurrences: 0,
        };
    }
    return counts;
}

function emptySentenceStatusBuckets(): Record<
    DictionaryStatisticsSentenceBucketStatus,
    DictionaryStatisticsSentenceStatusBucket[]
> {
    const uncollectedBuckets: DictionaryStatisticsSentenceStatusBucket[] =
        dictionaryStatisticsSentenceBucketTokenCounts.map((tokenCount) => ({
            tokenCount,
            overflow: false,
            count: 0,
            entries: [],
        }));
    uncollectedBuckets.push({
        tokenCount: dictionaryStatisticsSentenceBucketOverflowTokenCount,
        overflow: true,
        count: 0,
        entries: [],
    });

    return {
        [TokenStatus.UNCOLLECTED]: uncollectedBuckets,
    };
}

function dictionaryStatisticsSentence(sentence: DictionaryStatisticsSentence): DictionaryStatisticsSentence {
    return {
        text: sentence.text,
        start: sentence.start,
        end: sentence.end,
        track: sentence.track,
        index: sentence.index,
        richText: sentence.richText,
    };
}

interface TrackState {
    numDictionaryKnownTokens: number;
    numDictionaryIgnoredTokens: number;
    statusColors: Record<TokenStatus, string>;
    progress: Progress;
    uniqueTokens: Map<string, UniqueToken>;
    sentenceStates: Map<number, SentenceState>;
}

function statusColorsFromConfig(tokenStatusConfig: readonly TokenStatusConfig[]): Record<TokenStatus, string> {
    const statusColors = {} as Record<TokenStatus, string>;
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        const color = tokenStatusConfig[status]?.color ?? '#9E9E9E';
        const alpha = tokenStatusConfig[status]?.alpha ?? 'FF';
        statusColors[status] = `${color}${alpha}`;
    }
    return statusColors;
}

interface UniqueToken {
    status: TokenStatus;
    ignored: boolean;
    frequency?: number | null;
    numOccurrences: number;
    numSentenceReferences: number;
}

interface SentenceState {
    sentence: DictionaryStatisticsSentence;
    uniqueTokensKeys: string[];
    uniqueTokenOccurrences: Map<string, number>;
}

interface EvaluatedSentenceState {
    sentence: DictionaryStatisticsSentence;
    consideredTokens: number;
    knownTokens: number;
    unknownTokens: number;
    uncollectedTokens: number;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    consideredTokenKeys: string[];
    uncollectedTokenKeys: string[];
}

export interface DictionaryStatisticsSnapshot {
    mediaId: string;
    snapshots: DictionaryStatisticsTrackSnapshot[];
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

export interface DictionaryStatisticsSentenceTotals {
    processedSentenceCount: number;
    totalWords: number;
    totalKnownWords: number;
    statusCounts: DictionaryStatisticsTokenStatusCounts[];
}

export interface DictionaryStatisticsFrequencyBucket {
    label: string;
    count: number;
    knownCount: number;
    occurrences: number;
}

export interface DictionaryStatisticsSentenceBucketSummary {
    count: number;
    entries: DictionaryStatisticsSentenceBucketEntry[];
}

export interface DictionaryStatisticsSentenceStatusBucket extends DictionaryStatisticsSentenceBucketSummary {
    tokenCount: number;
    overflow: boolean;
}

export interface DictionaryStatisticsSentenceBuckets {
    allKnown: DictionaryStatisticsSentenceBucketSummary;
    byStatus: Record<DictionaryStatisticsSentenceBucketStatus, DictionaryStatisticsSentenceStatusBucket[]>;
}

export interface DictionaryStatisticsSentenceBucketEntry {
    sentence: DictionaryStatisticsSentence;
    consideredTokens: number;
    knownTokens: number;
    unknownTokens: number;
    uncollectedTokens: number;
    lowestFrequency?: number;
    highestOccurrences: number;
}

export interface DictionaryStatisticsRewatchSnapshot {
    rewatch: number;
    numKnownTokens: number;
    numDictionaryKnownTokens: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
}

function emptySentenceBuckets(): DictionaryStatisticsSentenceBuckets {
    return {
        allKnown: {
            count: 0,
            entries: [],
        },
        byStatus: emptySentenceStatusBuckets(),
    };
}

function sentenceStatusBucketForCount(sentenceBuckets: DictionaryStatisticsSentenceStatusBucket[], tokenCount: number) {
    if (tokenCount <= 0) return;
    for (let i = 0; i < sentenceBuckets.length; ++i) {
        const sentenceBucket = sentenceBuckets[i];
        if (sentenceBucket.overflow) break;
        if (tokenCount === sentenceBucket.tokenCount) return sentenceBucket;
    }
    const overflowBucket = sentenceBuckets[sentenceBuckets.length - 1];
    if (overflowBucket?.overflow && tokenCount >= overflowBucket.tokenCount) return overflowBucket;
    return;
}

function evaluateSentenceState(
    sentenceState: SentenceState,
    uniqueTokens: Map<string, UniqueToken>,
    projectedStatuses?: Map<string, TokenStatus>
): EvaluatedSentenceState {
    let consideredTokens = 0;
    let knownTokens = 0;
    let unknownTokens = 0;
    let uncollectedTokens = 0;
    const statusCounts = emptyStatusCounts();
    const consideredTokenKeys: string[] = [];
    const uncollectedTokenKeys: string[] = [];

    for (const tokenKey of sentenceState.uniqueTokensKeys) {
        const token = uniqueTokens.get(tokenKey);
        if (!token || token.ignored) continue;
        const occurrences = sentenceState.uniqueTokenOccurrences.get(tokenKey) ?? 0;
        consideredTokens += 1;
        consideredTokenKeys.push(tokenKey);

        const status = projectedStatuses?.get(tokenKey) ?? token.status;
        statusCounts[status].numUnique += 1;
        statusCounts[status].numOccurrences += occurrences;
        if (isTokenStatusKnown(status)) {
            knownTokens += 1;
            continue;
        }
        if (status === TokenStatus.UNKNOWN) {
            unknownTokens += 1;
            continue;
        }
        if (status === TokenStatus.UNCOLLECTED) {
            uncollectedTokens += 1;
            uncollectedTokenKeys.push(tokenKey);
        }
    }

    return {
        sentence: sentenceState.sentence,
        consideredTokens,
        knownTokens,
        unknownTokens,
        uncollectedTokens,
        statusCounts,
        consideredTokenKeys,
        uncollectedTokenKeys,
    };
}

function sentenceBucketEntry(
    sentenceState: EvaluatedSentenceState,
    relevantTokenKeys: string[],
    uniqueTokens: Map<string, UniqueToken>
): DictionaryStatisticsSentenceBucketEntry {
    let lowestFrequency: number | undefined;
    let highestOccurrences = 0;

    for (const tokenKey of relevantTokenKeys) {
        const token = uniqueTokens.get(tokenKey);
        if (!token || token.ignored) continue;

        if (token.frequency != null && (lowestFrequency === undefined || token.frequency < lowestFrequency)) {
            lowestFrequency = token.frequency;
        }
        if (token.numOccurrences > highestOccurrences) highestOccurrences = token.numOccurrences;
    }

    return {
        sentence: sentenceState.sentence,
        consideredTokens: sentenceState.consideredTokens,
        knownTokens: sentenceState.knownTokens,
        unknownTokens: sentenceState.unknownTokens,
        uncollectedTokens: sentenceState.uncollectedTokens,
        lowestFrequency,
        highestOccurrences,
    };
}

function buildSentenceBucketData(
    sentenceStates: Iterable<EvaluatedSentenceState>,
    uniqueTokens: Map<string, UniqueToken>
): DictionaryStatisticsSentenceBuckets {
    const sentenceBuckets = emptySentenceBuckets();

    for (const sentenceState of sentenceStates) {
        if (sentenceState.consideredTokens && sentenceState.knownTokens === sentenceState.consideredTokens) {
            sentenceBuckets.allKnown.count += 1;
            sentenceBuckets.allKnown.entries.push(
                sentenceBucketEntry(sentenceState, sentenceState.consideredTokenKeys, uniqueTokens)
            );
        }

        const uncollectedBucket = sentenceStatusBucketForCount(
            sentenceBuckets.byStatus[TokenStatus.UNCOLLECTED],
            sentenceState.uncollectedTokens
        );
        if (uncollectedBucket) {
            uncollectedBucket.count += 1;
            uncollectedBucket.entries.push(
                sentenceBucketEntry(sentenceState, sentenceState.uncollectedTokenKeys, uniqueTokens)
            );
        }
    }

    return sentenceBuckets;
}

function evaluatedSentenceStatesForTrack(
    ts: TrackState,
    projectedStatuses?: Map<string, TokenStatus>
): EvaluatedSentenceState[] {
    return Array.from(ts.sentenceStates.values(), (sentenceState) =>
        evaluateSentenceState(sentenceState, ts.uniqueTokens, projectedStatuses)
    );
}

function sentenceTotals(sentenceStates: EvaluatedSentenceState[]): DictionaryStatisticsSentenceTotals {
    const totalWords = sentenceStates.reduce((sum, sentenceState) => sum + sentenceState.consideredTokens, 0);
    const totalKnownWords = sentenceStates.reduce((sum, sentenceState) => sum + sentenceState.knownTokens, 0);

    return {
        processedSentenceCount: sentenceStates.length,
        totalWords,
        totalKnownWords,
        statusCounts: sentenceStates.map((sentenceState) => sentenceState.statusCounts),
    };
}

function buildRewatchSnapshots(ts: TrackState): DictionaryStatisticsRewatchSnapshot[] {
    let currentKnownTokens = 0;
    for (const token of ts.uniqueTokens.values()) {
        if (!token.ignored && isTokenStatusKnown(token.status)) {
            currentKnownTokens += 1;
        }
    }

    const projectedStatuses = new Map<string, TokenStatus>(
        Array.from(ts.uniqueTokens.entries()).map(([tokenKey, token]) => [
            tokenKey,
            token.status === TokenStatus.UNKNOWN ? TokenStatus.LEARNING : token.status,
        ])
    );
    const rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[] = [];

    while (true) {
        const tokensToPromote = new Set<string>();
        for (const sentenceState of ts.sentenceStates.values()) {
            const evaluated = evaluateSentenceState(sentenceState, ts.uniqueTokens, projectedStatuses);
            const isIPlusOneUncollected =
                evaluated.consideredTokens > 0 && evaluated.knownTokens === evaluated.consideredTokens - 1;
            if (!isIPlusOneUncollected) continue;
            if (evaluated.uncollectedTokenKeys.length === 1 && evaluated.unknownTokens === 0) {
                tokensToPromote.add(evaluated.uncollectedTokenKeys[0]);
            }
        }
        if (!tokensToPromote.size) break;

        for (const tokenKey of tokensToPromote) {
            const status = projectedStatuses.get(tokenKey);
            if (status !== undefined && status < TokenStatus.LEARNING) {
                projectedStatuses.set(tokenKey, TokenStatus.LEARNING);
            }
        }

        const evaluatedSentenceStates = evaluatedSentenceStatesForTrack(ts, projectedStatuses);
        const sentenceBuckets = buildSentenceBucketData(evaluatedSentenceStates, ts.uniqueTokens);
        const currentSentenceTotals = sentenceTotals(evaluatedSentenceStates);
        const statusCounts = emptyStatusCounts();
        let numKnownTokens = 0;
        for (const [tokenKey, token] of ts.uniqueTokens.entries()) {
            if (token.ignored) continue;
            const status = projectedStatuses.get(tokenKey) ?? token.status;
            statusCounts[status].numUnique += 1;
            statusCounts[status].numOccurrences += token.numOccurrences;
            if (isTokenStatusKnown(status)) numKnownTokens += 1;
        }

        rewatchSnapshots.push({
            rewatch: rewatchSnapshots.length + 1,
            numKnownTokens,
            numDictionaryKnownTokens: ts.numDictionaryKnownTokens + (numKnownTokens - currentKnownTokens),
            sentenceTotals: currentSentenceTotals,
            statusCounts,
            sentenceBuckets,
        });
    }

    return rewatchSnapshots;
}

export class DictionaryStatistics {
    private readonly settingsProvider: SettingsProvider;
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly mediaId: string;
    private readonly trackStates: Map<number, TrackState>;
    private lastCancelledAt: number;

    constructor(settingsProvider: SettingsProvider, dictionaryProvider: DictionaryProvider, mediaId: string) {
        this.settingsProvider = settingsProvider;
        this.dictionaryProvider = dictionaryProvider;
        this.mediaId = mediaId;
        this.trackStates = new Map();
        this.lastCancelledAt = 0;
    }

    hasStatistics(): boolean {
        return this.trackStates.size > 0;
    }

    reset(): void {
        const startTime = Date.now();
        this.trackStates.clear();
        void this._publish(undefined, startTime);
        this.lastCancelledAt = Date.now();
    }

    publishSnapshot(): void {
        const startTime = Date.now();
        void this._publish(this.trackStates.size > 0 ? this._snapshot() : undefined, startTime);
    }

    init(track: number, total: number): void {
        this.trackStates.set(track, {
            numDictionaryKnownTokens: 0,
            numDictionaryIgnoredTokens: 0,
            statusColors: statusColorsFromConfig([]),
            progress: { current: 0, total, startedAt: Date.now() },
            uniqueTokens: new Map(),
            sentenceStates: new Map(),
        });
    }

    updateProgress(track: number, current: number): boolean {
        const startTime = Date.now();
        const ts = this.trackStates.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
        ts.progress.current = current;
        this._publish(this._snapshot(), startTime);
        return ts.progress.current >= ts.progress.total;
    }

    async refreshDictionaryKnownTokens(profile: string | undefined): Promise<void> {
        const startTime = Date.now();
        const settings = await this.settingsProvider.getAll();
        await Promise.all(
            settings.dictionaryTracks.map(async (dt, track) => {
                if (!dictionaryTrackEnabled(dt)) return;
                const ts = this.trackStates.get(track);
                if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
                const { knownTokens, ignoredTokens } = await this.dictionaryProvider.countTokens(
                    profile,
                    track,
                    settings
                );
                ts.numDictionaryKnownTokens = knownTokens;
                ts.numDictionaryIgnoredTokens = ignoredTokens;
                ts.statusColors = statusColorsFromConfig(dt.dictionaryTokenStatusConfig);
                await this._publish(this._snapshot(), startTime);
            })
        );
    }

    async ingest(track: number, tokens: Token[], sentence: DictionaryStatisticsSentence): Promise<void> {
        const ts = this.trackStates.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);

        // Aggregate unique tokens in this sentence
        const uniqueTokens = new Map<string, Token>();
        const uniqueTokenOccurrences = new Map<string, number>();
        for (const token of tokens) {
            if (!token.groupingKey) continue;
            const tokenText = sentence.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(tokenText)) continue;

            const uniqueTokenKey = token.groupingKey;
            uniqueTokenOccurrences.set(uniqueTokenKey, (uniqueTokenOccurrences.get(uniqueTokenKey) ?? 0) + 1);
            const existing = uniqueTokens.get(uniqueTokenKey);
            if (!existing) {
                uniqueTokens.set(uniqueTokenKey, token);
                continue;
            }
            uniqueTokens.set(uniqueTokenKey, {
                pos: existing.pos,
                states: existing.states.includes(TokenState.IGNORED) ? existing.states : token.states,
                status: Math.max(existing.status ?? TokenStatus.UNCOLLECTED, token.status ?? TokenStatus.UNCOLLECTED),
                readings: existing.readings,
                frequency: existing.frequency ?? token.frequency,
            });
        }

        // Remove previous sentence's tokens to later re-ingest
        const prevSentence = ts.sentenceStates.get(sentence.index);
        if (prevSentence) {
            for (const uniqueTokenKey of prevSentence.uniqueTokensKeys) {
                const existingUniqueToken = ts.uniqueTokens.get(uniqueTokenKey);
                if (!existingUniqueToken) continue;
                existingUniqueToken.numOccurrences -= prevSentence.uniqueTokenOccurrences.get(uniqueTokenKey) ?? 0;
                if (existingUniqueToken.numSentenceReferences <= 1) ts.uniqueTokens.delete(uniqueTokenKey);
                else existingUniqueToken.numSentenceReferences -= 1;
            }
        }

        // Ingest unique tokens
        const ss: SentenceState = {
            sentence: dictionaryStatisticsSentence(sentence),
            uniqueTokensKeys: [],
            uniqueTokenOccurrences,
        };
        for (const [uniqueTokenKey, token] of uniqueTokens.entries()) {
            ss.uniqueTokensKeys.push(uniqueTokenKey);
            const status = token.status!;
            const ignored = token.states.includes(TokenState.IGNORED);
            const numOccurrences = uniqueTokenOccurrences.get(uniqueTokenKey)!;

            const existing = ts.uniqueTokens.get(uniqueTokenKey);
            if (existing) {
                existing.status = status;
                existing.ignored = ignored;
                existing.frequency = token.frequency;
                existing.numOccurrences += numOccurrences;
                existing.numSentenceReferences += 1;
            } else {
                ts.uniqueTokens.set(uniqueTokenKey, {
                    status,
                    ignored,
                    frequency: token.frequency,
                    numOccurrences,
                    numSentenceReferences: 1,
                });
            }
        }
        ts.sentenceStates.set(sentence.index, ss);
    }

    private _snapshot(): DictionaryStatisticsSnapshot {
        return {
            mediaId: this.mediaId,
            snapshots: Array.from(this.trackStates.entries())
                .sort(([left], [right]) => left - right)
                .map(([track, ts]) => {
                    const statusCounts = emptyStatusCounts();
                    const frequencyCounts: number[] = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
                    const frequencyKnownCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
                    const frequencyOccurrenceCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
                    let overflowFrequencyCount = 0;
                    let overflowFrequencyKnownCount = 0;
                    let overflowFrequencyOccurrences = 0;
                    let unknownFrequencyCount = 0;
                    let unknownFrequencyKnownCount = 0;
                    let unknownFrequencyOccurrences = 0;
                    let numIgnoredTokens = 0;
                    let numIgnoredOccurrences = 0;
                    let numKnownTokens = 0;

                    for (const token of ts.uniqueTokens.values()) {
                        if (token.ignored) {
                            numIgnoredTokens += 1;
                            numIgnoredOccurrences += token.numOccurrences;
                            continue;
                        }

                        statusCounts[token.status].numUnique += 1;
                        statusCounts[token.status].numOccurrences += token.numOccurrences;
                        const knownToken = isTokenStatusKnown(token.status);
                        if (knownToken) numKnownTokens += 1;

                        if (token.frequency == null) {
                            unknownFrequencyCount += 1;
                            if (knownToken) unknownFrequencyKnownCount += 1;
                            unknownFrequencyOccurrences += token.numOccurrences;
                            continue;
                        }
                        let isOverflow = true;
                        for (let i = 0; i < dictionaryStatisticsFrequencyBuckets.length; ++i) {
                            if (token.frequency > dictionaryStatisticsFrequencyBuckets[i]) continue;
                            frequencyCounts[i] += 1;
                            if (knownToken) frequencyKnownCounts[i] += 1;
                            frequencyOccurrenceCounts[i] += token.numOccurrences;
                            isOverflow = false;
                            break;
                        }
                        if (isOverflow) {
                            overflowFrequencyCount += 1;
                            if (knownToken) overflowFrequencyKnownCount += 1;
                            overflowFrequencyOccurrences += token.numOccurrences;
                        }
                    }

                    const evaluatedSentenceStates = evaluatedSentenceStatesForTrack(ts);
                    const sentenceBuckets = buildSentenceBucketData(evaluatedSentenceStates, ts.uniqueTokens);
                    const currentSentenceTotals = sentenceTotals(evaluatedSentenceStates);
                    const rewatchSnapshots = buildRewatchSnapshots(ts);

                    const frequencyBuckets: DictionaryStatisticsFrequencyBucket[] =
                        dictionaryStatisticsFrequencyBuckets.map((curr, index) => {
                            const prev = dictionaryStatisticsFrequencyBuckets[index - 1];
                            return {
                                label: prev === undefined ? `1-${curr}` : `${prev + 1}-${curr}`,
                                count: frequencyCounts[index],
                                knownCount: frequencyKnownCounts[index],
                                occurrences: frequencyOccurrenceCounts[index],
                            };
                        });
                    frequencyBuckets.push({
                        label: `${dictionaryStatisticsFrequencyBuckets[dictionaryStatisticsFrequencyBuckets.length - 1]}+`,
                        count: overflowFrequencyCount,
                        knownCount: overflowFrequencyKnownCount,
                        occurrences: overflowFrequencyOccurrences,
                    });
                    frequencyBuckets.push({
                        label: 'Unknown',
                        count: unknownFrequencyCount,
                        knownCount: unknownFrequencyKnownCount,
                        occurrences: unknownFrequencyOccurrences,
                    });

                    return {
                        track,
                        progress: ts.progress,
                        statusColors: ts.statusColors,
                        numDictionaryKnownTokens: ts.numDictionaryKnownTokens,
                        numDictionaryIgnoredTokens: ts.numDictionaryIgnoredTokens,
                        numUniqueTokens: ts.uniqueTokens.size,
                        numIgnoredTokens,
                        numIgnoredOccurrences,
                        numKnownTokens,
                        sentenceTotals: currentSentenceTotals,
                        statusCounts,
                        frequencyBuckets,
                        sentenceBuckets,
                        rewatchSnapshots,
                    };
                }),
        };
    }

    private async _publish(snapshot: DictionaryStatisticsSnapshot | undefined, startTime: number): Promise<void> {
        if (startTime <= this.lastCancelledAt) return;
        return this.dictionaryProvider.publishStatisticsSnapshot(this.mediaId, snapshot);
    }
}
