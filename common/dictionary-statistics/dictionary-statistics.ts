import { Progress, Token } from '@project/common';
import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    dictionaryTrackEnabled,
    isTokenStatusKnown,
    NUM_TOKEN_STATUSES,
    SettingsProvider,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { HAS_LETTER_REGEX } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan';

const dictionaryStatisticsFrequencyBuckets = [1000, 2000, 5000, 10000, 20000] as const; // Overflow and unknown appears after these
const dictionaryStatisticsSentenceBucketTokenCounts = [1] as const;
const dictionaryStatisticsSentenceBucketOverflowTokenCount =
    dictionaryStatisticsSentenceBucketTokenCounts[dictionaryStatisticsSentenceBucketTokenCounts.length - 1] + 1;

export type DictionaryStatisticsSentenceBucketStatus = TokenStatus.UNCOLLECTED; // Only have sentence buckets for Uncollected but considered Unknown as well

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
    progress: Progress;
    uniqueTokens: Map<string, UniqueToken>;
    sentenceStates: Map<number, SentenceState>;
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
    consideredTokens: number;
    knownTokens: number;
    unknownTokens: number;
    uncollectedTokens: number;
}

interface EvaluatedSentenceState {
    sentence: DictionaryStatisticsSentence;
    consideredTokens: number;
    knownTokens: number;
    unknownTokens: number;
    uncollectedTokens: number;
    consideredTokenKeys: string[];
    unknownTokenKeys: string[];
    uncollectedTokenKeys: string[];
}

export interface DictionaryStatisticsSnapshot {
    mediaId: string;
    snapshots: DictionaryStatisticsTrackSnapshot[];
}

export interface DictionaryStatisticsTrackSnapshot {
    track: number;
    progress: Progress;
    numDictionaryKnownTokens: number;
    numUniqueTokens: number;
    numIgnoredTokens: number;
    numIgnoredOccurrences: number;
    numKnownTokens: number;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    frequencyBuckets: DictionaryStatisticsFrequencyBucket[];
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[];
}

export interface DictionaryStatisticsFrequencyBucket {
    label: string;
    count: number;
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
    if (tokenCount <= 0) {
        return undefined;
    }

    const overflowBucket = sentenceBuckets[sentenceBuckets.length - 1];

    for (let i = 0; i < sentenceBuckets.length; ++i) {
        const sentenceBucket = sentenceBuckets[i];
        if (sentenceBucket.overflow) {
            break;
        }

        if (tokenCount === sentenceBucket.tokenCount) {
            return sentenceBucket;
        }
    }

    if (overflowBucket?.overflow && tokenCount >= overflowBucket.tokenCount) {
        return overflowBucket;
    }

    return undefined;
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
    const consideredTokenKeys: string[] = [];
    const unknownTokenKeys: string[] = [];
    const uncollectedTokenKeys: string[] = [];

