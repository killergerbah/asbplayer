import { Fetcher, RichSubtitleModel } from '@project/common';
import { Anki } from '@project/common/anki';
import {
    AsbplayerSettings,
    DictionaryTrack,
    getFullyKnownTokenStatus,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { arrayEquals, filterAsync, inBatches } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';

const TOKEN_CACHE_BUILD_AHEAD = 10;
const TOKEN_CACHE_BATCH_SIZE = 1; // Processing more than 1 at a time is slower
const TOKEN_CACHE_ERROR_REFRESH_INTERVAL = 10000;
const ANKI_RECENTLY_MODIFIED_INTERVAL = 10000;
const HAS_LETTER_REGEX = /\p{L}/u;

export class SubtitleColoring {
    private _subtitles: RichSubtitleModel[];
    private settings: AsbplayerSettings;
    private subtitleCollection: SubtitleCollection<RichSubtitleModel>;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingSubtitles?: RichSubtitleModel[];
    private showingNeedsRefreshCount: number;

    private yomitanTracks: (Yomitan | undefined)[];
    private anki: Anki | undefined;
    private readonly fetcher?: Fetcher;
    private dictionaryTracks: (DictionaryTrack | undefined)[] | undefined;
    private tokenizeCache: Map<number, Map<string, string[]>>;
    private tokenStatusCache: Map<number, Map<string, TokenStatus | null>>;
    private lemmatizeCache: Map<number, Map<string, string[]>>;
    private erroredCache: Set<number>;
    private uncollectedCache: Set<number>;
    private uncollectedNeedsRefresh: boolean;
    private ankiCardIdStatuses: Map<number, Map<number, TokenStatus>>;
    private ankiSuspendedCardIds: Map<number, Set<number>>;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiLastRecentlyModifiedCheck: number;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private colorCacheBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current color cache build, checked after each async call
    private tokenRequestFailed: boolean;

    private readonly subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void;
    private readonly getMediaTimeMs?: () => number;

    constructor(
        settings: AsbplayerSettings,
        subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        this._subtitles = [];
        this.settings = settings;
        this.yomitanTracks = [];
        this.fetcher = fetcher;
        this.subtitleColorsUpdated = subtitleColorsUpdated;
        this.getMediaTimeMs = getMediaTimeMs;
        this.subtitleCollection = new SubtitleCollection(this._subtitles);
        this.showingNeedsRefreshCount = 0;
        this.tokenizeCache = new Map();
        this.tokenStatusCache = new Map();
        this.lemmatizeCache = new Map();
        this.erroredCache = new Set();
        this.uncollectedCache = new Set();
        this.uncollectedNeedsRefresh = false;
        this.ankiCardIdStatuses = new Map();
        this.ankiSuspendedCardIds = new Map();
        this.ankiRecentlyModifiedCardIds = new Set();
        this.ankiLastRecentlyModifiedCheck = Date.now();
        this.colorCacheLastRefresh = Date.now();
        this.colorCacheBuilding = false;
        this.colorCacheBuildingCurrentIndexes = new Set();
        this.shouldCancelBuild = false;
        this.tokenRequestFailed = false;
    }

    get subtitles() {
        return this._subtitles;
    }

    set subtitles(subtitles) {
        this._subtitles = subtitles.map((subtitle) => ({ ...subtitle })); // Deep copy to ensure no external mutations
        this.subtitleCollection = new SubtitleCollection(this._subtitles, {
            showingCheckRadiusMs: 150,
            returnNextToShow: true,
        });
        this.resetCache(this.settings);
        this._initColorCache();
    }

    resetCache(settings: AsbplayerSettings) {
        if (this.colorCacheBuilding) this.shouldCancelBuild = true;
        this.settings = settings;
        this.yomitanTracks = [];
        this.anki = undefined;
        this.dictionaryTracks = undefined;
        this.tokenizeCache.clear();
        this.tokenStatusCache.clear();
        this.lemmatizeCache.clear();
        this.erroredCache.clear();
        this.uncollectedCache.clear();
        this.ankiCardIdStatuses.clear();
        this.ankiSuspendedCardIds.clear();
        this.ankiRecentlyModifiedCardIds.clear();
        for (const subtitle of this._subtitles) {
            subtitle.richText = undefined;
        }
    }

    reset() {
        this.subtitles = [];
    }

    ankiCardWasUpdated() {
        this.uncollectedNeedsRefresh = true;
    }

    private _dictionaryTrackEnabled(dt: DictionaryTrack | undefined) {
        return dt && dt.dictionaryColorizeSubtitles;
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
        const anki = this.anki;
        for (const [track, dt] of this.dictionaryTracks?.entries() ?? []) {
            if (!this._dictionaryTrackEnabled(dt) || !dt!.dictionaryAnkiEnabled) continue;
            const fields = [...dt!.dictionaryAnkiWordFields, ...dt!.dictionaryAnkiSentenceFields]
                .map((field) => `"${field}:_*"`)
                .join(' OR ');
            this.ankiSuspendedCardIds.set(track, new Set(await anki.findCards(`is:suspended (${fields})`)));
            const prop = (await anki.findCards(`prop:s>=0 (${fields})`)).length ? 'prop:s' : 'prop:ivl'; // No cards are returned if FSRS is disabled
            const graduatedCutoff = Math.ceil(dt!.dictionaryAnkiMatureCutoff / 2);
            const matureCutoff = dt!.dictionaryAnkiMatureCutoff;

            // AnkiConnect doesn't expose Stability but we can retrieve it using search queries
            this.ankiCardIdStatuses.set(track, new Map<number, TokenStatus>());
            const statuses = this.ankiCardIdStatuses.get(track)!;
            (await anki.findCards(`prop:ivl=0 (${fields})`)).forEach((c) => statuses.set(c, TokenStatus.UNKNOWN)); // Stability is undefined for new cards
            (await anki.findCards(`${prop}>0 ${prop}<1 (${fields})`)).forEach((c) =>
                statuses.set(c, TokenStatus.LEARNING)
            );
            (await anki.findCards(`${prop}>=1 ${prop}<${graduatedCutoff} (${fields})`)).forEach((c) =>
                statuses.set(c, TokenStatus.GRADUATED)
            );
            (await anki.findCards(`${prop}>=${graduatedCutoff} ${prop}<${matureCutoff} (${fields})`)).forEach((c) =>
                statuses.set(c, TokenStatus.YOUNG)
            );
            (await anki.findCards(`${prop}>=${matureCutoff} (${fields})`)).forEach((c) =>
                statuses.set(c, TokenStatus.MATURE)
            );
        }
    }

    private async _checkAnkiRecentlyModifiedCards() {
        if (!this.anki || !this.dictionaryTracks) return;
        const anki = this.anki;

        const allFieldsSet: Set<string> = new Set();
        for (const dt of this.dictionaryTracks) {
            if (!this._dictionaryTrackEnabled(dt)) continue;
            if (!dt!.dictionaryAnkiEnabled) continue;
            for (const field of [...dt!.dictionaryAnkiWordFields, ...dt!.dictionaryAnkiSentenceFields]) {
                allFieldsSet.add(field);
            }
        }
        if (!allFieldsSet.size) return;
        const allFields = Array.from(allFieldsSet);

        try {
            const cardIds = new Set<number>(await anki.findRecentlyEditedCards(allFields, 1)); // Don't care about rated:1 or suspended status
            if (
                cardIds.size === this.ankiRecentlyModifiedCardIds.size &&
                [...cardIds].every((cardId) => this.ankiRecentlyModifiedCardIds.has(cardId))
            ) {
                return;
            }
            this.uncollectedNeedsRefresh = true;
            this.ankiRecentlyModifiedCardIds = cardIds;
            await this._updateAnkiCache();
            return;
        } catch (e) {
            console.error(`Error checking Anki@${anki.ankiConnectUrl} recently modified cards:`, e);
        }
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (!this._subtitles.length) return;

            if (this.getMediaTimeMs) {
                const slice = this.subtitleCollection.subtitlesAt(this.getMediaTimeMs());
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
                    this._buildColorCache(this._subtitles.slice(colorBufferStartIndex, colorBufferEndIndex)).then(
                        (res) => {
                            if (res) this.showingNeedsRefreshCount = Math.max(0, this.showingNeedsRefreshCount - 1);
                        }
                    );
                    this.colorCacheLastRefresh = Date.now();
                    return;
                }
            }
            if (Date.now() - this.colorCacheLastRefresh >= TOKEN_CACHE_ERROR_REFRESH_INTERVAL) {
                this._initColorCache();
                this.colorCacheLastRefresh = Date.now();
            }
            if (Date.now() - this.ankiLastRecentlyModifiedCheck >= ANKI_RECENTLY_MODIFIED_INTERVAL) {
                this._checkAnkiRecentlyModifiedCards();
                this.ankiLastRecentlyModifiedCheck = Date.now();
            }
        }, 100);
    }

    private _getColorBufferIndexes(subtitles?: RichSubtitleModel[]) {
        if (!subtitles) {
            if (this.getMediaTimeMs) {
                const slice = this.subtitleCollection.subtitlesAt(this.getMediaTimeMs());
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
        if (!this.dictionaryTracks) this.dictionaryTracks = this.settings.dictionaryTracks;
        if (!this.dictionaryTracks || this.dictionaryTracks.every((dt) => !this._dictionaryTrackEnabled(dt))) {
            return true;
        }
        if (this.colorCacheBuilding) return false;

        let uncollectedWasRefreshed = false;
        let buildWasCancelled = false;
        try {
            this.colorCacheBuilding = true;
            this.tokenRequestFailed = false;
            for (const [track, dt] of this.dictionaryTracks?.entries() ?? []) {
                if (!this._dictionaryTrackEnabled(dt)) {
                    this.yomitanTracks[track] = undefined;
                    continue; // Assigned undefined to maintain array indexes
                }
                if (!this.tokenizeCache.has(track)) this.tokenizeCache.set(track, new Map());
                if (!this.tokenStatusCache.has(track)) this.tokenStatusCache.set(track, new Map());
                if (!this.lemmatizeCache.has(track)) this.lemmatizeCache.set(track, new Map());
                if (!this.yomitanTracks[track]) {
                    try {
                        const yomitan = new Yomitan(dt!, this.fetcher);
                        await yomitan.version();
                        this.yomitanTracks[track] = yomitan;
                    } catch (e) {
                        console.warn(`YomitanTrack${track + 1} version request failed:`, e);
                        this.yomitanTracks[track] = undefined;
                    }
                }
            }
            if (
                !this.anki &&
                this.dictionaryTracks.some((dt) => this._dictionaryTrackEnabled(dt) && dt!.dictionaryAnkiEnabled)
            ) {
                try {
                    this.anki = new Anki(this.settings, this.fetcher);
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
                const existingIndexes = new Set(subtitles.map((s) => s.index));
                const newSubtitles = subtitles.slice();
                for (const index of this.uncollectedCache) {
                    if (existingIndexes.has(index)) continue;
                    newSubtitles.push(this._subtitles[index]); // Process all uncollected subtitles even if not in buffer
                }
                subtitles = newSubtitles;
            }

            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track }) => {
                            if (this.shouldCancelBuild) return;
                            try {
                                this.colorCacheBuildingCurrentIndexes.add(index);
                                const dt = this.dictionaryTracks?.[track];
                                if (!this._dictionaryTrackEnabled(dt)) return;
                                const cachedRichText = this._subtitles[index].richText;
                                if (this._colorCacheValid(cachedRichText, index)) return;
                                const richText = await this._colorizeText({
                                    text,
                                    track,
                                    index,
                                    dt: dt!,
                                });
                                if (this.shouldCancelBuild) return;
                                if (cachedRichText === richText) return;
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
                this.yomitanTracks = [];
                this.anki = undefined;
                this.tokenRequestFailed = false;
            }
            this.colorCacheBuilding = false;
            this.shouldCancelBuild = false;
            if (uncollectedWasRefreshed) this.uncollectedNeedsRefresh = false;
        }
        return !buildWasCancelled;
    }

    private async _colorizeText(options: {
        text: string;
        track: number;
        index: number;
        dt: DictionaryTrack;
    }): Promise<string | undefined> {
        const { text, track, index, dt } = options;
        try {
            const yomitan = this.yomitanTracks[track];
            if (!yomitan) throw new Error('Yomitan not initialized');
            const anki = this.anki;
            if (!anki) throw new Error('Anki not initialized');
            if (!dt.dictionaryAnkiWordFields.length && !dt.dictionaryAnkiSentenceFields.length) {
                throw new Error('No Anki fields defined');
            }
            const tokenizeCache = this.tokenizeCache.get(track);
            if (!tokenizeCache) throw new Error('Tokenize cache not initialized');
            const tokenStatusCache = this.tokenStatusCache.get(track);
            if (!tokenStatusCache) throw new Error('Token status cache not initialized');
            const lemmatizeCache = this.lemmatizeCache.get(track);
            if (!lemmatizeCache) throw new Error('Lemmatize cache not initialized');
            const ankiCardIdStatuses = this.ankiCardIdStatuses.get(track);
            if (!ankiCardIdStatuses) throw new Error('Mature cache not initialized');
            const suspendedCache = this.ankiSuspendedCardIds.get(track);
            if (!suspendedCache) throw new Error('Suspended cache not initialized');

            let richText: string = '';
            let textHasError = false;
            let textHasUncollected = false;
            let rawTokens = tokenizeCache.get(text);
            if (!rawTokens) {
                rawTokens = await yomitan.tokenize(text);
                tokenizeCache.set(text, rawTokens);
                if (this.shouldCancelBuild) return;
            }
            for (const rawToken of rawTokens) {
                const trimmedToken = rawToken.trim();

                // Token is already cached or not a word
                const cachedTokenStatus = tokenStatusCache.get(trimmedToken);
                if (this._tokenStatusValid(cachedTokenStatus)) {
                    const richRes = this._applyTokenStyle({
                        rawToken,
                        tokenStatus: cachedTokenStatus!,
                        dt,
                    });
                    if (richRes) richText += richRes;
                    if (cachedTokenStatus === null) textHasError = true;
                    else if (cachedTokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    const fullyKnownTokenStatus = getFullyKnownTokenStatus();
                    const richRes = this._applyTokenStyle({
                        rawToken,
                        tokenStatus: fullyKnownTokenStatus,
                        dt,
                    });
                    if (richRes) richText += richRes;
                    tokenStatusCache.set(trimmedToken, fullyKnownTokenStatus);
                    continue;
                }

                let shouldCheckExactFormWordField = true;
                if (dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
                    let tokenLemmas = lemmatizeCache.get(trimmedToken);
                    if (!tokenLemmas) {
                        tokenLemmas = await yomitan.lemmatize(trimmedToken);
                        lemmatizeCache.set(trimmedToken, tokenLemmas);
                        if (this.shouldCancelBuild) return;
                    }
                    if (tokenLemmas.length) shouldCheckExactFormWordField = false;
                }
                let shouldCheckExactFormSentenceField = true;
                if (dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
                    let tokenLemmas = lemmatizeCache.get(trimmedToken);
                    if (!tokenLemmas) {
                        tokenLemmas = await yomitan.lemmatize(trimmedToken);
                        lemmatizeCache.set(trimmedToken, tokenLemmas);
                        if (this.shouldCancelBuild) return;
                    }
                    if (tokenLemmas.length) shouldCheckExactFormSentenceField = false;
                }

                let tokenStatus: TokenStatus | null = null;
                switch (dt.dictionaryTokenMatchStrategyPriority) {
                    case TokenMatchStrategyPriority.EXACT:
                        tokenStatus = await this._handlePriorityExact({
                            trimmedToken,
                            track,
                            anki,
                            dt,
                            yomitan,
                            tokenizeCache,
                            tokenStatusCache,
                            lemmatizeCache,
                            ankiCardIdStatuses,
                            suspendedCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                        });
                        break;
                    case TokenMatchStrategyPriority.LEMMA:
                        tokenStatus = await this._handlePriorityLemma({
                            trimmedToken,
                            track,
                            anki,
                            dt,
                            yomitan,
                            tokenizeCache,
                            tokenStatusCache,
                            lemmatizeCache,
                            ankiCardIdStatuses,
                            suspendedCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                        });
                        break;
                    case TokenMatchStrategyPriority.BEST_KNOWN:
                        tokenStatus = await this._handlePriorityKnown({
                            trimmedToken,
                            track,
                            anki,
                            dt,
                            yomitan,
                            tokenizeCache,
                            tokenStatusCache,
                            lemmatizeCache,
                            ankiCardIdStatuses,
                            suspendedCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                            cmp: (a, b) => (a > b ? a : b),
                        });
                        break;
                    case TokenMatchStrategyPriority.LEAST_KNOWN:
                        tokenStatus = await this._handlePriorityKnown({
                            trimmedToken,
                            track,
                            anki,
                            dt,
                            yomitan,
                            tokenizeCache,
                            tokenStatusCache,
                            lemmatizeCache,
                            ankiCardIdStatuses,
                            suspendedCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                            cmp: (a, b) => (a < b ? a : b),
                        });
                        break;
                    default:
                        throw new Error(`Unknown strategy priority: ${dt.dictionaryTokenMatchStrategyPriority}`);
                }
                if (this.shouldCancelBuild) return;

                const richRes = this._applyTokenStyle({ rawToken, tokenStatus, dt });
                if (richRes) richText += richRes;
                if (tokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                else if (tokenStatus === null) textHasError = true;
                tokenStatusCache.set(trimmedToken, tokenStatus);
            }

            textHasError ? this.erroredCache.add(index) : this.erroredCache.delete(index);
            textHasUncollected ? this.uncollectedCache.add(index) : this.uncollectedCache.delete(index);
            return richText;
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error colorizing subtitle text for Track${track}:`, error);
            this.erroredCache.add(index);
            return this._applyTokenStyle({ rawToken: text, tokenStatus: null, dt });
        }
    }

    private async _handlePriorityExact(options: {
        trimmedToken: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenizeCache: Map<string, string[]>;
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
        shouldCheckExactFormWordField: boolean;
        shouldCheckExactFormSentenceField: boolean;
    }): Promise<TokenStatus | null> {
        const {
            trimmedToken,
            track,
            anki,
            dt,
            yomitan,
            tokenizeCache,
            tokenStatusCache,
            lemmatizeCache,
            ankiCardIdStatuses,
            suspendedCache,
            shouldCheckExactFormWordField,
            shouldCheckExactFormSentenceField,
        } = options;
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: !dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (token) =>
                    this._getWordFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (shouldCheckExactFormSentenceField) {
            const tokenStatus = await this._getSentenceFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                yomitan,
                tokenizeCache,
                lemmatizeCache,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: true,
                getFieldColor: (token) =>
                    this._getSentenceFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        yomitan,
                        tokenizeCache,
                        lemmatizeCache,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityLemma(options: {
        trimmedToken: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenizeCache: Map<string, string[]>;
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
        shouldCheckExactFormWordField: boolean;
        shouldCheckExactFormSentenceField: boolean;
    }): Promise<TokenStatus | null> {
        const {
            trimmedToken,
            track,
            anki,
            dt,
            yomitan,
            tokenizeCache,
            tokenStatusCache,
            lemmatizeCache,
            ankiCardIdStatuses,
            suspendedCache,
            shouldCheckExactFormWordField,
            shouldCheckExactFormSentenceField,
        } = options;
        if (dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: !dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (token) =>
                    this._getWordFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: true,
                getFieldColor: (token) =>
                    this._getSentenceFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        yomitan,
                        tokenizeCache,
                        lemmatizeCache,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (shouldCheckExactFormSentenceField) {
            const tokenStatus = await this._getSentenceFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                yomitan,
                tokenizeCache,
                lemmatizeCache,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityKnown(options: {
        trimmedToken: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenizeCache: Map<string, string[]>;
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
        shouldCheckExactFormWordField: boolean;
        shouldCheckExactFormSentenceField: boolean;
        cmp: (a: TokenStatus, b: TokenStatus) => TokenStatus;
    }): Promise<TokenStatus | null> {
        const {
            trimmedToken,
            track,
            anki,
            dt,
            yomitan,
            tokenizeCache,
            tokenStatusCache,
            lemmatizeCache,
            ankiCardIdStatuses,
            suspendedCache,
            shouldCheckExactFormWordField,
            shouldCheckExactFormSentenceField,
            cmp,
        } = options;
        let tokenStatusExact: TokenStatus = TokenStatus.UNCOLLECTED;
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusExact = tokenStatus;
        }
        let tokenStatusLemma: TokenStatus = TokenStatus.UNCOLLECTED;
        if (dt.dictionaryTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: !dt.dictionaryAnkiSentenceFields.length,
                getFieldColor: (token) =>
                    this._getWordFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusLemma = tokenStatus;
        }
        if (tokenStatusExact !== TokenStatus.UNCOLLECTED || tokenStatusLemma !== TokenStatus.UNCOLLECTED) {
            return cmp(tokenStatusExact, tokenStatusLemma);
        }

        if (shouldCheckExactFormSentenceField) {
            const tokenStatus = await this._getSentenceFieldColor({
                token: trimmedToken,
                track,
                anki,
                dt,
                yomitan,
                tokenizeCache,
                lemmatizeCache,
                ankiCardIdStatuses,
                suspendedCache,
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusExact = tokenStatus;
        }
        if (dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.EXACT_FORM_COLLECTED) {
            const tokenStatus = await this._handleLemmatize({
                token: trimmedToken,
                dt,
                yomitan,
                tokenStatusCache,
                lemmatizeCache,
                cacheUncollected: true,
                getFieldColor: (token) =>
                    this._getSentenceFieldColor({
                        token,
                        track,
                        anki,
                        dt,
                        yomitan,
                        tokenizeCache,
                        lemmatizeCache,
                        ankiCardIdStatuses,
                        suspendedCache,
                    }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus === null) return tokenStatus;
            tokenStatusLemma = tokenStatus;
        }
        return cmp(tokenStatusExact, tokenStatusLemma);
    }

    private async _handleLemmatize(options: {
        token: string;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        cacheUncollected: boolean;
        getFieldColor: (token: string) => Promise<TokenStatus | null>;
    }): Promise<TokenStatus | null> {
        const { token, dt, yomitan, tokenStatusCache, lemmatizeCache, cacheUncollected, getFieldColor } = options;

        let tokenLemmas = lemmatizeCache.get(token);
        if (!tokenLemmas) {
            tokenLemmas = await yomitan.lemmatize(token);
            lemmatizeCache.set(token, tokenLemmas);
            if (this.shouldCancelBuild) return null;
        }
        for (const tokenLemma of tokenLemmas) {
            const cachedTokenLemma = tokenStatusCache.get(tokenLemma);
            if (this._tokenStatusValid(cachedTokenLemma)) return cachedTokenLemma!;
            const tokenStatus = await getFieldColor(tokenLemma);
            if (tokenStatus !== TokenStatus.UNCOLLECTED) {
                tokenStatusCache.set(tokenLemma, tokenStatus);
                return tokenStatus;
            }
            if (cacheUncollected) tokenStatusCache.set(tokenLemma, TokenStatus.UNCOLLECTED);
            if (this.shouldCancelBuild) return null;
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _getWordFieldColor(options: {
        token: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
    }): Promise<TokenStatus | null> {
        const { token, track, anki, dt, ankiCardIdStatuses, suspendedCache } = options;
        try {
            let cardIds = await anki.findCardsWithWord(token, dt.dictionaryAnkiWordFields);
            if (!cardIds.length) return TokenStatus.UNCOLLECTED;
            if (this.shouldCancelBuild) return null;
            return this._getTokenStatusFromCutoff({
                cardIds,
                dt,
                ankiCardIdStatuses,
                suspendedCache,
            });
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color for Track${track} using word fields for token "${token}":`, error);
            return null;
        }
    }

    private async _getSentenceFieldColor(options: {
        token: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenizeCache: Map<string, string[]>;
        lemmatizeCache: Map<string, string[]>;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
    }): Promise<TokenStatus | null> {
        const { token, track, anki, dt, yomitan, tokenizeCache, lemmatizeCache, ankiCardIdStatuses, suspendedCache } =
            options;
        try {
            const cardIds = await anki.findCardsContainingWord(token, dt.dictionaryAnkiSentenceFields);
            if (!cardIds.length) return TokenStatus.UNCOLLECTED;
            if (this.shouldCancelBuild) return null;
            const rawCardInfos = await anki.cardsInfo(cardIds);
            if (!rawCardInfos.length) return null;
            if (this.shouldCancelBuild) return null;

            // Tokenize the sentence field and filter cards that actually contain the token
            const validCardInfos = await filterAsync(
                rawCardInfos,
                async (cardInfo: any) => {
                    for (const sentenceField of dt.dictionaryAnkiSentenceFields) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        let fieldTokens = tokenizeCache.get(field.value);
                        if (!fieldTokens) {
                            fieldTokens = (await yomitan.tokenize(field.value)).map((t) => t.trim());
                            tokenizeCache.set(field.value, fieldTokens);
                            if (this.shouldCancelBuild) return false;
                        }
                        if (fieldTokens.includes(token)) return true;
                        if (dt.dictionaryAnkiSentenceTokenMatchStrategy !== TokenMatchStrategy.ANY_FORM_COLLECTED) {
                            continue;
                        }
                        for (const fieldToken of fieldTokens) {
                            let fieldTokenLemmas = lemmatizeCache.get(fieldToken);
                            if (!fieldTokenLemmas) {
                                fieldTokenLemmas = await yomitan.lemmatize(fieldToken);
                                lemmatizeCache.set(fieldToken, fieldTokenLemmas);
                                if (this.shouldCancelBuild) return false;
                            }
                            if (fieldTokenLemmas.includes(token)) return true;
                        }
                    }
                    return false;
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (this.shouldCancelBuild) return null;
            if (!validCardInfos.length) return TokenStatus.UNCOLLECTED;

            return this._getTokenStatusFromCutoff({
                cardIds: validCardInfos.map((cardInfo) => cardInfo.cardId),
                dt,
                ankiCardIdStatuses,
                suspendedCache,
            });
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color for Track${track} using sentence fields for token "${token}":`, error);
            return null;
        }
    }

    private async _getTokenStatusFromCutoff(options: {
        cardIds: number[];
        dt: DictionaryTrack;
        ankiCardIdStatuses: Map<number, TokenStatus>;
        suspendedCache: Set<number>;
    }): Promise<TokenStatus | null> {
        const { dt, ankiCardIdStatuses, suspendedCache } = options;
        let cardIds = options.cardIds;
        if (dt.dictionaryAnkiTreatSuspended !== 'NORMAL') {
            cardIds = cardIds.filter((cardId) => !suspendedCache.has(cardId));
            if (!cardIds.length) return dt.dictionaryAnkiTreatSuspended;
        }
        if (cardIds.some((c) => ankiCardIdStatuses.get(c) === TokenStatus.MATURE)) return TokenStatus.MATURE;
        if (cardIds.some((c) => ankiCardIdStatuses.get(c) === TokenStatus.YOUNG)) return TokenStatus.YOUNG;
        if (cardIds.some((c) => ankiCardIdStatuses.get(c) === TokenStatus.GRADUATED)) return TokenStatus.GRADUATED;
        if (cardIds.some((c) => ankiCardIdStatuses.get(c) === TokenStatus.LEARNING)) return TokenStatus.LEARNING;
        return TokenStatus.UNKNOWN;
    }

    private _applyTokenStyle(options: {
        rawToken: string;
        tokenStatus: TokenStatus | null;
        dt: DictionaryTrack;
    }): string {
        const { rawToken, tokenStatus, dt } = options;
        if (tokenStatus === null) return `<span style="text-decoration: line-through red 3px;">${rawToken}</span>`;
        if (!dt.colorizeFullyKnownTokens && tokenStatus === getFullyKnownTokenStatus()) return rawToken;
        const c = dt.tokenStatusColors[tokenStatus];
        const t = dt.tokenStylingThickness;
        switch (dt.tokenStyling) {
            case TokenStyling.TEXT:
                return `<span style="-webkit-text-fill-color: ${c};">${rawToken}</span>`;
            case TokenStyling.BACKGROUND:
                return `<span style="background-color: ${c};">${rawToken}</span>`;
            case TokenStyling.UNDERLINE:
            case TokenStyling.OVERLINE:
                return `<span style="text-decoration: ${dt.tokenStyling} ${c} ${t}px;">${rawToken}</span>`;
            case TokenStyling.OUTLINE:
                return `<span style="-webkit-text-stroke: ${t}px ${c};">${rawToken}</span>`;
            default:
                return `<span style="text-decoration: line-through red 3px double;">${rawToken}</span>`;
        }
    }

    unbind() {
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }
        this.resetCache(this.settings);
    }
}
