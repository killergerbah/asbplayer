import { Fetcher, RichSubtitleModel } from '@project/common';
import { Anki } from '@project/common/anki';
import {
    AsbplayerSettings,
    DictionaryTrack,
    dictionaryTrackEnabled,
    dictionaryTrackHoverOnly,
    getFullyKnownTokenStatus,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';
import { SubtitleCollection, SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import { arrayEquals, filterAsync, inBatches } from '@project/common/util';
import { TokenPart, Yomitan } from '@project/common/yomitan/yomitan';

const TOKEN_CACHE_BUILD_AHEAD = 50;
const TOKEN_CACHE_BATCH_SIZE = 1; // Processing more than 1 at a time is slower
const TOKEN_CACHE_ERROR_REFRESH_INTERVAL = 10000;
const ANKI_RECENTLY_MODIFIED_INTERVAL = 10000;
const MAX_CARD_INFOS = 10;
const HAS_LETTER_REGEX = /\p{L}/u;

interface TrackState {
    track: number;
    dt: DictionaryTrack;
    yt: Yomitan | undefined;
    tokenStatusCache: Map<string, TokenStatus | null>;
    ankiCardIdStatuses: Map<number, TokenStatus>;
    ankiSuspendedCardIds: Set<number>;
}

export class SubtitleColoring extends SubtitleCollection<RichSubtitleModel> {
    private _subtitles: RichSubtitleModel[];
    private settings?: AsbplayerSettings;
    private initialSettings: Promise<AsbplayerSettings>;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingSubtitles?: RichSubtitleModel[];
    private showingNeedsRefreshCount: number;

    private anki: Anki | undefined;
    private readonly fetcher?: Fetcher;
    private trackStates: TrackState[];
    private erroredCache: Set<number>;
    private uncollectedCache: Set<number>;
    private uncollectedNeedsRefresh: boolean;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiLastRecentlyModifiedCheck: number;
    private ankiRecentlyModifiedFirstCheck: boolean;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private colorCacheBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current color cache build, checked after each async call
    private tokenRequestFailed: boolean;

    private readonly subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void;
    private readonly getMediaTimeMs?: () => number;

    constructor(
        initialSettings: Promise<AsbplayerSettings>,
        options: SubtitleCollectionOptions,
        subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        super({ ...options, returnNextToShow: true });
        this._subtitles = [];
        this.initialSettings = initialSettings;
        this.fetcher = fetcher;
        this.trackStates = [];
        this.subtitleColorsUpdated = subtitleColorsUpdated;
        this.getMediaTimeMs = getMediaTimeMs;
        this.showingNeedsRefreshCount = 0;
        this.erroredCache = new Set();
        this.uncollectedCache = new Set();
        this.uncollectedNeedsRefresh = false;
        this.ankiRecentlyModifiedCardIds = new Set();
        this.ankiLastRecentlyModifiedCheck = Date.now();
        this.ankiRecentlyModifiedFirstCheck = true;
        this.colorCacheLastRefresh = Date.now();
        this.colorCacheBuilding = false;
        this.colorCacheBuildingCurrentIndexes = new Set();
        this.shouldCancelBuild = false;
        this.tokenRequestFailed = false;
    }

    get subtitles() {
        return this._subtitles;
    }

    setSubtitles(subtitles: RichSubtitleModel[]) {
        const needsReset =
            subtitles.length !== this._subtitles.length ||
            subtitles.some((s) => s.text !== this._subtitles[s.index].text);
        if (!needsReset) subtitles.forEach((s) => (s.richText = this._subtitles[s.index].richText)); // Preserve existing cache here so callers don't need to be aware of it
        this._subtitles = subtitles.map((s) => ({ ...s })); // Separate internals from react state changes
        super.setSubtitles(this._subtitles);
        if (needsReset) {
            this.resetCache();
            void this._initColorCache();
        }
    }

    resetCache(settings?: AsbplayerSettings) {
        if (this.colorCacheBuilding) this.shouldCancelBuild = true;
        if (settings) this.settings = settings;
        this.anki = undefined;
        this.trackStates = [];
        this.erroredCache.clear();
        this.uncollectedCache.clear();
        this.ankiRecentlyModifiedCardIds.clear();
        this.ankiRecentlyModifiedFirstCheck = true;
        this._subtitles.forEach((s) => (s.richText = undefined));
    }

    reset() {
        this.setSubtitles([]);
    }

    ankiCardWasUpdated() {
        this.uncollectedNeedsRefresh = true;
    }

    hoverOnly(track: number) {
        return dictionaryTrackHoverOnly(this.trackStates[track].dt);
    }

    private _tokenStatusValid(tokenStatus: TokenStatus | undefined | null) {
        if (tokenStatus === undefined || tokenStatus === null) return false;
        if (tokenStatus === TokenStatus.UNCOLLECTED) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private _colorCacheValid(cachedRichText: string | undefined, index: number) {
        if (cachedRichText === undefined) return false;
        if (this.erroredCache.has(index)) return false;
        if (this.uncollectedCache.has(index)) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private async _updateAnkiCache() {
        if (!this.anki) return;
        for (const ts of this.trackStates) {
            if (!dictionaryTrackEnabled(ts.dt)) continue;
            const fields = [...ts.dt.dictionaryAnkiWordFields, ...ts.dt.dictionaryAnkiSentenceFields]
                .map((field) => `"${field}:_*"`)
                .join(' OR ');
            ts.ankiSuspendedCardIds = new Set(await this.anki.findCards(`is:suspended (${fields})`));
            const prop = (await this.anki.findCards(`prop:s>=0 (${fields})`)).length ? 'prop:s' : 'prop:ivl'; // No cards are returned if FSRS is disabled
            const graduatedCutoff = Math.ceil(ts.dt.dictionaryAnkiMatureCutoff / 2);
            const matureCutoff = ts.dt.dictionaryAnkiMatureCutoff;

            // AnkiConnect doesn't expose Stability but we can retrieve it using search queries, stability is undefined for new cards
            ts.ankiCardIdStatuses = new Map<number, TokenStatus>();
            (await this.anki.findCards(`is:new (${fields})`)).forEach((c) =>
                ts.ankiCardIdStatuses.set(c, TokenStatus.UNKNOWN)
            );
            (await this.anki.findCards(`is:learn (${fields})`)).forEach((c) =>
                ts.ankiCardIdStatuses.set(c, TokenStatus.LEARNING)
            );
            (await this.anki.findCards(`-is:new -is:learn ${prop}<${graduatedCutoff} (${fields})`)).forEach((c) =>
                ts.ankiCardIdStatuses.set(c, TokenStatus.GRADUATED)
            );
            (await this.anki.findCards(`${prop}>=${graduatedCutoff} ${prop}<${matureCutoff} (${fields})`)).forEach(
                (c) => ts.ankiCardIdStatuses.set(c, TokenStatus.YOUNG)
            );
            (await this.anki.findCards(`${prop}>=${matureCutoff} (${fields})`)).forEach((c) =>
                ts.ankiCardIdStatuses.set(c, TokenStatus.MATURE)
            );
        }
    }

    private async _checkAnkiRecentlyModifiedCards() {
        if (!this.anki || !this.trackStates.length) return;

        const allFieldsSet: Set<string> = new Set();
        for (const ts of this.trackStates) {
            if (!dictionaryTrackEnabled(ts.dt)) continue;
            [...ts.dt.dictionaryAnkiWordFields, ...ts.dt.dictionaryAnkiSentenceFields].forEach((field) =>
                allFieldsSet.add(field)
            );
        }
        if (!allFieldsSet.size) return;
        const allFields = Array.from(allFieldsSet);

        try {
            const cardIds = await this.anki.findRecentlyEditedCards(allFields, 1); // Don't care about rated:1 or suspended status
            if (cardIds.every((cardId) => this.ankiRecentlyModifiedCardIds.has(cardId))) {
                if (this.ankiRecentlyModifiedCardIds.size !== cardIds.length) {
                    this.ankiRecentlyModifiedCardIds = new Set(cardIds);
                }
                return;
            }
            this.ankiRecentlyModifiedCardIds = new Set(cardIds);
            if (this.ankiRecentlyModifiedFirstCheck) {
                this.ankiRecentlyModifiedFirstCheck = false;
                return;
            }
            this.uncollectedNeedsRefresh = true;
            await this._updateAnkiCache();
        } catch (e) {
            console.error(`Error checking Anki recently modified cards:`, e);
        }
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (!this._subtitles.length) return;

            if (this.getMediaTimeMs) {
                const slice = this.subtitlesAt(this.getMediaTimeMs());
                const subtitlesAreNew =
                    this.showingSubtitles === undefined ||
                    !arrayEquals(slice.showing, this.showingSubtitles, (a, b) => a.index === b.index);
                if (subtitlesAreNew) {
                    this.showingSubtitles = slice.showing;
                    this.showingNeedsRefreshCount++;
                    if (
                        slice.showing.some(
                            (s) =>
                                !this._subtitles[s.index].richText &&
                                !this.colorCacheBuildingCurrentIndexes.has(s.index)
                        )
                    ) {
                        if (this.colorCacheBuilding) this.shouldCancelBuild = true;
                    }
                }
                if (this.showingNeedsRefreshCount) {
                    const { colorBufferStartIndex, colorBufferEndIndex } = this._getColorBufferIndexes(slice.showing);
                    void this._buildColorCache(this._subtitles.slice(colorBufferStartIndex, colorBufferEndIndex)).then(
                        (res) => {
                            if (res) this.showingNeedsRefreshCount = Math.max(0, this.showingNeedsRefreshCount - 1);
                        }
                    );
                    this.colorCacheLastRefresh = Date.now();
                    return;
                }
            }
            if (Date.now() - this.colorCacheLastRefresh >= TOKEN_CACHE_ERROR_REFRESH_INTERVAL) {
                void this._initColorCache();
                this.colorCacheLastRefresh = Date.now();
            }
            if (Date.now() - this.ankiLastRecentlyModifiedCheck >= ANKI_RECENTLY_MODIFIED_INTERVAL) {
                void this._checkAnkiRecentlyModifiedCards();
                this.ankiLastRecentlyModifiedCheck = Date.now();
            }
        }, 100);
    }

    private _getColorBufferIndexes(subtitles?: RichSubtitleModel[]) {
        if (!subtitles) {
            if (this.getMediaTimeMs) {
                const slice = this.subtitlesAt(this.getMediaTimeMs());
                subtitles = slice.showing;
                if (!subtitles.length) subtitles = slice.nextToShow ?? [];
            } else {
                return { colorBufferStartIndex: 0, colorBufferEndIndex: this._subtitles.length };
            }
        }
        if (!subtitles.length) return { colorBufferStartIndex: 0, colorBufferEndIndex: TOKEN_CACHE_BUILD_AHEAD };
        const colorBufferStartIndex = Math.min(...subtitles.map((s) => s.index));
        const colorBufferEndIndex = Math.max(...subtitles.map((s) => s.index)) + 1 + TOKEN_CACHE_BUILD_AHEAD;
        return { colorBufferStartIndex, colorBufferEndIndex };
    }

    private _initColorCache(): Promise<boolean> {
        const { colorBufferStartIndex, colorBufferEndIndex } = this._getColorBufferIndexes();
        return this._buildColorCache(this._subtitles.slice(colorBufferStartIndex, colorBufferEndIndex));
    }

    private async _buildColorCache(subtitles: RichSubtitleModel[]): Promise<boolean> {
        if (!subtitles.length) return true;
        if (!this.trackStates.length) {
            if (!this.settings) {
                const settings = await this.initialSettings;
                if (!this.settings) this.settings = settings;
            }
            this.trackStates = this.settings!.dictionaryTracks.map((dt, track) => ({
                track,
                dt,
                yt: undefined,
                tokenStatusCache: new Map(),
                ankiCardIdStatuses: new Map(),
                ankiSuspendedCardIds: new Set(),
            }));
        }
        if (this.trackStates.every((t) => !dictionaryTrackEnabled(t.dt))) return true;
        if (this.colorCacheBuilding) return false;

        let uncollectedWasRefreshed = false;
        let buildWasCancelled = false;
        try {
            this.colorCacheBuilding = true;
            this.tokenRequestFailed = false;
            for (const ts of this.trackStates) {
                if (!dictionaryTrackEnabled(ts.dt) || ts.yt) continue;
                try {
                    const yt = new Yomitan(ts.dt, this.fetcher);
                    await yt.version();
                    ts.yt = yt;
                } catch (e) {
                    console.warn(`YomitanTrack${ts.track + 1} version request failed:`, e);
                }
            }
            if (!this.anki && this.trackStates.some((t) => dictionaryTrackEnabled(t.dt))) {
                try {
                    this.anki = new Anki(this.settings!, this.fetcher);
                    const permission = (await this.anki.requestPermission()).permission;
                    if (permission !== 'granted') throw new Error(`permission ${permission}`);
                    await this._updateAnkiCache();
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    this.anki = undefined;
                }
            }

            if (this.uncollectedNeedsRefresh) {
                uncollectedWasRefreshed = true;
                this.anki?.resetCache(); // If a new card was added, it could be for any token
                const existingIndexes = new Set(subtitles.map((s) => s.index));
                const newSubtitles = subtitles.slice();
                for (const index of this.uncollectedCache) {
                    if (existingIndexes.has(index)) continue;
                    newSubtitles.push(this._subtitles[index]); // Process all uncollected subtitles even if not in buffer
                }
                subtitles = newSubtitles;
            }

            const eventsPerTrack = new Map<number, string[]>();
            for (const { text, track } of subtitles) {
                if (!eventsPerTrack.has(track)) eventsPerTrack.set(track, []);
                eventsPerTrack.get(track)!.push(text);
            }
            for (const [track, texts] of eventsPerTrack.entries()) {
                const ts = this.trackStates[track];
                if (!dictionaryTrackEnabled(ts.dt)) continue;
                if (!ts.yt?.supportsConcurrentTokenization) continue;
                await ts.yt.cacheTokenizations(texts);
            }
            eventsPerTrack.clear();

            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track }) => {
                            if (this.shouldCancelBuild) return;
                            try {
                                this.colorCacheBuildingCurrentIndexes.add(index);
                                const ts = this.trackStates[track];
                                if (!dictionaryTrackEnabled(ts.dt)) return;
                                const cachedRichText = this._subtitles[index].richText;
                                if (this._colorCacheValid(cachedRichText, index)) return;
                                const richText = await this._colorizeText({ text, index, ts });
                                if (cachedRichText === richText) return;
                                if (this.shouldCancelBuild) return;
                                const updatedSubtitles: RichSubtitleModel[] = [];
                                if (richText) {
                                    this._subtitles[index].richText = richText;
                                    updatedSubtitles.push(this._subtitles[index]);
                                }
                                this.subtitleColorsUpdated(updatedSubtitles);
                            } finally {
                                this.colorCacheBuildingCurrentIndexes.delete(index);
                            }
                        })
                    );
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (this.shouldCancelBuild) {
                buildWasCancelled = true;
                uncollectedWasRefreshed = false;
            }
        } finally {
            if (this.tokenRequestFailed) {
                this.tokenRequestFailed = false;
                this.trackStates.forEach((ts) => (ts.yt = undefined));
                this.anki = undefined;
            }
            if (uncollectedWasRefreshed) this.uncollectedNeedsRefresh = false;
            this.shouldCancelBuild = false;
            this.colorCacheBuilding = false;
        }
        return !buildWasCancelled;
    }

    private async _colorizeText(options: { text: string; index: number; ts: TrackState }): Promise<string | undefined> {
        const { text, index, ts } = options;
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            if (!ts.yt) throw new Error(`Yomitan not initialized for Track${ts.track + 1}`);
            if (!ts.dt.dictionaryAnkiWordFields.length && !ts.dt.dictionaryAnkiSentenceFields.length) {
                throw new Error('No Anki fields defined');
            }

            let richText: string = '';
            let textHasError = false;
            let textHasUncollected = false;
            const tokenizeRes = await ts.yt.tokenize(text);
            if (this.shouldCancelBuild) return;
            for (const rawTokenParts of tokenizeRes) {
                const trimmedToken = rawTokenParts
                    .map((p) => p.text)
                    .join('')
                    .trim();

                // Token is already cached or not a word
                const cachedTokenStatus = ts.tokenStatusCache.get(trimmedToken);
                if (this._tokenStatusValid(cachedTokenStatus)) {
                    richText += this._applyTokenStyle({ rawTokenParts, tokenStatus: cachedTokenStatus!, dt: ts.dt });
                    if (cachedTokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                    else if (cachedTokenStatus === null) textHasError = true;
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    const fullyKnownTokenStatus = getFullyKnownTokenStatus();
                    richText += this._applyTokenStyle({ rawTokenParts, tokenStatus: fullyKnownTokenStatus, dt: ts.dt });
                    ts.tokenStatusCache.set(trimmedToken, fullyKnownTokenStatus);
                    continue;
                }

                let tokenStatus: TokenStatus | null = null;
                switch (ts.dt.dictionaryTokenMatchStrategyPriority) {
                    case TokenMatchStrategyPriority.EXACT:
                        tokenStatus = await this._handlePriorityExact({ trimmedToken, ts });
                        break;
                    case TokenMatchStrategyPriority.LEMMA:
                        tokenStatus = await this._handlePriorityLemma({ trimmedToken, ts });
                        break;
                    case TokenMatchStrategyPriority.BEST_KNOWN:
                        tokenStatus = await this._handlePriorityKnown({
                            trimmedToken,
                            ts,
                            cmp: (a, b) => (a > b ? a : b),
                        });
                        break;
                    case TokenMatchStrategyPriority.LEAST_KNOWN:
                        tokenStatus = await this._handlePriorityKnown({
                            trimmedToken,
                            ts,
                            cmp: (a, b) => (a < b ? a : b),
                        });
                        break;
                    default:
                        throw new Error(`Unknown strategy priority: ${ts.dt.dictionaryTokenMatchStrategyPriority}`);
                }
                if (this.shouldCancelBuild) return;

                richText += this._applyTokenStyle({ rawTokenParts, tokenStatus, dt: ts.dt });
                if (tokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                else if (tokenStatus === null) textHasError = true;
                ts.tokenStatusCache.set(trimmedToken, tokenStatus);
            }

            textHasError ? this.erroredCache.add(index) : this.erroredCache.delete(index);
            textHasUncollected ? this.uncollectedCache.add(index) : this.uncollectedCache.delete(index);
            return richText;
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error colorizing subtitle text for Track${ts.track + 1}:`, error);
            this.erroredCache.add(index);
            return text
                .split('\n')
                .map((line) =>
                    this._applyTokenStyle({
                        rawTokenParts: [{ text: line, reading: '' }],
                        tokenStatus: null,
                        dt: ts.dt,
                    })
                )
                .join('\n');
        }
    }

    private async _handlePriorityExact(options: { trimmedToken: string; ts: TrackState }): Promise<TokenStatus | null> {
        const { trimmedToken, ts } = options;
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getWordFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: !ts.dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (tokenLemma) => this._getWordFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getSentenceFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: true,
                getFieldColor: (tokenLemma) => this._getSentenceFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityLemma(options: { trimmedToken: string; ts: TrackState }): Promise<TokenStatus | null> {
        const { trimmedToken, ts } = options;
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: !ts.dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (tokenLemma) => this._getWordFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getWordFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: true,
                getFieldColor: (tokenLemma) => this._getSentenceFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getSentenceFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityKnown(options: {
        trimmedToken: string;
        ts: TrackState;
        cmp: (a: TokenStatus, b: TokenStatus) => TokenStatus;
    }): Promise<TokenStatus | null> {
        const { trimmedToken, ts, cmp } = options;
        let tokenStatusExact: TokenStatus = TokenStatus.UNCOLLECTED;
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getWordFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusExact = tokenStatus;
        }
        let tokenStatusLemma: TokenStatus = TokenStatus.UNCOLLECTED;
        if (ts.dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: !ts.dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (tokenLemma) => this._getWordFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusLemma = tokenStatus;
        }
        if (tokenStatusExact !== TokenStatus.UNCOLLECTED || tokenStatusLemma !== TokenStatus.UNCOLLECTED) {
            return cmp(tokenStatusExact, tokenStatusLemma);
        }

        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
            const tokenStatus = await this._getSentenceFieldColor({ trimmedToken, ts });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusExact = tokenStatus;
        }
        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                trimmedToken,
                ts,
                cacheUncollected: true,
                getFieldColor: (tokenLemma) => this._getSentenceFieldColor({ trimmedToken: tokenLemma, ts }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusLemma = tokenStatus;
        }
        return cmp(tokenStatusExact, tokenStatusLemma);
    }

    private async _handleLemmatize(options: {
        trimmedToken: string;
        ts: TrackState;
        cacheUncollected: boolean;
        getFieldColor: (tokenLemma: string) => Promise<TokenStatus | null>;
    }): Promise<TokenStatus | null> {
        const { trimmedToken, ts, cacheUncollected, getFieldColor } = options;

        const tokenLemmas = await ts.yt!.lemmatize(trimmedToken);
        if (this.shouldCancelBuild) return null;
        for (const tokenLemma of tokenLemmas) {
            const cachedTokenLemma = ts.tokenStatusCache.get(tokenLemma);
            if (this._tokenStatusValid(cachedTokenLemma)) return cachedTokenLemma!;
            const tokenStatus = await getFieldColor(tokenLemma);
            if (tokenStatus !== TokenStatus.UNCOLLECTED) {
                ts.tokenStatusCache.set(tokenLemma, tokenStatus);
                return tokenStatus;
            }
            if (cacheUncollected && tokenLemma !== trimmedToken) {
                ts.tokenStatusCache.set(tokenLemma, TokenStatus.UNCOLLECTED);
            }
            if (this.shouldCancelBuild) return null;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _getWordFieldColor(options: { trimmedToken: string; ts: TrackState }): Promise<TokenStatus | null> {
        const { trimmedToken, ts } = options;
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            let cardIds = await this.anki.findCardsWithWord(ts.track, trimmedToken, ts.dt.dictionaryAnkiWordFields);
            if (!cardIds.length) return TokenStatus.UNCOLLECTED;
            if (this.shouldCancelBuild) return null;
            return this._getTokenStatusFromCutoff({ cardIds, ts });
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(
                `Error getting color for Track${ts.track + 1} using word fields for token "${trimmedToken}":`,
                error
            );
            return null;
        }
    }

    private async _getSentenceFieldColor(options: {
        trimmedToken: string;
        ts: TrackState;
    }): Promise<TokenStatus | null> {
        const { trimmedToken, ts } = options;
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            let cardIds = await this.anki.findCardsContainingWord(
                ts.track,
                trimmedToken,
                ts.dt.dictionaryAnkiSentenceFields
            );
            if (this.shouldCancelBuild) return null;
            const suspendedRes = this._handleSuspendedCards({ cardIds, ts });
            if (!(suspendedRes instanceof Array)) return suspendedRes;
            cardIds = this._limitCardIds({ cardIds: suspendedRes, ts });
            if (!cardIds.length) return TokenStatus.UNCOLLECTED;
            const rawCardInfos = await this.anki.cardsInfo(cardIds);
            if (!rawCardInfos.length) return null;
            if (this.shouldCancelBuild) return null;

            if (ts.yt?.supportsConcurrentTokenization) {
                const sentenceFieldValues: string[] = [];
                for (const sentenceField of ts.dt.dictionaryAnkiSentenceFields) {
                    for (const cardInfo of rawCardInfos) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        sentenceFieldValues.push(field.value);
                    }
                }
                await ts.yt.cacheTokenizations(sentenceFieldValues);
            }

            // Tokenize the sentence field and filter cards that actually contain the token
            const validCardInfos = await filterAsync(
                rawCardInfos,
                async (cardInfo: any) => {
                    for (const sentenceField of ts.dt.dictionaryAnkiSentenceFields) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        const fieldTokens = (await ts.yt!.tokenize(field.value)).map((t) =>
                            t
                                .map((p) => p.text)
                                .join('')
                                .trim()
                        );
                        if (this.shouldCancelBuild) return false;
                        if (fieldTokens.includes(trimmedToken)) return true;
                        if (ts.dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.ANY_FORM_COLLECTED) {
                            continue;
                        }
                        for (const fieldToken of fieldTokens) {
                            const fieldTokenLemmas = await ts.yt!.lemmatize(fieldToken);
                            if (this.shouldCancelBuild) return false;
                            if (fieldTokenLemmas.includes(trimmedToken)) return true;
                        }
                    }
                    return false;
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (this.shouldCancelBuild) return null;
            if (!validCardInfos.length) return TokenStatus.UNCOLLECTED;
            return this._getTokenStatusFromCutoff({ cardIds: validCardInfos.map((cardInfo) => cardInfo.cardId), ts });
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(
                `Error getting color for Track${ts.track + 1} using sentence fields for token "${trimmedToken}":`,
                error
            );
            return null;
        }
    }

    private _limitCardIds(options: { cardIds: number[]; ts: TrackState }): number[] {
        const { cardIds, ts } = options;
        if (cardIds.length <= MAX_CARD_INFOS) return cardIds;

        const length = getFullyKnownTokenStatus() + 1;
        const buckets: number[][] = Array.from({ length }, () => []);
        for (const cardId of cardIds) {
            buckets[ts.ankiCardIdStatuses.get(cardId) ?? TokenStatus.UNCOLLECTED].push(cardId);
        }

        const limitedCardIds: number[] = [];
        for (let status = length - 1; status >= 0; status--) {
            for (const cardId of buckets[status]) {
                limitedCardIds.push(cardId);
                if (limitedCardIds.length >= MAX_CARD_INFOS) return limitedCardIds;
            }
        }
        return limitedCardIds;
    }

    private _handleSuspendedCards(options: { cardIds: number[]; ts: TrackState }): number[] | TokenStatus {
        const { cardIds, ts } = options;
        if (!cardIds.length || ts.dt.dictionaryAnkiTreatSuspended === 'NORMAL') return cardIds;
        const unsuspended = cardIds.filter((cardId) => !ts.ankiSuspendedCardIds.has(cardId));
        if (!unsuspended.length) return ts.dt.dictionaryAnkiTreatSuspended;
        return unsuspended;
    }

    private async _getTokenStatusFromCutoff(options: {
        cardIds: number[];
        ts: TrackState;
    }): Promise<TokenStatus | null> {
        const { ts } = options;
        let cardIds = options.cardIds;
        const suspendedRes = this._handleSuspendedCards({ cardIds, ts });
        if (!(suspendedRes instanceof Array)) return suspendedRes;
        cardIds = suspendedRes;

        if (cardIds.some((c) => ts.ankiCardIdStatuses.get(c) === TokenStatus.MATURE)) return TokenStatus.MATURE;
        if (cardIds.some((c) => ts.ankiCardIdStatuses.get(c) === TokenStatus.YOUNG)) return TokenStatus.YOUNG;
        if (cardIds.some((c) => ts.ankiCardIdStatuses.get(c) === TokenStatus.GRADUATED)) return TokenStatus.GRADUATED;
        if (cardIds.some((c) => ts.ankiCardIdStatuses.get(c) === TokenStatus.LEARNING)) return TokenStatus.LEARNING;
        return TokenStatus.UNKNOWN;
    }

    private _applyTokenStyle(options: {
        rawTokenParts: TokenPart[];
        tokenStatus: TokenStatus | null;
        dt: DictionaryTrack;
    }): string {
        const { rawTokenParts, tokenStatus, dt } = options;
        const token = this._applyReadingAnnotation({ rawTokenParts, tokenStatus, dt });
        if (tokenStatus === null) return `<span style="text-decoration: line-through red 3px;">${token}</span>`;
        if (!dt.colorizeFullyKnownTokens && tokenStatus === getFullyKnownTokenStatus()) return token;
        const c = dt.tokenStatusColors[tokenStatus];
        const t = dt.tokenStylingThickness;
        switch (dt.tokenStyling) {
            case TokenStyling.TEXT:
                return `<span style="-webkit-text-fill-color: ${c};">${token}</span>`;
            case TokenStyling.BACKGROUND:
                return `<span style="background-color: ${c};">${token}</span>`;
            case TokenStyling.UNDERLINE:
            case TokenStyling.OVERLINE:
                return `<span style="text-decoration: ${dt.tokenStyling} ${c} ${t}px;">${token}</span>`;
            case TokenStyling.OUTLINE:
                return `<span style="-webkit-text-stroke: ${t}px ${c};">${token}</span>`;
            default:
                return `<span style="text-decoration: line-through red 3px double;">${token}</span>`;
        }
    }

    private _applyReadingAnnotation(options: {
        rawTokenParts: TokenPart[];
        tokenStatus: TokenStatus | null;
        dt: DictionaryTrack;
    }): string {
        const { rawTokenParts, tokenStatus, dt } = options;
        if (rawTokenParts.every((p) => !HAS_LETTER_REGEX.test(p.text))) {
            return rawTokenParts.map((p) => p.text).join(''); // Prevent 。 -> まる
        }
        const ano = dt.dictionaryTokenReadingAnnotation;
        if (ano === TokenReadingAnnotation.NEVER) return rawTokenParts.map((p) => p.text).join('');
        if (tokenStatus !== null) {
            if (
                (ano === TokenReadingAnnotation.LEARNING_OR_BELOW && tokenStatus > TokenStatus.LEARNING) ||
                (ano === TokenReadingAnnotation.UNKNOWN_OR_BELOW && tokenStatus > TokenStatus.UNKNOWN)
            ) {
                return rawTokenParts.map((p) => p.text).join('');
            }
        }
        return rawTokenParts
            .map((p) => (p.reading.length ? `<ruby>${p.text}<rt>${p.reading}</rt></ruby>` : p.text))
            .join('');
    }

    unbind() {
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }
        this.resetCache();
    }
}
