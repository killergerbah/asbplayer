import { Fetcher, ColoredSubtitleModel } from '@project/common';
import { Anki } from '@project/common/anki';
import {
    AsbplayerSettings,
    DictionaryAnkiTreatSuspended,
    DictionarySubtitleAppearance,
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
    private _subtitles: ColoredSubtitleModel[];
    private settings: AsbplayerSettings;
    private subtitleCollection: SubtitleCollection<ColoredSubtitleModel>;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingSubtitles?: ColoredSubtitleModel[];
    private showingNeedsRefreshCount: number;

    private yomitanTracks: (Yomitan | undefined)[];
    private ankiTracks: (Anki | undefined)[];
    private readonly fetcher?: Fetcher;
    private dictionaryTracks: (DictionaryTrack | undefined)[] | undefined;
    private tokenizeCache: Map<number, Map<string, string[]>>;
    private tokenStatusCache: Map<number, Map<string, TokenStatus | null>>;
    private lemmatizeCache: Map<number, Map<string, string[]>>;
    private erroredCache: Set<number>;
    private uncollectedCache: Set<number>;
    private uncollectedNeedsRefresh: boolean;
    private ankiRecentlyModifiedCardIds: Map<string, Set<number>>;
    private ankiLastRecentlyModifiedCheck: number;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private colorCacheBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current color cache build, checked after each async call
    private tokenRequestFailed: boolean;

    private readonly subtitleColorsUpdated: (updatedSubtitles: ColoredSubtitleModel[]) => void;
    private readonly getMediaTimeMs?: () => number;

    constructor(
        settings: AsbplayerSettings,
        subtitleColorsUpdated: (updatedSubtitles: ColoredSubtitleModel[]) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        this._subtitles = [];
        this.settings = settings;
        this.yomitanTracks = [];
        this.ankiTracks = [];
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
        this.ankiRecentlyModifiedCardIds = new Map();
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
        this.ankiTracks = [];
        this.dictionaryTracks = undefined;
        this.tokenizeCache.clear();
        this.tokenStatusCache.clear();
        this.lemmatizeCache.clear();
        this.erroredCache.clear();
        this.uncollectedCache.clear();
        this.ankiRecentlyModifiedCardIds.clear();
        for (const subtitle of this._subtitles) {
            subtitle.coloredVideoText = undefined;
            subtitle.coloredAppText = undefined;
        }
    }

    reset() {
        this.subtitles = [];
    }

    ankiCardWasUpdated() {
        this.uncollectedNeedsRefresh = true;
    }

    private _dictionaryTrackEnabled(dt: DictionaryTrack | undefined) {
        return dt && (dt.dictionaryColorizeOnVideo || dt.dictionaryColorizeOnApp);
    }

    private _tokenStatusValid(tokenStatus: TokenStatus | undefined | null) {
        if (tokenStatus === undefined || tokenStatus === null) return false;
        if (tokenStatus === TokenStatus.UNCOLLECTED) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private _colorCacheValid(cachedColoredText: string | undefined, index: number) {
        if (cachedColoredText === undefined) return false;
        if (this.erroredCache.has(index)) return false;
        if (this.uncollectedCache.has(index)) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private async _checkAnkiRecentlyModifiedCards() {
        if (!this.dictionaryTracks) return;

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

        const seenUrls = new Set<string>();
        const uniqueAnkis = this.ankiTracks.reduce<[Anki, string][]>((acc, anki) => {
            if (!anki) return acc;
            const ankiConnectUrl = anki.ankiConnectUrl.replace(/\/+$/, '');
            if (seenUrls.has(ankiConnectUrl)) return acc;
            seenUrls.add(ankiConnectUrl);
            acc.push([anki, ankiConnectUrl]);
            return acc;
        }, []);
        if (!uniqueAnkis.length) return;

        const sinceDays = 1;
        for (const [anki, ankiConnectUrl] of uniqueAnkis) {
            if (!this.ankiRecentlyModifiedCardIds.has(ankiConnectUrl)) {
                this.ankiRecentlyModifiedCardIds.set(ankiConnectUrl, new Set());
            }
            const prevCardIds = this.ankiRecentlyModifiedCardIds.get(ankiConnectUrl)!;
            try {
                const cardIds: Set<number> = new Set(await anki!.findRecentlyEditedCards(allFields, sinceDays)); // Don't care about rated:1 or suspended status
                if (cardIds.size === prevCardIds.size && [...cardIds].every((cardId) => prevCardIds.has(cardId))) {
                    continue;
                }
                this.uncollectedNeedsRefresh = true;
                this.ankiRecentlyModifiedCardIds.set(ankiConnectUrl, cardIds);
                return;
            } catch (e) {
                console.error(`Error checking Anki@${anki!.ankiConnectUrl} recently modified cards:`, e);
            }
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
                                !this._subtitles[s.index].coloredVideoText &&
                                !this._subtitles[s.index].coloredAppText &&
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

    private _getColorBufferIndexes(subtitles?: ColoredSubtitleModel[]) {
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

    private async _buildColorCache(subtitles: ColoredSubtitleModel[]): Promise<boolean> {
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
                    this.ankiTracks[track] = undefined;
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
                if (!this.ankiTracks[track] && dt!.dictionaryAnkiEnabled) {
                    try {
                        const anki = new Anki(
                            { ...this.settings, ankiConnectUrl: dt!.dictionaryAnkiConnectUrl },
                            this.fetcher
                        );
                        const permission = (await anki.requestPermission()).permission;
                        if (permission !== 'granted') throw new Error(`permission ${permission}`);
                        this.ankiTracks[track] = anki;
                    } catch (e) {
                        console.warn('Anki permission request failed:', e);
                        this.ankiTracks[track] = undefined;
                    }
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
                                const cachedColoredText =
                                    this._subtitles[index].coloredVideoText ?? this._subtitles[index].coloredAppText;
                                if (this._colorCacheValid(cachedColoredText, index)) return;
                                const { coloredVideoText, coloredAppText } = await this._colorizeText({
                                    text,
                                    track,
                                    index,
                                    dt: dt!,
                                });
                                if (this.shouldCancelBuild) return;
                                if (cachedColoredText === (coloredVideoText ?? coloredAppText)) return;
                                const updatedSubtitles: ColoredSubtitleModel[] = [];
                                if (coloredVideoText) {
                                    this._subtitles[index].coloredVideoText = coloredVideoText;
                                    updatedSubtitles.push(this._subtitles[index]);
                                }
                                if (coloredAppText) {
                                    this._subtitles[index].coloredAppText = coloredAppText;
                                    if (!updatedSubtitles.some((s) => s.index === index)) {
                                        updatedSubtitles.push(this._subtitles[index]);
                                    }
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
                this.ankiTracks = [];
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
    }): Promise<{ coloredVideoText?: string; coloredAppText?: string }> {
        const { text, track, index, dt } = options;
        try {
            const yomitan = this.yomitanTracks[track];
            if (!yomitan) throw new Error('Yomitan not initialized');
            const anki = this.ankiTracks[track];
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

            let coloredVideoText: string = '';
            let coloredAppText: string = '';
            let textHasError = false;
            let textHasUncollected = false;
            let rawTokens = tokenizeCache.get(text);
            if (!rawTokens) {
                rawTokens = await yomitan.tokenize(text);
                tokenizeCache.set(text, rawTokens);
                if (this.shouldCancelBuild) return {};
            }
            for (const rawToken of rawTokens) {
                const trimmedToken = rawToken.trim();

                // Token is already cached or not a word
                const cachedTokenStatus = tokenStatusCache.get(trimmedToken);
                if (this._tokenStatusValid(cachedTokenStatus)) {
                    const { videoRes, appRes } = this._applyTokenStyle({
                        rawToken,
                        tokenStatus: cachedTokenStatus!,
                        dt,
                    });
                    if (videoRes) coloredVideoText += videoRes;
                    if (appRes) coloredAppText += appRes;
                    if (cachedTokenStatus === null) textHasError = true;
                    else if (cachedTokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    const fullyKnownTokenStatus = getFullyKnownTokenStatus();
                    const { videoRes, appRes } = this._applyTokenStyle({
                        rawToken,
                        tokenStatus: fullyKnownTokenStatus,
                        dt,
                    });
                    if (videoRes) coloredVideoText += videoRes;
                    if (appRes) coloredAppText += appRes;
                    tokenStatusCache.set(trimmedToken, fullyKnownTokenStatus);
                    continue;
                }

                let shouldCheckExactFormWordField = true;
                if (dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
                    let tokenLemmas = lemmatizeCache.get(trimmedToken);
                    if (!tokenLemmas) {
                        tokenLemmas = await yomitan.lemmatize(trimmedToken);
                        lemmatizeCache.set(trimmedToken, tokenLemmas);
                        if (this.shouldCancelBuild) return {};
                    }
                    if (tokenLemmas.length) shouldCheckExactFormWordField = false;
                }
                let shouldCheckExactFormSentenceField = true;
                if (dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED) {
                    let tokenLemmas = lemmatizeCache.get(trimmedToken);
                    if (!tokenLemmas) {
                        tokenLemmas = await yomitan.lemmatize(trimmedToken);
                        lemmatizeCache.set(trimmedToken, tokenLemmas);
                        if (this.shouldCancelBuild) return {};
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
                            tokenStatusCache,
                            lemmatizeCache,
                            tokenizeCache,
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
                            tokenStatusCache,
                            lemmatizeCache,
                            tokenizeCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                        });
                        break;
                    case TokenMatchStrategyPriority.MOST_KNOWN:
                        tokenStatus = await this._handlePriorityKnown({
                            trimmedToken,
                            track,
                            anki,
                            dt,
                            yomitan,
                            tokenStatusCache,
                            lemmatizeCache,
                            tokenizeCache,
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
                            tokenStatusCache,
                            lemmatizeCache,
                            tokenizeCache,
                            shouldCheckExactFormWordField,
                            shouldCheckExactFormSentenceField,
                            cmp: (a, b) => (a < b ? a : b),
                        });
                        break;
                    default:
                        throw new Error(`Unknown strategy priority: ${dt.dictionaryTokenMatchStrategyPriority}`);
                }
                if (this.shouldCancelBuild) return {};

                const { videoRes, appRes } = this._applyTokenStyle({ rawToken, tokenStatus, dt });
                if (videoRes) coloredVideoText += videoRes;
                if (appRes) coloredAppText += appRes;
                if (tokenStatus === TokenStatus.UNCOLLECTED) textHasUncollected = true;
                else if (tokenStatus === null) textHasError = true;
                tokenStatusCache.set(trimmedToken, tokenStatus);
            }

            textHasError ? this.erroredCache.add(index) : this.erroredCache.delete(index);
            textHasUncollected ? this.uncollectedCache.add(index) : this.uncollectedCache.delete(index);
            return {
                coloredVideoText: dt.dictionaryColorizeOnVideo ? coloredVideoText : undefined,
                coloredAppText: dt.dictionaryColorizeOnApp ? coloredAppText : undefined,
            };
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error colorizing subtitle text for Track${track}:`, error);
            this.erroredCache.add(index);
            const { videoRes, appRes } = this._applyTokenStyle({ rawToken: text, tokenStatus: null, dt });
            return { coloredVideoText: videoRes, coloredAppText: appRes };
        }
    }

    private async _handlePriorityExact(options: {
        trimmedToken: string;
        track: number;
        anki: Anki;
        dt: DictionaryTrack;
        yomitan: Yomitan;
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        tokenizeCache: Map<string, string[]>;
        shouldCheckExactFormWordField: boolean;
        shouldCheckExactFormSentenceField: boolean;
    }): Promise<TokenStatus | null> {
        const {
            trimmedToken,
            track,
            anki,
            dt,
            yomitan,
            tokenStatusCache,
            lemmatizeCache,
            tokenizeCache,
            shouldCheckExactFormWordField,
            shouldCheckExactFormSentenceField,
        } = options;
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({ token: trimmedToken, track, anki, dt });
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
                getFieldColor: (token) => this._getWordFieldColor({ token, track, anki, dt }),
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
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        tokenizeCache: Map<string, string[]>;
        shouldCheckExactFormWordField: boolean;
        shouldCheckExactFormSentenceField: boolean;
    }): Promise<TokenStatus | null> {
        const {
            trimmedToken,
            track,
            anki,
            dt,
            yomitan,
            tokenStatusCache,
            lemmatizeCache,
            tokenizeCache,
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
                getFieldColor: (token) => this._getWordFieldColor({ token, track, anki, dt }),
            });
            if (this.shouldCancelBuild) return null;
            if (tokenStatus !== TokenStatus.UNCOLLECTED) return tokenStatus;
        }
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({ token: trimmedToken, track, anki, dt });
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
        tokenStatusCache: Map<string, TokenStatus | null>;
        lemmatizeCache: Map<string, string[]>;
        tokenizeCache: Map<string, string[]>;
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
            tokenStatusCache,
            lemmatizeCache,
            tokenizeCache,
            shouldCheckExactFormWordField,
            shouldCheckExactFormSentenceField,
            cmp,
        } = options;
        let tokenStatusExact: TokenStatus = TokenStatus.UNCOLLECTED;
        if (shouldCheckExactFormWordField) {
            const tokenStatus = await this._getWordFieldColor({ token: trimmedToken, track, anki, dt });
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
                getFieldColor: (token) => this._getWordFieldColor({ token, track, anki, dt }),
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
    }): Promise<TokenStatus | null> {
        const { token, track, anki, dt } = options;
        try {
            let cardIds = await anki.findCardsWithWord(token, dt.dictionaryAnkiWordFields);
            if (!cardIds.length) return TokenStatus.UNCOLLECTED;
            if (this.shouldCancelBuild) return null;
            const suspendedResult = await this._handleSuspended({ cardIds, anki, dt });
            if (suspendedResult) return suspendedResult;
            if (this.shouldCancelBuild) return null;
            const intervals = await anki.currentIntervals(cardIds);
            return this._getTokenStatusFromIntervals({ token, track, intervals, cardIds, dt });
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
    }): Promise<TokenStatus | null> {
        const { token, track, anki, dt, yomitan, tokenizeCache, lemmatizeCache } = options;
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

            const suspendedResult = await this._handleSuspended({
                cardIds: validCardInfos.map((c) => c.cardId),
                anki,
                dt,
            });
            if (suspendedResult) return suspendedResult;
            return this._getTokenStatusFromIntervals({
                token,
                track,
                intervals: validCardInfos.map((cardInfo) => cardInfo.interval),
                cardIds: validCardInfos.map((cardInfo) => cardInfo.cardId),
                dt,
            });
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color for Track${track} using sentence fields for token "${token}":`, error);
            return null;
        }
    }

    private _getTokenStatusFromIntervals(options: {
        token: string;
        track: number;
        intervals: number[];
        cardIds: number[];
        dt: DictionaryTrack;
    }): TokenStatus | null {
        const { token, track, intervals, cardIds, dt } = options;
        if (!intervals.length) {
            console.error(`No intervals found for Track${track} for token "${token}" with card IDs:`, cardIds);
            return null;
        }
        if (intervals.every((i) => i >= dt.dictionaryAnkiMatureInterval)) return TokenStatus.MATURE;
        if (intervals.every((i) => i === 0)) return TokenStatus.UNKNOWN;
        return TokenStatus.YOUNG; // If < dt.dictionaryAnkiMatureInterval && !== 0 or mixed intervals
    }

    private _applyTokenStyle(options: { rawToken: string; tokenStatus: TokenStatus | null; dt: DictionaryTrack }): {
        videoRes?: string;
        appRes?: string;
    } {
        const { rawToken, tokenStatus, dt } = options;
        let videoRes: string | undefined;
        let appRes: string | undefined;
        if (dt.dictionaryColorizeOnVideo) {
            videoRes = this._applyTokenStyleImpl({
                rawToken,
                tokenStatus,
                config: dt.dictionaryVideoSubtitleAppearance,
            });
        }
        if (dt.dictionaryColorizeOnApp) {
            appRes = this._applyTokenStyleImpl({ rawToken, tokenStatus, config: dt.dictionaryAppSubtitleAppearance });
        }
        return { videoRes, appRes };
    }

    private _applyTokenStyleImpl(options: {
        rawToken: string;
        tokenStatus: TokenStatus | null;
        config: DictionarySubtitleAppearance;
    }): string {
        const { rawToken, tokenStatus, config } = options;
        if (tokenStatus === null) return `<span style="text-decoration: line-through red 3px;">${rawToken}</span>`;
        if (!config.colorizeFullyKnownTokens && tokenStatus === getFullyKnownTokenStatus()) return rawToken;
        switch (config.tokenStyling) {
            case TokenStyling.TEXT:
                return `<span style="color: ${config.tokenStatusColors[tokenStatus]};">${rawToken}</span>`;
            case TokenStyling.UNDERLINE:
            case TokenStyling.OVERLINE:
                return `<span style="text-decoration: ${config.tokenStyling} ${config.tokenStatusColors[tokenStatus]} ${config.tokenStylingThickness}px;">${rawToken}</span>`;
            default:
                return `<span style="text-decoration: line-through red 3px double;">${rawToken}</span>`;
        }
    }

    private async _handleSuspended(options: {
        cardIds: number[];
        anki: Anki;
        dt: DictionaryTrack;
    }): Promise<TokenStatus | null> {
        const { cardIds, anki, dt } = options;
        if (dt.dictionaryAnkiTreatSuspended === DictionaryAnkiTreatSuspended.NORMAL) return null;
        if (!(await anki.areSuspended(cardIds)).every((s) => s)) return null;
        switch (dt.dictionaryAnkiTreatSuspended) {
            case DictionaryAnkiTreatSuspended.MATURE:
                return TokenStatus.MATURE;
            case DictionaryAnkiTreatSuspended.YOUNG:
                return TokenStatus.YOUNG;
            case DictionaryAnkiTreatSuspended.UNKNOWN:
                return TokenStatus.UNKNOWN;
            default:
                return null;
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
