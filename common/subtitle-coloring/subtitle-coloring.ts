import {
    DictionaryBuildAnkiCacheStateError,
    DictionaryBuildAnkiCacheStateType,
    Fetcher,
    RichSubtitleModel,
    Token,
    Tokenization,
    TokenizedSubtitleModel,
    TokenReading,
} from '@project/common';
import { Anki } from '@project/common/anki';
import {
    ApplyStrategy,
    areDictionaryTracksEqual,
    AsbplayerSettings,
    dictionaryStatusCollectionEnabled,
    DictionaryTokenSource,
    DictionaryTrack,
    dictionaryTrackEnabled,
    getFullyKnownTokenStatus,
    SettingsProvider,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';
import { CardStatus, DictionaryProvider, LemmaResults, TokenResults } from '@project/common/dictionary-db';
import { SubtitleCollection, SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import {
    arrayEquals,
    HAS_LETTER_REGEX,
    inBatches,
    iterateOverStringInBlocks,
    ONLY_ASCII_LETTERS_REGEX,
} from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';

const TOKEN_CACHE_BUILD_AHEAD_INIT = 10;
const TOKEN_CACHE_BUILD_AHEAD = 100;
const TOKEN_CACHE_BUILD_AHEAD_THRESHOLD = 10; // Only build ahead with only this many rich subtitles left
const TOKEN_CACHE_BATCH_SIZE = 1; // Processing more than 1 at a time is slower
const TOKEN_CACHE_ERROR_REFRESH_INTERVAL = 10000;
const ANKI_RECENTLY_MODIFIED_INTERVAL = 10000;

const ASB_TOKEN_CLASS = 'asb-token';
const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';

interface TokenStatusResult {
    status: TokenStatus;
    source: DictionaryTokenSource;
    token?: string; // For any form filtering
}

interface TrackState {
    track: number;
    dt: DictionaryTrack;
    yt: Yomitan | undefined;
    collectedExactForm: Map<string, TokenStatusResult>;
    collectedLemmaForm: Map<string, TokenStatusResult>;
    collectedAnyForm: Map<string, TokenStatusResult[]>;
    tokenStates: Map<string, TokenState[]>;
}

function shouldUseExactForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.EXACT_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
}

function shouldUseLemmaForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.LEMMA_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
}

function shouldUseAnyForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.ANY_FORM_COLLECTED;
}

const readingsAreSame = (a: TokenReading, b: TokenReading) => arrayEquals(a.pos, b.pos) && a.reading === b.reading;

const tokenizationsAreSame = (a: Tokenization, b: Tokenization) => {
    if (a.error !== b.error) {
        return false;
    }
    if ((a.tokens === undefined && b.tokens !== undefined) || (a.tokens !== undefined && b.tokens === undefined)) {
        return false;
    }
    if (a.tokens === undefined && b.tokens === undefined) {
        return true;
    }
    if (a.tokens!.length !== b.tokens!.length) {
        return false;
    }
    for (let i = 0; i < a.tokens!.length; ++i) {
        const aToken = a.tokens![i];
        const bToken = b.tokens![i];

        if (!arrayEquals(aToken.pos, bToken.pos)) {
            return false;
        }
        if (aToken.status !== bToken.status) {
            return false;
        }
        if (!arrayEquals(aToken.pos, bToken.pos)) {
            return false;
        }
        if (
            (aToken.states === undefined && bToken.states !== undefined) ||
            (aToken.states !== undefined && bToken.states === undefined)
        ) {
            return false;
        }
        if (aToken.states !== undefined && bToken.states !== undefined && !arrayEquals(aToken.states, bToken.states)) {
            return false;
        }
        if (
            (aToken.readings === undefined && bToken.readings !== undefined) ||
            (aToken.readings !== undefined && bToken.readings === undefined)
        ) {
            return false;
        }
        if (
            aToken.readings !== undefined &&
            bToken.readings !== undefined &&
            !arrayEquals(aToken.readings, bToken.readings, readingsAreSame)
        ) {
            return false;
        }
    }
    return true;
};

interface InternalSubtitleModel extends TokenizedSubtitleModel {
    text: string;
    __tokenized?: boolean;
}

export class SubtitleColoring extends SubtitleCollection<RichSubtitleModel> {
    private _subtitles: InternalSubtitleModel[];
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly settingsProvider: SettingsProvider;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingSubtitles?: RichSubtitleModel[];
    private showingNeedsRefreshCount: number;
    private buildLowerThreshold: number;
    private buildUpperThreshold: number;

    private profile: string | undefined | null;
    private anki: Anki | undefined;
    private readonly fetcher?: Fetcher;
    private trackStates: TrackState[];
    private erroredCache: Set<number>;
    private tokenToIndexesCache: Map<string, Set<number>>;
    private tokensForRefresh: Set<string>;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiLastRecentlyModifiedCheck: number;
    private ankiRecentlyModifiedTrigger: boolean;
    private ankiRecentlyModifiedFirstCheck: boolean;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private colorCacheBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current color cache build, checked after each async call
    private tokenRequestFailed: boolean;

    private readonly subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void;
    private readonly getMediaTimeMs?: () => number;

    private removeBuildAnkiCacheStateChangeCB?: () => void;
    private removeAnkiCardModifiedCB?: () => void;