    for (const tokenKey of sentenceState.uniqueTokensKeys) {
        const token = uniqueTokens.get(tokenKey);
        if (!token || token.ignored) continue;

        const status = projectedStatuses?.get(tokenKey) ?? token.status;
        consideredTokens += 1;
        consideredTokenKeys.push(tokenKey);

        if (isTokenStatusKnown(status)) {
            knownTokens += 1;
            continue;
        }

        if (status === TokenStatus.UNKNOWN) {
            unknownTokens += 1;
            unknownTokenKeys.push(tokenKey);
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
        consideredTokenKeys,
        unknownTokenKeys,
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

        if (token.numOccurrences > highestOccurrences) {
            highestOccurrences = token.numOccurrences;
        }
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

        const uncollectedSentenceTokenKeys = [...sentenceState.unknownTokenKeys, ...sentenceState.uncollectedTokenKeys];
        const uncollectedSentenceTokenCount = sentenceState.unknownTokens + sentenceState.uncollectedTokens;

        const uncollectedBucket = sentenceStatusBucketForCount(
            sentenceBuckets.byStatus[TokenStatus.UNCOLLECTED],
            uncollectedSentenceTokenCount
        );

        if (uncollectedBucket) {
            uncollectedBucket.count += 1;
            uncollectedBucket.entries.push(
                sentenceBucketEntry(sentenceState, uncollectedSentenceTokenKeys, uniqueTokens)
            );
        }
    }

    return sentenceBuckets;
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

        const evaluatedSentenceStates = Array.from(ts.sentenceStates.values(), (sentenceState) =>
            evaluateSentenceState(sentenceState, ts.uniqueTokens, projectedStatuses)
        );
        const sentenceBuckets = buildSentenceBucketData(evaluatedSentenceStates, ts.uniqueTokens);
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
                const numDictionaryKnownTokens = await this.dictionaryProvider.countKnownTokens(
                    profile,
                    track,
                    settings
                );
                ts.numDictionaryKnownTokens = numDictionaryKnownTokens;
                await this._publish(this._snapshot(), startTime);
            })
        );
    }

    async ingest(track: number, tokens: Token[], sentence: DictionaryStatisticsSentence, yt: Yomitan): Promise<void> {
        const ts = this.trackStates.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
        const sentenceText = sentence.text;

        // Aggregate unique tokens in this sentence
        const uniqueTokens = new Map<string, Token>();
        const uniqueTokenOccurrences = new Map<string, number>();
        for (const token of tokens) {
            let uniqueTokenKey = sentenceText.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(uniqueTokenKey)) continue;

            const lemmas = await yt.lemmatize(uniqueTokenKey);
            if (lemmas?.length) {
                let foundLemma = false;
                for (const lemma of lemmas) {
                    if (uniqueTokens.has(lemma) || ts.uniqueTokens.has(lemma)) {
                        uniqueTokenKey = lemma;
                        foundLemma = true;
                        break;
                    }
                }
                if (!foundLemma) uniqueTokenKey = lemmas[0];
            }

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
            consideredTokens: 0,
            knownTokens: 0,
            unknownTokens: 0,
            uncollectedTokens: 0,
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
            if (ignored) continue;

            ss.consideredTokens += 1;
            if (isTokenStatusKnown(status)) ss.knownTokens += 1;
            if (status === TokenStatus.UNKNOWN) ss.unknownTokens += 1;
            if (status === TokenStatus.UNCOLLECTED) ss.uncollectedTokens += 1;
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
                    const frequencyOccurrenceCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
                    let overflowFrequencyCount = 0;
                    let overflowFrequencyOccurrences = 0;
                    let unknownFrequencyCount = 0;
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
                        if (isTokenStatusKnown(token.status)) numKnownTokens += 1;

                        if (token.frequency == null) {
                            unknownFrequencyCount += 1;
                            unknownFrequencyOccurrences += token.numOccurrences;
                            continue;
                        }
                        let isOverflow = true;
                        for (let i = 0; i < dictionaryStatisticsFrequencyBuckets.length; ++i) {
                            if (token.frequency > dictionaryStatisticsFrequencyBuckets[i]) continue;
                            frequencyCounts[i] += 1;
                            frequencyOccurrenceCounts[i] += token.numOccurrences;
                            isOverflow = false;
                            break;
                        }
                        if (isOverflow) {
                            overflowFrequencyCount += 1;
                            overflowFrequencyOccurrences += token.numOccurrences;
                        }
                    }

                    const sentenceBuckets = buildSentenceBucketData(
                        Array.from(ts.sentenceStates.values(), (sentenceState) =>
                            evaluateSentenceState(sentenceState, ts.uniqueTokens)
                        ),
                        ts.uniqueTokens
                    );
                    const rewatchSnapshots = buildRewatchSnapshots(ts);

                    const frequencyBuckets: DictionaryStatisticsFrequencyBucket[] =
                        dictionaryStatisticsFrequencyBuckets.map((curr, index) => {
                            const prev = dictionaryStatisticsFrequencyBuckets[index - 1];
                            return {
                                label: prev === undefined ? `1-${curr}` : `${prev + 1}-${curr}`,
                                count: frequencyCounts[index],
                                occurrences: frequencyOccurrenceCounts[index],
                            };
                        });
                    frequencyBuckets.push({
                        label: `${dictionaryStatisticsFrequencyBuckets[dictionaryStatisticsFrequencyBuckets.length - 1]}+`,
                        count: overflowFrequencyCount,
                        occurrences: overflowFrequencyOccurrences,
                    });
                    frequencyBuckets.push({
                        label: 'Unknown',
                        count: unknownFrequencyCount,
                        occurrences: unknownFrequencyOccurrences,
                    });

                    return {
                        track,
                        progress: ts.progress,
                        numDictionaryKnownTokens: ts.numDictionaryKnownTokens,
                        numUniqueTokens: ts.uniqueTokens.size,
                        numIgnoredTokens,
                        numIgnoredOccurrences,
                        numKnownTokens,
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
