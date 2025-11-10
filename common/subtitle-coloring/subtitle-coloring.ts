import { Fetcher, ColoredSubtitleModel } from '@project/common';
import { Anki } from '@project/common/anki';
import {
    AsbplayerSettings,
    DictionaryAnkiTreatSuspended,
    DictionaryTrack,
    TokenColor,
    TokenStyle,
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

    private anki: Anki | undefined;
    private yomitanTracks: (Yomitan | undefined)[];
    private readonly fetcher?: Fetcher;
    dictionaryTracks: (DictionaryTrack | undefined)[] | undefined;
    private tokenColorCache: Map<number, Map<string, TokenColor>>;
    private tokenizeCache: Map<number, Map<string, string[]>>;
    private lemmatizeCache: Map<number, Map<string, string[]>>;
    private erroredCache: Set<number>;
    private uncollectedCache: Set<number>;
    private uncollectedNeedsRefresh: boolean;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiLastRecentlyModifiedCheck: number;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private colorCacheBuildingCurrentIndex: number;
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
        this.fetcher = fetcher;
        this.subtitleColorsUpdated = subtitleColorsUpdated;
        this.getMediaTimeMs = getMediaTimeMs;
        this.subtitleCollection = new SubtitleCollection<ColoredSubtitleModel>(this._subtitles);
        this.showingNeedsRefreshCount = 0;
        this.tokenColorCache = new Map();
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
        this.erroredCache = new Set();
        this.uncollectedCache = new Set();
        this.uncollectedNeedsRefresh = false;
        this.ankiRecentlyModifiedCardIds = new Set<number>();
        this.ankiLastRecentlyModifiedCheck = Date.now();
        this.colorCacheLastRefresh = Date.now();
        this.colorCacheBuilding = false;
        this.colorCacheBuildingCurrentIndex = -1;
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
        this.settings = settings;
        this.anki = undefined;
        this.yomitanTracks = [];
        this.dictionaryTracks = undefined;
        this.tokenColorCache.clear();
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
        this.erroredCache.clear();
        this.uncollectedCache.clear();
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
        return dt && (dt.colorizeOnVideo || dt.colorizeOnApp);
    }

    private _tokenColorValid(tokenColor: TokenColor | undefined) {
        if (tokenColor === undefined) return false;
        if (tokenColor === TokenColor.ERROR) return false;
        if (tokenColor === TokenColor.UNCOLLECTED) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private _colorCacheValid(cachedColoredText: string | undefined, index: number) {
        if (cachedColoredText === undefined) return false;
        if (this.erroredCache.has(index)) return false;
        if (this.uncollectedCache.has(index)) return !this.uncollectedNeedsRefresh;
        return true;
    }

    private async _checkAnkiRecentlyModifiedCards() {
        if (!this.anki) return;
        if (!this.dictionaryTracks) return;
        const fields: Set<string> = new Set();
        for (const dt of this.dictionaryTracks) {
            if (!this._dictionaryTrackEnabled(dt)) continue;
            for (const field of [...dt!.dictionaryAnkiWordFields, ...dt!.dictionaryAnkiSentenceFields]) {
                fields.add(field);
            }
        }
        try {
            const cardIds: number[] = await this.anki.findRecentlyEditedCards(Array.from(fields), 1); // Don't care about rated:1 or suspended status
            if (
                cardIds.length === this.ankiRecentlyModifiedCardIds.size &&
                cardIds.every((cardId) => this.ankiRecentlyModifiedCardIds.has(cardId))
            ) {
                return;
            }
            this.uncollectedNeedsRefresh = true;
            this.ankiRecentlyModifiedCardIds = new Set(cardIds);
        } catch {
            console.error('Error checking Anki recently modified cards');
        }
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this._subtitles.length === 0) return;

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
                                s.index !== this.colorCacheBuildingCurrentIndex
                        )
                    ) {
                        this.shouldCancelBuild = true;
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
        if (!this.dictionaryTracks || this.dictionaryTracks.every((dt) => !this._dictionaryTrackEnabled(dt)))
            return true;
        if (this.colorCacheBuilding) return false;

        let uncollectedWasRefreshed = false;
        let buildWasCancelled = false;
        try {
            this.colorCacheBuilding = true;
            this.tokenRequestFailed = false;
            let anki: Anki | undefined = this.anki;
            if (!anki) {
                try {
                    anki = new Anki(this.settings, this.fetcher);
                    const permission = (await anki.requestPermission()).permission;
                    if (permission !== 'granted') throw new Error(`permission ${permission}`);
                    this.anki = anki;
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    anki = undefined;
                }
            }
            for (const [track, dt] of this.dictionaryTracks.entries()) {
                if (this.yomitanTracks[track]) continue;
                if (!this._dictionaryTrackEnabled(dt)) continue;
                if (!this.tokenColorCache.has(track)) this.tokenColorCache.set(track, new Map());
                if (!this.tokenizeCache.has(track)) this.tokenizeCache.set(track, new Map());
                if (!this.lemmatizeCache.has(track)) this.lemmatizeCache.set(track, new Map());
                try {
                    const yt = new Yomitan(dt!, this.fetcher);
                    await yt.version();
                    this.yomitanTracks[track] = yt;
                } catch (e) {
                    console.warn(`YomitanTrack${track + 1} version request failed:`, e);
                    this.yomitanTracks[track] = undefined;
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
                            this.colorCacheBuildingCurrentIndex = index;
                            if (this.shouldCancelBuild) return;
                            const dt = this.dictionaryTracks![track];
                            if (!this._dictionaryTrackEnabled(dt)) return;
                            const cachedColoredText =
                                this._subtitles[index].coloredVideoText ?? this._subtitles[index].coloredAppText;
                            if (this._colorCacheValid(cachedColoredText, index)) return;
                            const { coloredVideoText, coloredAppText } = await this._colorizeText(
                                text,
                                track,
                                index,
                                anki,
                                dt!
                            );
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
                this.anki = undefined;
                this.yomitanTracks = [];
                this.tokenRequestFailed = false;
            }
            this.colorCacheBuilding = false;
            this.colorCacheBuildingCurrentIndex = -1;
            this.shouldCancelBuild = false;
            if (uncollectedWasRefreshed) this.uncollectedNeedsRefresh = false; // Don't reset if it became true during processing
        }
        return !buildWasCancelled;
    }

    private async _colorizeText(
        text: string,
        track: number,
        index: number,
        anki: Anki | undefined,
        dt: DictionaryTrack
    ): Promise<{ coloredVideoText?: string; coloredAppText?: string }> {
        try {
            const yt = this.yomitanTracks[track];
            if (!anki || !yt) {
                this.erroredCache.add(index);
                return {
                    coloredVideoText: dt.colorizeOnVideo
                        ? this._applyTokenStyle(text, TokenColor.ERROR, dt, true)
                        : undefined,
                    coloredAppText: dt.colorizeOnApp
                        ? this._applyTokenStyle(text, TokenColor.ERROR, dt, false)
                        : undefined,
                };
            }
            if (!dt.dictionaryAnkiWordFields.length && !dt.dictionaryAnkiSentenceFields.length) {
                throw new Error('No Anki fields defined');
            }

            let coloredVideoText: string = '';
            let coloredAppText: string = '';
            let textHasError = false;
            let textHasUncollected = false;
            let rawTokens = this.tokenizeCache.get(track)!.get(text);
            if (!rawTokens) {
                rawTokens = await yt.tokenize(text);
                this.tokenizeCache.get(track)!.set(text, rawTokens);
                if (this.shouldCancelBuild) return {};
            }
            for (const rawToken of rawTokens) {
                const trimmedToken = rawToken.trim();

                // Token is already cached or not a word
                const cachedTokenColor = this.tokenColorCache.get(track)!.get(trimmedToken);
                if (this._tokenColorValid(cachedTokenColor)) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, cachedTokenColor!, dt, true);
                    if (dt.colorizeOnApp)
                        coloredAppText += this._applyTokenStyle(rawToken, cachedTokenColor!, dt, false);
                    if (cachedTokenColor === TokenColor.ERROR) textHasError = true;
                    else if (cachedTokenColor === TokenColor.UNCOLLECTED) textHasUncollected = true;
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, TokenColor.MATURE, dt, true);
                    if (dt.colorizeOnApp)
                        coloredAppText += this._applyTokenStyle(rawToken, TokenColor.MATURE, dt, false);
                    this.tokenColorCache.get(track)!.set(trimmedToken, TokenColor.MATURE);
                    continue;
                }

                // Check if this possibly inflected token is collected
                const tokenWordFieldColor = await this._getWordFieldColor(trimmedToken, track, anki, dt);
                if (this.shouldCancelBuild) return {};
                if (tokenWordFieldColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, tokenWordFieldColor, dt, true);
                    if (dt.colorizeOnApp)
                        coloredAppText += this._applyTokenStyle(rawToken, tokenWordFieldColor, dt, false);
                    if (tokenWordFieldColor === TokenColor.ERROR) textHasError = true;
                    this.tokenColorCache.get(track)!.set(trimmedToken, tokenWordFieldColor);
                    continue;
                }

                // Check if this token's lemma is collected
                const lemmaWordColor = await this._handleLemmatize(
                    trimmedToken,
                    track,
                    dt,
                    yt,
                    !dt.dictionaryAnkiSentenceFields.length,
                    (t) => this._getWordFieldColor(t, track, anki, dt)
                );
                if (this.shouldCancelBuild) return {};
                if (lemmaWordColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, lemmaWordColor, dt, true);
                    if (dt.colorizeOnApp) coloredAppText += this._applyTokenStyle(rawToken, lemmaWordColor, dt, false);
                    if (lemmaWordColor === TokenColor.ERROR) textHasError = true;
                    this.tokenColorCache.get(track)!.set(trimmedToken, lemmaWordColor);
                    continue;
                }

                // Check if this possibly inflected token is collected in sentence fields
                const tokenSentenceFieldColor = await this._getSentenceFieldColor(trimmedToken, track, anki, dt, yt);
                if (this.shouldCancelBuild) return {};
                if (tokenSentenceFieldColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, tokenSentenceFieldColor, dt, true);
                    if (dt.colorizeOnApp)
                        coloredAppText += this._applyTokenStyle(rawToken, tokenSentenceFieldColor, dt, false);
                    if (tokenSentenceFieldColor === TokenColor.ERROR) textHasError = true;
                    this.tokenColorCache.get(track)!.set(trimmedToken, tokenSentenceFieldColor);
                    continue;
                }

                // Check if this token's lemma is collected in sentence fields
                const lemmaSentenceColor = await this._handleLemmatize(trimmedToken, track, dt, yt, true, (t) =>
                    this._getSentenceFieldColor(t, track, anki, dt, yt)
                );
                if (this.shouldCancelBuild) return {};
                if (lemmaSentenceColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        coloredVideoText += this._applyTokenStyle(rawToken, lemmaSentenceColor, dt, true);
                    if (dt.colorizeOnApp)
                        coloredAppText += this._applyTokenStyle(rawToken, lemmaSentenceColor, dt, false);
                    if (lemmaSentenceColor === TokenColor.ERROR) textHasError = true;
                    this.tokenColorCache.get(track)!.set(trimmedToken, lemmaSentenceColor);
                    continue;
                }

                // Token is uncollected
                if (dt.colorizeOnVideo)
                    coloredVideoText += this._applyTokenStyle(rawToken, TokenColor.UNCOLLECTED, dt, true);
                if (dt.colorizeOnApp)
                    coloredAppText += this._applyTokenStyle(rawToken, TokenColor.UNCOLLECTED, dt, false);
                textHasUncollected = true;
                this.tokenColorCache.get(track)!.set(trimmedToken, TokenColor.UNCOLLECTED);
            }

            textHasError ? this.erroredCache.add(index) : this.erroredCache.delete(index);
            textHasUncollected ? this.uncollectedCache.add(index) : this.uncollectedCache.delete(index);
            return {
                coloredVideoText: dt.colorizeOnVideo ? coloredVideoText : undefined,
                coloredAppText: dt.colorizeOnApp ? coloredAppText : undefined,
            };
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error colorizing subtitle text for Track${track}:`, error);
            this.erroredCache.add(index);
            return {
                coloredVideoText: dt.colorizeOnVideo
                    ? this._applyTokenStyle(text, TokenColor.ERROR, dt, true)
                    : undefined,
                coloredAppText: dt.colorizeOnApp ? this._applyTokenStyle(text, TokenColor.ERROR, dt, false) : undefined,
            };
        }
    }

    private async _handleLemmatize(
        token: string,
        track: number,
        dt: DictionaryTrack,
        yt: Yomitan,
        cacheUncollected: boolean,
        getFieldColor: (token: string) => Promise<TokenColor>
    ): Promise<TokenColor> {
        if (!dt.dictionarySubtitleLemmatization) return TokenColor.UNCOLLECTED;

        let tokenLemmas = this.lemmatizeCache.get(track)!.get(token);
        if (!tokenLemmas) {
            tokenLemmas = await yt.lemmatize(token);
            this.lemmatizeCache.get(track)!.set(token, tokenLemmas);
            if (this.shouldCancelBuild) return TokenColor.ERROR;
        }
        for (const tokenLemma of tokenLemmas) {
            const cachedTokenLemma = this.tokenColorCache.get(track)!.get(tokenLemma);
            if (this._tokenColorValid(cachedTokenLemma)) return cachedTokenLemma!;
            const tokenColor = await getFieldColor(tokenLemma);
            if (tokenColor !== TokenColor.UNCOLLECTED) {
                this.tokenColorCache.get(track)!.set(tokenLemma, tokenColor);
                return tokenColor;
            }
            if (this.shouldCancelBuild) return TokenColor.ERROR;
            if (cacheUncollected) {
                this.tokenColorCache.get(track)!.set(tokenLemma, TokenColor.UNCOLLECTED);
            }
        }
        return TokenColor.UNCOLLECTED;
    }

    private async _getWordFieldColor(
        token: string,
        track: number,
        anki: Anki,
        dt: DictionaryTrack
    ): Promise<TokenColor> {
        try {
            let cardIds = await anki.findCardsWithWord(token, dt.dictionaryAnkiWordFields);
            if (!cardIds.length) return TokenColor.UNCOLLECTED;
            if (this.shouldCancelBuild) return TokenColor.ERROR;
            const suspendedResult = await this._handleSuspended(cardIds, anki, dt);
            if (suspendedResult) return suspendedResult;
            if (this.shouldCancelBuild) return TokenColor.ERROR;
            const intervals = await anki.currentIntervals(cardIds);
            return this._getTokenColorFromIntervals(token, track, intervals, cardIds, dt);
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color for Track${track} using word fields for token "${token}":`, error);
            return TokenColor.ERROR;
        }
    }

    private async _getSentenceFieldColor(
        token: string,
        track: number,
        anki: Anki,
        dt: DictionaryTrack,
        yt: Yomitan
    ): Promise<TokenColor> {
        try {
            const cardIds = await anki.findCardsContainingWord(token, dt.dictionaryAnkiSentenceFields);
            if (!cardIds.length) return TokenColor.UNCOLLECTED;
            if (this.shouldCancelBuild) return TokenColor.ERROR;
            const rawCardInfos = await anki.cardsInfo(cardIds);
            if (!rawCardInfos.length) return TokenColor.ERROR;
            if (this.shouldCancelBuild) return TokenColor.ERROR;

            // Tokenize the sentence field and filter cards that actually contain the token
            const validCardInfos = await filterAsync(
                rawCardInfos,
                async (cardInfo: any) => {
                    for (const sentenceField of dt.dictionaryAnkiSentenceFields) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        let fieldTokens = this.tokenizeCache.get(track)!.get(field.value);
                        if (!fieldTokens) {
                            fieldTokens = (await yt.tokenize(field.value)).map((t) => t.trim());
                            this.tokenizeCache.get(track)!.set(field.value, fieldTokens);
                            if (this.shouldCancelBuild) return false;
                        }
                        if (fieldTokens.includes(token)) return true;
                        if (!dt.dictionarySubtitleLemmatization) continue;
                        for (const fieldToken of fieldTokens) {
                            let fieldTokenLemmas = this.lemmatizeCache.get(track)!.get(fieldToken);
                            if (!fieldTokenLemmas) {
                                fieldTokenLemmas = await yt.lemmatize(fieldToken);
                                this.lemmatizeCache.get(track)!.set(fieldToken, fieldTokenLemmas);
                                if (this.shouldCancelBuild) return false;
                            }
                            if (fieldTokenLemmas.includes(token)) return true;
                        }
                    }
                    return false;
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (this.shouldCancelBuild) return TokenColor.ERROR;
            if (!validCardInfos.length) return TokenColor.UNCOLLECTED;

            const suspendedResult = await this._handleSuspended(
                validCardInfos.map((c) => c.cardId),
                anki,
                dt
            );
            if (suspendedResult) return suspendedResult;
            return this._getTokenColorFromIntervals(
                token,
                track,
                validCardInfos.map((cardInfo) => cardInfo.interval),
                validCardInfos.map((cardInfo) => cardInfo.cardId),
                dt
            );
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color for Track${track} using sentence fields for token "${token}":`, error);
            return TokenColor.ERROR;
        }
    }

    private _getTokenColorFromIntervals(
        token: string,
        track: number,
        intervals: number[],
        cardIds: number[],
        dt: DictionaryTrack
    ): TokenColor {
        if (!intervals.length) {
            console.error(`No intervals found for Track${track} for token "${token}" with card IDs:`, cardIds);
            return TokenColor.ERROR;
        }
        if (intervals.every((i) => i >= dt.dictionaryAnkiMatureInterval)) return TokenColor.MATURE;
        if (intervals.every((i) => i === 0)) return TokenColor.UNKNOWN;
        return TokenColor.YOUNG; // If < dt.dictionaryAnkiMatureInterval && !== 0 or mixed intervals
    }

    private _applyTokenStyle(token: string, color: TokenColor, dt: DictionaryTrack, forVideo: boolean): string {
        let tokenStyle = forVideo ? dt.dictionaryVideoTokenStyle : dt.dictionaryAppTokenStyle;
        tokenStyle = color === TokenColor.ERROR && tokenStyle === TokenStyle.TEXT ? TokenStyle.UNDERLINE : tokenStyle;
        switch (tokenStyle) {
            case TokenStyle.TEXT:
                return `<span style="color: ${color};">${token}</span>`;
            case TokenStyle.UNDERLINE:
                if (color === TokenColor.MATURE) return token;
                return `<span style="text-decoration: underline ${color} ${color === TokenColor.ERROR ? 'double' : 'solid'};">${token}</span>`;
            case TokenStyle.OVERLINE:
                if (color === TokenColor.MATURE) return token;
                return `<span style="text-decoration: overline ${color};">${token}</span>`;
            default:
                return token;
        }
    }

    private async _handleSuspended(cardIds: number[], anki: Anki, dt: DictionaryTrack): Promise<TokenColor | null> {
        if (dt.dictionaryAnkiTreatSuspended === DictionaryAnkiTreatSuspended.NORMAL) return null;
        if (!(await anki.areSuspended(cardIds)).every((s) => s)) return null;
        switch (dt.dictionaryAnkiTreatSuspended) {
            case DictionaryAnkiTreatSuspended.MATURE:
                return TokenColor.MATURE;
            case DictionaryAnkiTreatSuspended.YOUNG:
                return TokenColor.YOUNG;
            case DictionaryAnkiTreatSuspended.UNKNOWN:
                return TokenColor.UNKNOWN;
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