    constructor(
        dictionaryProvider: DictionaryProvider,
        settingsProvider: SettingsProvider,
        options: SubtitleCollectionOptions,
        subtitleColorsUpdated: (updatedSubtitles: RichSubtitleModel[]) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        super({ ...options, returnNextToShow: true });
        this._subtitles = [];
        this.buildLowerThreshold = 0;
        this.buildUpperThreshold = 0;
        this.dictionaryProvider = dictionaryProvider;
        this.settingsProvider = settingsProvider;
        this.profile = null;
        this.fetcher = fetcher;
        this.trackStates = [];
        this.subtitleColorsUpdated = subtitleColorsUpdated;
        this.getMediaTimeMs = getMediaTimeMs;
        this.showingNeedsRefreshCount = 0;
        this.erroredCache = new Set();
        this.tokenToIndexesCache = new Map();
        this.tokensForRefresh = new Set();
        this.ankiRecentlyModifiedCardIds = new Set();
        this.ankiLastRecentlyModifiedCheck = Date.now();
        this.ankiRecentlyModifiedTrigger = false;
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

    setSubtitles(subtitles: TokenizedSubtitleModel[]) {
        const needsReset =
            subtitles.length !== this._subtitles.length ||
            subtitles.some((s) => s.text !== this._subtitles[s.index].text);
        if (!needsReset) {
            // Preserve existing cache here so callers don't need to be aware of it
            const subtitlesWithRichText: TokenizedSubtitleModel[] = [];

            for (const s of subtitles) {
                s.tokenization = this._subtitles[s.index].tokenization;
                s.richText = this._subtitles[s.index].richText;
                if (s.richText !== undefined) {
                    subtitlesWithRichText.push(s);
                }
            }

            // Colors need to be re-published because it's possible the passed-in subtitles are only missing
            // the colors e.g. if the same subtitle file is reloaded twice in a row
            this.subtitleColorsUpdated(subtitlesWithRichText);
        }
        this._subtitles = subtitles.map((s) => ({ ...s })); // Separate internals from react state changes
        super.setSubtitles(this._subtitles);
        if (needsReset) {
            this._resetCache();
            const { colorBufferStartIndex, colorBufferEndIndex } = this._getColorBufferIndexes(true);
            void this._buildColorCache(colorBufferStartIndex, colorBufferEndIndex, true);
        }
    }

    private _resetCache() {
        if (this.colorCacheBuilding) this.shouldCancelBuild = true;
        this.profile = null;
        this.anki = undefined;
        this.trackStates = [];
        this.erroredCache.clear();
        this.tokenToIndexesCache.clear();
        this.tokensForRefresh = new Set();
        this.ankiRecentlyModifiedCardIds.clear();
        this.ankiRecentlyModifiedTrigger = false;
        this.ankiRecentlyModifiedFirstCheck = true;
        this._subtitles.forEach((s) => (s.__tokenized = undefined));
        this.buildLowerThreshold = 0;
        this.buildUpperThreshold = 0;
    }

    reset() {
        this.setSubtitles([]);
    }

    settingsUpdated(settings: AsbplayerSettings) {
        let settingsAreEqual =
            (!this.anki || this.anki.ankiConnectUrl === settings.ankiConnectUrl) &&
            this.trackStates.length === settings.dictionaryTracks.length;
        for (const [index, dt] of settings.dictionaryTracks.entries()) {
            const ts = this.trackStates[index];
            if (ts && areDictionaryTracksEqual(ts.dt, dt)) continue;
            settingsAreEqual = false;
            break;
        }
        if (settingsAreEqual) return;

        const subtitlesToReset: TokenizedSubtitleModel[] = []; // Tracks that went from enabled to disabled need all subscribers to purge their richText
        for (const ts of this.trackStates) {
            if (!dictionaryTrackEnabled(ts.dt)) continue; // Already disabled
            const newDt = settings.dictionaryTracks[ts.track];
            if (newDt && dictionaryTrackEnabled(newDt)) continue; // We will be processing, keep current richText on screen until then
            subtitlesToReset.push(...this._subtitles.filter((s) => s.track === ts.track));
        }
        if (subtitlesToReset.length) {
            for (const s of subtitlesToReset) s.tokenization = undefined;
            this.subtitleColorsUpdated(subtitlesToReset);
        }
        this._resetCache();
    }

    tokensWereModified(modifiedTokens: string[]) {
        for (const token of modifiedTokens) this.tokensForRefresh.add(token);
    }

    ankiCardWasModified() {
        this.ankiRecentlyModifiedTrigger = true;
    }

    hoverOnly(track: number) {
        return this.trackStates[track]?.dt.dictionaryColorizeOnHoverOnly;
    }

    async saveTokenLocal(
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ): Promise<void> {
        if (this.profile === null) return;
        const profile = this.profile;
        const ts = this.trackStates[track];
        if (!ts || !dictionaryTrackEnabled(ts.dt) || !ts.yt) return;

        const lemmas = await ts.yt.lemmatize(token);
        await this.dictionaryProvider.saveRecordLocalBulk(profile, [{ token, status, lemmas, states }], applyStates);
        this.tokensForRefresh.add(token);
        for (const lemma of lemmas) this.tokensForRefresh.add(lemma);
    }

    private async _checkAnkiRecentlyModifiedCards() {
        if (this.profile === null || !this.trackStates.length) return;
        const profile = this.profile;

        const allFieldsSet: Set<string> = new Set();
        for (const ts of this.trackStates) {
            if (!dictionaryStatusCollectionEnabled(ts.dt)) continue;
            for (const field of ts.dt.dictionaryAnkiWordFields.concat(ts.dt.dictionaryAnkiSentenceFields)) {
                allFieldsSet.add(field);
            }
        }
        if (!allFieldsSet.size) return;
        const allFields = Array.from(allFieldsSet);

        const options = { useOriginTab: true }; // We don't have the full extension context if in a page script
        if (!this.anki) {
            try {
                this.anki = new Anki(await this.settingsProvider.getAll(), this.fetcher);
                const permission = (await this.anki.requestPermission()).permission;
                if (permission !== 'granted') throw new Error(`permission ${permission}`);
                await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll(), options); // Keep cache updated without user action
            } catch (e) {
                console.warn('Anki permission request failed:', e);
                this.anki = undefined;
                return;
            }
        }

        try {
            const cardIds = await this.anki.findRecentlyEditedOrReviewedCards(allFields, 1); // Can't efficiently poll suspended status
            if (
                cardIds.length === this.ankiRecentlyModifiedCardIds.size &&
                cardIds.every((cardId) => this.ankiRecentlyModifiedCardIds.has(cardId))
            ) {
                if (this.ankiRecentlyModifiedFirstCheck) this.ankiRecentlyModifiedFirstCheck = false;
                return;
            }
            this.ankiRecentlyModifiedCardIds = new Set(cardIds);
            if (this.ankiRecentlyModifiedFirstCheck) {
                this.ankiRecentlyModifiedFirstCheck = false;
                return;
            }
            await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll(), options);
        } catch (e) {
            console.error(`Error checking Anki recently modified cards:`, e);
            this.anki = undefined;
            this.ankiRecentlyModifiedCardIds.clear();
            this.ankiRecentlyModifiedFirstCheck = false;
        }
    }

    bind() {
        if (this.removeBuildAnkiCacheStateChangeCB) this.removeBuildAnkiCacheStateChangeCB();
        this.removeBuildAnkiCacheStateChangeCB = this.dictionaryProvider.onBuildAnkiCacheStateChange((state) => {
            this.tokensWereModified(state.body?.modifiedTokens ?? []);
            if (state.type === DictionaryBuildAnkiCacheStateType.error) {
                const body = state.body as DictionaryBuildAnkiCacheStateError;
                console.warn(`Dictionary Anki cache build error: ${body.msg}`);
                this.ankiRecentlyModifiedCardIds.clear();
                this.ankiRecentlyModifiedFirstCheck = false;
            }
        });
        if (this.removeAnkiCardModifiedCB) this.removeAnkiCardModifiedCB();
        this.removeAnkiCardModifiedCB = this.dictionaryProvider.onAnkiCardModified(() => this.ankiCardWasModified());

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
                                !this._subtitles[s.index].tokenization &&
                                !this.colorCacheBuildingCurrentIndexes.has(s.index)
                        )
                    ) {
                        if (this.colorCacheBuilding) this.shouldCancelBuild = true;
                    }
                }
                if (this.showingNeedsRefreshCount) {
                    const { colorBufferStartIndex, colorBufferEndIndex } = this._getColorBufferIndexes(
                        false,
                        slice.showing
                    );
                    void this._buildColorCache(colorBufferStartIndex, colorBufferEndIndex).then((res) => {
                        if (res) this.showingNeedsRefreshCount = Math.max(0, this.showingNeedsRefreshCount - 1);
                    });
                    this.colorCacheLastRefresh = Date.now();
                    return;
                }
            }
            if (
                this.tokensForRefresh.size ||
                Date.now() - this.colorCacheLastRefresh >= TOKEN_CACHE_ERROR_REFRESH_INTERVAL
            ) {
                const { colorBufferStartIndex, colorBufferEndIndex } = this._getColorBufferIndexes();
                void this._buildColorCache(colorBufferStartIndex, colorBufferEndIndex);
                this.colorCacheLastRefresh = Date.now();
            }
            if (
                this.ankiRecentlyModifiedTrigger ||
                Date.now() - this.ankiLastRecentlyModifiedCheck >= ANKI_RECENTLY_MODIFIED_INTERVAL
            ) {
                void this._checkAnkiRecentlyModifiedCards();
                this.ankiLastRecentlyModifiedCheck = Date.now();
                this.ankiRecentlyModifiedTrigger = false;
            }
        }, 100);
    }

    private _getColorBufferIndexes(init?: boolean, subtitles?: RichSubtitleModel[]) {
        if (!subtitles?.length) {
            if (this.getMediaTimeMs) {
                const slice = this.subtitlesAt(this.getMediaTimeMs());
                subtitles = slice.showing;
                if (!subtitles.length) subtitles = slice.nextToShow ?? [];
            } else {
                return { colorBufferStartIndex: 0, colorBufferEndIndex: this._subtitles.length };
            }
        }
        const tokenCacheBuildAhead = init ? TOKEN_CACHE_BUILD_AHEAD_INIT : TOKEN_CACHE_BUILD_AHEAD;
        if (!subtitles.length) return { colorBufferStartIndex: 0, colorBufferEndIndex: tokenCacheBuildAhead };
        const colorBufferStartIndex = Math.min(...subtitles.map((s) => s.index));
        const colorBufferEndIndex = Math.max(...subtitles.map((s) => s.index)) + 1 + tokenCacheBuildAhead;
        return { colorBufferStartIndex, colorBufferEndIndex };
    }

    private async _buildColorCache(
        colorBufferStartIndex: number,
        colorBufferEndIndex: number,
        init?: boolean
    ): Promise<boolean> {
        const subtitles = this._subtitles.slice(colorBufferStartIndex, colorBufferEndIndex);
        if (!subtitles.length) return true;
        if (this.profile === null) {
            const profile = (await this.settingsProvider.activeProfile())?.name;
            if (this.profile === null) {
                this.profile = profile;
                this.ankiRecentlyModifiedTrigger = true;
            }
        }
        const profile = this.profile;
        if (!this.trackStates.length) {
            this.trackStates = (await this.settingsProvider.getSingle('dictionaryTracks')).map((dt, track) => ({
                track,
                dt,
                yt: undefined,
                collectedExactForm: new Map(),
                collectedLemmaForm: new Map(),
                collectedAnyForm: new Map(),
                tokenStates: new Map(),
            }));
        }
        const trackStates = this.trackStates;
        if (trackStates.every((t) => !dictionaryTrackEnabled(t.dt))) return true;
        if (this.colorCacheBuilding) return false;

        let tokensRefreshed: string[] = [];
        let buildWasCancelled = false;
        let updateThresholds = false;
        try {
            this.colorCacheBuilding = true;
            this.tokenRequestFailed = false;
            for (const ts of trackStates) {
                if (!dictionaryTrackEnabled(ts.dt) || ts.yt) continue;
                try {
                    const yt = new Yomitan(ts.dt, this.fetcher);
                    await yt.version();
                    ts.yt = yt;
                } catch (e) {
                    console.warn(`YomitanTrack${ts.track + 1} version request failed:`, e);
                }
            }

            const indexesForRefresh = new Set<number>();
            if (this.tokensForRefresh.size) {
                const existingIndexes = new Set(subtitles.map((s) => s.index));
                for (const token of this.tokensForRefresh) {
                    tokensRefreshed.push(token);
                    const indexes = this.tokenToIndexesCache.get(token);
                    if (!indexes) continue;
                    for (const index of indexes) {
                        indexesForRefresh.add(index);
                        if (existingIndexes.has(index)) continue;
                        existingIndexes.add(index);
                        subtitles.push(this._subtitles[index]); // Process all relevant subtitles even if not in buffer
                    }
                }
            } else if (!subtitles.some((s) => this.erroredCache.has(s.index))) {
                if (
                    colorBufferStartIndex >= this.buildLowerThreshold &&
                    colorBufferStartIndex < this.buildUpperThreshold
                ) {
                    return true;
                }
                updateThresholds = true;
            }

            try {
                await this._buildTokenAndLemmaMap(profile, subtitles, trackStates);
            } catch (e) {
                console.error('Error building token and lemma map:', e);
                trackStates.forEach((ts) => (ts.yt = undefined)); // Propagate error so that subtitles are error styled
            } finally {
                this.colorCacheBuildingCurrentIndexes.clear();
            }

            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track, __tokenized: alreadyTokenized }) => {
                            if (this.shouldCancelBuild) return;
                            if (alreadyTokenized && !this.erroredCache.has(index) && !indexesForRefresh.has(index))
                                return;
                            const ts = trackStates[track];
                            if (!dictionaryTrackEnabled(ts.dt)) return;
                            try {
                                this.colorCacheBuildingCurrentIndexes.add(index);
                                const existingTokenization = this._subtitles[index].tokenization;
                                const tokenizationModel =
                                    existingTokenization === undefined
                                        ? await this._tokenizationModel(text, index, ts)
                                        : await this._tokenizationModelMergedWithExistingOne(
                                              text,
                                              existingTokenization,
                                              index,
                                              ts
                                          );
                                if (
                                    tokenizationModel?.tokenization === existingTokenization ||
                                    (tokenizationModel?.tokenization &&
                                        existingTokenization &&
                                        tokenizationsAreSame(tokenizationModel.tokenization, existingTokenization))
                                ) {
                                    return;
                                }
                                if (this.shouldCancelBuild) return;
                                const updatedSubtitles: RichSubtitleModel[] = [];
                                if (tokenizationModel) {
                                    const { tokenization, reconstructedText } = tokenizationModel;
                                    const subtitle = this._subtitles[index];
                                    subtitle.tokenization = tokenization;
                                    subtitle.text = reconstructedText;
                                    subtitle.__tokenized = true;
                                    updatedSubtitles.push(subtitle);
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
                tokensRefreshed = [];
                updateThresholds = false;
            }
        } finally {
            if (this.tokenRequestFailed) {
                this.tokenRequestFailed = false;
                trackStates.forEach((ts) => (ts.yt = undefined));
                tokensRefreshed = [];
                updateThresholds = false;
            }
            if (updateThresholds && !init) {
                this.buildUpperThreshold = colorBufferEndIndex - TOKEN_CACHE_BUILD_AHEAD_THRESHOLD;
                this.buildLowerThreshold = colorBufferStartIndex; // Build whenever the user seeks backwards
            }
            this.shouldCancelBuild = false;
            this.colorCacheBuilding = false;
            if (
                tokensRefreshed.length === this.tokensForRefresh.size &&
                tokensRefreshed.every((token) => this.tokensForRefresh.has(token))
            ) {
                this.tokensForRefresh = new Set();
            }
        }
        return !buildWasCancelled;
    }

    private async _buildTokenAndLemmaMap(
        profile: string | undefined,
        subtitles: RichSubtitleModel[],
        trackStates: TrackState[]
    ): Promise<void> {
        const eventsPerTrack = new Map<number, string[]>();
        for (const subtitle of subtitles) {
            const eventsForTrack = eventsPerTrack.get(subtitle.track);
            if (eventsForTrack) eventsForTrack.push(subtitle.text);
            else eventsPerTrack.set(subtitle.track, [subtitle.text]);
            this.colorCacheBuildingCurrentIndexes.add(subtitle.index);
        }

        for (const [track, texts] of eventsPerTrack.entries()) {
            const ts = trackStates[track];
            if (!ts.yt) continue;
            const tokenizeBulkRes = await ts.yt.tokenizeBulk(texts);
            if (!dictionaryStatusCollectionEnabled(ts.dt)) continue; // Still want to bulk tokenize if TokenReadingAnnotation.ALWAYS but no coloring
            if (this.shouldCancelBuild) return;

            const shouldQueryExactForm =
                shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy) ||
                shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);
            const shouldQueryLemmaForm =
                shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy) ||
                shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);
            const shouldQueryAnyForm =
                shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy) ||
                shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);

            for (const token of this.tokensForRefresh) {
                ts.collectedExactForm.delete(token);
                ts.collectedLemmaForm.delete(token);
                ts.collectedAnyForm.delete(token);
                ts.tokenStates.delete(token);
            }

            const forExactFormQuery = new Set<string>();
            const forLemmaFormQuery = new Set<string>();
            const forAnyFormQuery = new Set<string>();
            for (const tokenParts of tokenizeBulkRes) {
                const token = tokenParts
                    .map((p) => p.text)
                    .join('')
                    .trim();
                if (shouldQueryExactForm && !ts.collectedExactForm.has(token)) forExactFormQuery.add(token);
                if (shouldQueryLemmaForm) {
                    for (const lemma of await ts.yt.lemmatize(token)) {
                        if (!ts.collectedLemmaForm.has(lemma)) forLemmaFormQuery.add(lemma);
                    }
                }
                if (shouldQueryAnyForm) {
                    for (const lemma of await ts.yt.lemmatize(token)) {
                        if (!ts.collectedAnyForm.has(lemma)) forAnyFormQuery.add(lemma);
                    }
                }
            }
            if (this.shouldCancelBuild) return;

            const [exactFormResultMap, lemmaFormResultMap, anyFormResultsMap] = await Promise.all([
                forExactFormQuery.size
                    ? this.dictionaryProvider.getBulk(profile, track, Array.from(forExactFormQuery))
                    : ({} as TokenResults),
                forLemmaFormQuery.size
                    ? this.dictionaryProvider.getBulk(profile, track, Array.from(forLemmaFormQuery))
                    : ({} as TokenResults),
                forAnyFormQuery.size
                    ? this.dictionaryProvider.getByLemmaBulk(profile, track, Array.from(forAnyFormQuery))
                    : ({} as LemmaResults),
            ]);
            if (this.shouldCancelBuild) return;

            for (const [token, { states, statuses, source }] of Object.entries(exactFormResultMap)) {
                const status = this._getTokenStatus(statuses, ts);
                ts.collectedExactForm.set(token, { status, source });
                if (states.length) ts.tokenStates.set(token, states);
            }
            for (const [lemma, { states, statuses, source }] of Object.entries(lemmaFormResultMap)) {
                const status = this._getTokenStatus(statuses, ts);
                ts.collectedLemmaForm.set(lemma, { status, source });
                if (!states.length) continue;
                const tokenStates = ts.tokenStates.get(lemma);
                if (tokenStates) {
                    for (const state of states) {
                        if (!tokenStates.includes(state)) tokenStates.push(state);
                    }
                } else {
                    ts.tokenStates.set(lemma, states);
                }
            }
            for (const [lemma, lemmaResults] of Object.entries(anyFormResultsMap)) {
                for (const { states, statuses, source, token } of lemmaResults) {
                    const status = this._getTokenStatus(statuses, ts);
                    const lemmaCollected = ts.collectedAnyForm.get(lemma);
                    if (lemmaCollected) lemmaCollected.push({ status, source, token });
                    else ts.collectedAnyForm.set(lemma, [{ status, source, token }]);
                    if (!states.length) continue;
                    const tokenStates = ts.tokenStates.get(token);
                    if (tokenStates) {
                        for (const state of states) {
                            if (!tokenStates.includes(state)) tokenStates.push(state);
                        }
                    } else {
                        ts.tokenStates.set(token, states);
                    }
                }
            }
        }
    }

    private _getTokenStatus(statuses: CardStatus[], ts: TrackState): TokenStatus {
        if (statuses.length && ts.dt.dictionaryAnkiTreatSuspended !== 'NORMAL') {
            const unsuspended = statuses.filter((status) => !status.suspended);
            if (!unsuspended.length) return ts.dt.dictionaryAnkiTreatSuspended;
            statuses = unsuspended;
        }
        if (statuses.some((c) => c.status === TokenStatus.MATURE)) return TokenStatus.MATURE;
        if (statuses.some((c) => c.status === TokenStatus.YOUNG)) return TokenStatus.YOUNG;
        if (statuses.some((c) => c.status === TokenStatus.GRADUATED)) return TokenStatus.GRADUATED;
        if (statuses.some((c) => c.status === TokenStatus.LEARNING)) return TokenStatus.LEARNING;
        return TokenStatus.UNKNOWN;
    }

    /**
     * If a subtitle has an existing tokenization, the existing tokens are respected.
     * This function only tokenizes the pieces of text in between the existing tokens, and returns a tokenization
     * containing both the existing and newly-computed tokens.
     */
    private async _tokenizationModelMergedWithExistingOne(
        fullText: string,
        existingTokenization: Tokenization,
        index: number,
        ts: TrackState
    ) {
        if (!existingTokenization.tokens?.length) {
            return this._tokenizationModel(fullText, index, ts);
        }
        // To ensure that the final token list is in-order, all tokens (existing or not) are chained onto this promise
        let promise: Promise<void> = Promise.resolve();
        const reconstructedTextParts: string[] = [];
        const allTokens: Token[] = [];
        let canceled = false;
        iterateOverStringInBlocks(
            fullText,
            (_, blockIndex) => existingTokenization.tokens?.[blockIndex],
            (left, right, token?: Token) => {
                if (token === undefined) {
                    promise = promise.then(async () => {
                        if (canceled) {
                            return;
                        }
                        const model = await this._tokenizationModel(fullText.substring(left, right), index, ts, left);
                        if (canceled) {
                            return;
                        }
                        if (model === undefined) {
                            canceled = true;
                            return;
                        }
                        const {
                            reconstructedText,
                            tokenization: { tokens },
                        } = model;
                        reconstructedTextParts.push(reconstructedText);
                        if (tokens !== undefined) {
                            for (const t of tokens) {
                                allTokens.push(t);
                            }
                        }
                    });
                } else {
                    promise = promise.then(async () => {
                        if (canceled) {
                            return;
                        }
                        const text = fullText.substring(token.pos[0], token.pos[1]);
                        const tokenStatus = await this._tokenStatus(text.trim(), ts);
                        token.status = tokenStatus ?? undefined;
                        reconstructedTextParts.push(text);
                        allTokens.push(token);
                        if (tokenStatus === null) {
                            this.erroredCache.add(index);
                        }
                    });
                }
            }
        );
        await promise;
        if (canceled) {
            return undefined;
        }
        return { reconstructedText: reconstructedTextParts.join(''), tokenization: { tokens: allTokens } };
    }

    private async _tokenizationModel(
        fullText: string,
        index: number,
        ts: TrackState,
        baseIndex = 0
    ): Promise<{ reconstructedText: string; tokenization: Tokenization } | undefined> {
        try {
            if (!ts.yt) throw new Error(`Yomitan not initialized for Track${ts.track + 1}`);
            let textHasError = false;
            const tokenizeRes = await ts.yt.tokenize(fullText);
            if (this.shouldCancelBuild) return;
            const tokens: Token[] = [];
            let currentOffset = 0;
            let reconstructedTextParts = [];
            for (const tokenParts of tokenizeRes) {
                const trimmedToken = tokenParts
                    .map((p) => p.text)
                    .join('')
                    .trim();
                const untrimmedToken = tokenParts.map((p) => p.text).join('');
                reconstructedTextParts.push(untrimmedToken);
                const states = ts.tokenStates.get(trimmedToken);
                const token: Token = {
                    pos: [baseIndex + currentOffset, baseIndex + currentOffset + untrimmedToken.length],
                };
                if (states) {
                    token.states = states;
                }
                currentOffset += untrimmedToken.length;
                const readings: TokenReading[] = [];
                let currentPartOffset = 0;
                for (const part of tokenParts) {
                    if (part.reading) {
                        readings.push({
                            pos: [currentPartOffset, currentPartOffset + part.text.length],
                            reading: part.reading,
                        });
                    }
                    currentPartOffset += part.text.length;
                }
                if (readings.length > 0) {
                    token.readings = readings;
                }
                tokens.push(token);

                if (
                    (ts.tokenStates.get(trimmedToken) ?? []).includes(TokenState.IGNORED) ||
                    !HAS_LETTER_REGEX.test(trimmedToken)
                ) {
                    token.status = getFullyKnownTokenStatus();
                    continue;
                }

                const tokenToIndexes = this.tokenToIndexesCache.get(trimmedToken);
                if (tokenToIndexes) tokenToIndexes.add(index);
                else this.tokenToIndexesCache.set(trimmedToken, new Set([index]));
                const lemmas = await ts.yt.lemmatize(trimmedToken);
                if (this.shouldCancelBuild) return;
                for (const lemma of lemmas) {
                    const lemmaToIndexes = this.tokenToIndexesCache.get(lemma);
                    if (lemmaToIndexes) lemmaToIndexes.add(index);
                    else this.tokenToIndexesCache.set(lemma, new Set([index]));
                }

                let tokenStatus: TokenStatus | null = await this._tokenStatus(trimmedToken, ts);
                token.status = tokenStatus ?? undefined;
                if (this.shouldCancelBuild) return;
                if (tokenStatus === null) textHasError = true;
            }

            textHasError ? this.erroredCache.add(index) : this.erroredCache.delete(index);
            return { reconstructedText: reconstructedTextParts.join(''), tokenization: { tokens } };
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error colorizing subtitle text for Track${ts.track + 1}:`, error);
            this.erroredCache.add(index);
            return { reconstructedText: fullText, tokenization: { error: true } };
        }
    }

    private async _tokenStatus(trimmedToken: string, ts: TrackState) {
        if (!ts.yt) {
            throw new Error('Yomitan uninitialized - cannot calculate token status');
        }

        switch (ts.dt.dictionaryTokenMatchStrategyPriority) {
            case TokenMatchStrategyPriority.EXACT:
                return await this._handlePriorityExact(trimmedToken, ts);
            case TokenMatchStrategyPriority.LEMMA:
                return await this._handlePriorityLemma(trimmedToken, ts);
            case TokenMatchStrategyPriority.BEST_KNOWN:
                return await this._handlePriorityKnown(trimmedToken, ts, (tokenStatuses) => Math.max(...tokenStatuses));
            case TokenMatchStrategyPriority.LEAST_KNOWN:
                return await this._handlePriorityKnown(trimmedToken, ts, (tokenStatuses) => Math.min(...tokenStatuses));
            default:
                throw new Error(`Unknown strategy priority: ${ts.dt.dictionaryTokenMatchStrategyPriority}`);
        }
    }

    private async _handlePriorityExact(trimmedToken: string, ts: TrackState): Promise<TokenStatus | null> {
        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                return tokenStatusResult.status;
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) return Math.max(...lemmaStatusResults.map((r) => r.status));
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) return Math.max(...exactMatches.map((r) => r.status));
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) return Math.max(...lemmaMatches.map((r) => r.status));
                return Math.max(...anyFormStatusResults.map((r) => r.status));
            }
        }
        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult) return tokenStatusResult.status;
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult) lemmaStatusResults.push(lemmaStatusResult);
            }
            if (lemmaStatusResults.length) return Math.max(...lemmaStatusResults.map((r) => r.status));
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    anyFormStatusResults.push(statusResult);
                }
            }
            if (anyFormStatusResults.length) {
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) return Math.max(...exactMatches.map((r) => r.status));
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) return Math.max(...lemmaMatches.map((r) => r.status));
                return Math.max(...anyFormStatusResults.map((r) => r.status));
            }
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityLemma(trimmedToken: string, ts: TrackState): Promise<TokenStatus | null> {
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) return Math.max(...lemmaStatusResults.map((r) => r.status));
        }
        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                return tokenStatusResult.status;
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) return Math.max(...lemmaMatches.map((r) => r.status));
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) return Math.max(...exactMatches.map((r) => r.status));
                return Math.max(...anyFormStatusResults.map((r) => r.status));
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult) lemmaStatusResults.push(lemmaStatusResult);
            }
            if (lemmaStatusResults.length) return Math.max(...lemmaStatusResults.map((r) => r.status));
        }
        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult) return tokenStatusResult.status;
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    anyFormStatusResults.push(statusResult);
                }
            }
            if (anyFormStatusResults.length) {
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) return Math.max(...lemmaMatches.map((r) => r.status));
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) return Math.max(...exactMatches.map((r) => r.status));
                return Math.max(...anyFormStatusResults.map((r) => r.status));
            }
        }
        return TokenStatus.UNCOLLECTED;
    }

    private async _handlePriorityKnown(
        trimmedToken: string,
        ts: TrackState,
        cmp: (tokenStatuses: TokenStatus[]) => TokenStatus
    ): Promise<TokenStatus | null> {
        const tokenStatuses: TokenStatus[] = [];

        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                tokenStatuses.push(tokenStatusResult.status);
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) tokenStatuses.push(Math.max(...lemmaStatusResults.map((r) => r.status)));
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            for (const statusResult of anyFormStatusResults) tokenStatuses.push(statusResult.status);
        }
        if (tokenStatuses.length) return cmp(tokenStatuses);

        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult) tokenStatuses.push(tokenStatusResult.status);
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult) lemmaStatusResults.push(lemmaStatusResult);
            }
            if (lemmaStatusResults.length) tokenStatuses.push(Math.max(...lemmaStatusResults.map((r) => r.status)));
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    anyFormStatusResults.push(statusResult);
                }
            }
            for (const statusResult of anyFormStatusResults) tokenStatuses.push(statusResult.status);
        }
        if (tokenStatuses.length) return cmp(tokenStatuses);

        return TokenStatus.UNCOLLECTED;
    }

    unbind() {
        this._resetCache();
        if (this.removeBuildAnkiCacheStateChangeCB) {
            this.removeBuildAnkiCacheStateChangeCB();
            this.removeBuildAnkiCacheStateChangeCB = undefined;
        }
        if (this.removeAnkiCardModifiedCB) {
            this.removeAnkiCardModifiedCB();
            this.removeAnkiCardModifiedCB = undefined;
        }
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }
    }
}

export class HoveredToken {
    private _hoveredElement: HTMLElement | null;

    constructor() {
        this._hoveredElement = null;
    }

    handleMouseOver(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement)) return;
        this._hoveredElement = mouseEvent.target;
    }

    handleMouseOut(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement) || this._hoveredElement === mouseEvent.target) {
            this._hoveredElement = null;
        }
    }

    parse(): { token: string; track: number } | null {
        const tokenEl =
            this._hoveredElement?.tagName === 'RUBY'
                ? this._hoveredElement.parentElement
                : this._hoveredElement?.tagName === 'RT'
                  ? this._hoveredElement.parentElement?.parentElement
                  : this._hoveredElement;
        if (!tokenEl?.classList.contains(ASB_TOKEN_CLASS)) return null;

        const trackStr = tokenEl.closest('[data-track]')?.getAttribute('data-track');
        if (!trackStr) return null;

        let token = '';
        for (const child of tokenEl.childNodes) token += this._extractTokenFromNode(child);
        token = token.trim();
        if (!token.length) return null;
        return { token, track: parseInt(trackStr) };
    }

    private _extractTokenFromNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        let token = '';
        const el = node as HTMLElement;
        if (el.tagName === 'RUBY') {
            for (const child of el.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'RT') continue;
                token += this._extractTokenFromNode(child);
            }
            return token;
        }

        for (const child of el.childNodes) token += this._extractTokenFromNode(child);
        return token;
    }
}

export const renderRichTextOntoSubtitles = (subtitles: RichSubtitleModel[], dictionaryTracks: DictionaryTrack[]) => {
    for (const s of subtitles) {
        if (s.tokenization && !s.richText) {
            s.richText = computeRichText(s.text, s.tokenization, dictionaryTracks[s.track]);
        }
    }
};

const computeRichText = (fullText: string, tokenization: Tokenization, dt: DictionaryTrack) => {
    if (!tokenization.tokens?.length) {
        return undefined;
    }

    return tokenization.tokens.map((token) => applyTokenStyle(fullText, token, dt)).join('');
};

const applyTokenStyle = (fullText: string, token: Token, dt: DictionaryTrack) => {
    const tokenText = applyReadingAnnotation(fullText, token, dt);
    if (token.status === undefined) return `<span style="text-decoration: line-through red 3px;">${tokenText}</span>`;
    if (!dt.dictionaryColorizeSubtitles) return tokenText;

    const s = HAS_LETTER_REGEX.test(tokenText)
        ? `<span class="${ASB_TOKEN_CLASS}${dt.dictionaryHighlightOnHover ? ` ${ASB_TOKEN_HIGHLIGHT_CLASS}` : ''}"`
        : '<span';
    if (!dt.dictionaryColorizeFullyKnownTokens && token.status === getFullyKnownTokenStatus())
        return `${s}>${tokenText}</span>`;
    const c = dt.dictionaryTokenStatusColors[token.status];
    const t = dt.dictionaryTokenStylingThickness;
    switch (dt.dictionaryTokenStyling) {
        case TokenStyling.TEXT:
            return `${s} style="-webkit-text-fill-color: ${c};">${tokenText}</span>`;
        case TokenStyling.BACKGROUND:
            return `${s} style="background-color: ${c};">${tokenText}</span>`;
        case TokenStyling.UNDERLINE:
        case TokenStyling.OVERLINE:
            return `${s} style="text-decoration: ${dt.dictionaryTokenStyling} ${c} ${t}px;">${tokenText}</span>`;
        case TokenStyling.OUTLINE:
            return `${s} style="-webkit-text-stroke: ${t}px ${c};">${tokenText}</span>`;
        default:
            return `${s} style="text-decoration: line-through red 3px double;">${tokenText}</span>`;
    }
};

const applyReadingAnnotation = (fullText: string, token: Token, dt: DictionaryTrack) => {
    const tokenText = fullText.substring(token.pos[0], token.pos[1]);
    if (!token.readings?.length || !HAS_LETTER_REGEX.test(tokenText) || ONLY_ASCII_LETTERS_REGEX.test(tokenText)) {
        return tokenText; // Prevent 。 -> まる or english words from getting ruby
    }
    const ignoredToken = token.states?.includes(TokenState.IGNORED);
    const ano = ignoredToken
        ? dt.dictionaryDisplayIgnoredTokenReadings
            ? TokenReadingAnnotation.ALWAYS
            : TokenReadingAnnotation.NEVER
        : dt.dictionaryTokenReadingAnnotation;
    if (ano === TokenReadingAnnotation.NEVER) return tokenText;
    if (token.status !== undefined) {
        if (
            (ano === TokenReadingAnnotation.LEARNING_OR_BELOW && token.status > TokenStatus.LEARNING) ||
            (ano === TokenReadingAnnotation.UNKNOWN_OR_BELOW && token.status > TokenStatus.UNKNOWN)
        ) {
            return tokenText;
        }
    }
    const parts: string[] = [];
    iterateOverStringInBlocks(
        tokenText,
        (_, blockIndex) => token.readings?.[blockIndex],
        (left, right, reading?: TokenReading) => {
            if (reading === undefined) {
                parts.push(tokenText.substring(left, right));
            } else {
                const word = tokenText.substring(reading.pos[0], reading.pos[1]);
                parts.push(`<ruby>${word}<rt>${reading.reading}</rt></ruby>`);
            }
        }
    );
    return parts.join('');
};
