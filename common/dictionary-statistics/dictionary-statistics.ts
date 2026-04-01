import { Progress, Tokenization } from '@project/common';
import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    dictionaryTrackEnabled,
    NUM_TOKEN_STATUSES,
    SettingsProvider,
    TokenStatusConfig,
    TokenStatus,
} from '@project/common/settings';

export interface DictionaryStatisticsSentence {
    text: string;
    start: number;
    end: number;
    track: number;
    index: number;
    richText?: string;
    tokenization?: Tokenization;
}

export interface DictionaryStatisticsDictionarySnapshot {
    numKnownTokens: number;
    numIgnoredTokens: number;
}
export type DictionaryStatisticsSentences = Record<number, DictionaryStatisticsSentence>;

export interface DictionaryStatisticsStats {
    dictionary: DictionaryStatisticsDictionarySnapshot;
    sentences: DictionaryStatisticsSentences;
}

export interface DictionaryStatisticsRawTrackSnapshot {
    track: number;
    progress: Progress;
    statusColors: Record<TokenStatus, string>;
    stats: DictionaryStatisticsStats;
}

export interface DictionaryStatisticsSnapshot {
    mediaId: string;
    snapshots: DictionaryStatisticsRawTrackSnapshot[];
}

function statusColorsFromConfig(tokenStatusConfig: readonly TokenStatusConfig[]): Record<TokenStatus, string> {
    const statusColors = {} as Record<TokenStatus, string>;
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        let config = tokenStatusConfig[status];
        if (!config) config = { color: '#9E9E9E', alpha: 'FF', display: true };
        statusColors[status] = `${config.color}${config.alpha}`;
    }
    return statusColors;
}

export class DictionaryStatistics {
    private readonly settingsProvider: SettingsProvider;
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly mediaId: string;
    private readonly rawTrackSnapshots: Map<number, DictionaryStatisticsRawTrackSnapshot>;
    private lastCancelledAt: number;

    constructor(settingsProvider: SettingsProvider, dictionaryProvider: DictionaryProvider, mediaId: string) {
        this.settingsProvider = settingsProvider;
        this.dictionaryProvider = dictionaryProvider;
        this.mediaId = mediaId;
        this.rawTrackSnapshots = new Map();
        this.lastCancelledAt = 0;
    }

    hasStatistics(): boolean {
        return this.rawTrackSnapshots.size > 0;
    }

    reset(): void {
        const startTime = Date.now();
        this.rawTrackSnapshots.clear();
        void this._publish(undefined, startTime);
        this.lastCancelledAt = Date.now();
    }

    publishSnapshot(): void {
        const startTime = Date.now();
        void this._publish(this.rawTrackSnapshots.size > 0 ? this._snapshot() : undefined, startTime);
    }

    init(track: number, total: number): void {
        this.rawTrackSnapshots.set(track, {
            track,
            progress: { current: 0, total, startedAt: Date.now() },
            statusColors: statusColorsFromConfig([]),
            stats: {
                dictionary: {
                    numKnownTokens: 0,
                    numIgnoredTokens: 0,
                },
                sentences: {},
            },
        });
    }

    updateProgress(track: number, current: number): boolean {
        const startTime = Date.now();
        const ts = this.rawTrackSnapshots.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
        ts.progress.current = current;
        void this._publish(this._snapshot(), startTime);
        return ts.progress.current >= ts.progress.total;
    }

    async refreshDictionaryKnownTokens(profile: string | undefined): Promise<void> {
        const startTime = Date.now();
        const settings = await this.settingsProvider.getAll();
        await Promise.all(
            settings.dictionaryTracks.map(async (dt, track) => {
                if (!dictionaryTrackEnabled(dt)) return;
                const ts = this.rawTrackSnapshots.get(track);
                if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
                const { knownTokens, ignoredTokens } = await this.dictionaryProvider.countTokens(
                    profile,
                    track,
                    settings
                );
                ts.stats.dictionary.numKnownTokens = knownTokens;
                ts.stats.dictionary.numIgnoredTokens = ignoredTokens;
                ts.statusColors = statusColorsFromConfig(dt.dictionaryTokenStatusConfig);
                await this._publish(this._snapshot(), startTime);
            })
        );
    }

    ingest(sentence: DictionaryStatisticsSentence): void {
        const ts = this.rawTrackSnapshots.get(sentence.track);
        if (!ts) throw new Error(`Track ${sentence.track} not initialized for dictionary statistics`);
        ts.stats.sentences[sentence.index] = sentence;
    }

    private _snapshot(): DictionaryStatisticsSnapshot {
        return {
            mediaId: this.mediaId,
            snapshots: Array.from(this.rawTrackSnapshots.entries())
                .sort(([left], [right]) => left - right)
                .map(([track, ts]) => ({
                    track,
                    progress: ts.progress,
                    statusColors: ts.statusColors,
                    stats: {
                        dictionary: {
                            numKnownTokens: ts.stats.dictionary.numKnownTokens,
                            numIgnoredTokens: ts.stats.dictionary.numIgnoredTokens,
                        },
                        sentences: ts.stats.sentences,
                    },
                })),
        };
    }

    private async _publish(snapshot: DictionaryStatisticsSnapshot | undefined, startTime: number): Promise<void> {
        if (startTime <= this.lastCancelledAt) return;
        return this.dictionaryProvider.publishStatisticsSnapshot(this.mediaId, snapshot);
    }
}
