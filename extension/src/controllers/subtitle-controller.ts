import {
    AutoPauseContext,
    CopyToClipboardMessage,
    EventColorCache,
    Fetcher,
    HttpPostMessage,
    OffsetFromVideoMessage,
    SubtitleColorsUpdatedFromVideoMessage,
    SubtitleModel,
    SubtitleHtml,
    VideoToExtensionCommand,
} from '@project/common';
import { Anki } from '@project/common/anki';
import {
    DictionaryAnkiTreatSuspended,
    DictionaryTrack,
    SettingsProvider,
    SubtitleAlignment,
    SubtitleSettings,
    TextSubtitleSettings,
    TokenColor,
    TokenStyle,
    allTextSubtitleSettings,
} from '@project/common/settings';
import { SubtitleCollection, SubtitleSlice } from '@project/common/subtitle-collection';
import { computeStyleString, filterAsync, inBatches, surroundingSubtitles } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';
import i18n from 'i18next';
import {
    CachingElementOverlay,
    ElementOverlay,
    ElementOverlayParams,
    KeyedHtml,
    OffsetAnchor,
} from '../services/element-overlay';
import { v4 as uuidv4 } from 'uuid';

const BOUNDING_BOX_PADDING = 25;
const TOKEN_CACHE_BUILD_AHEAD = 10;
const TOKEN_CACHE_BATCH_SIZE = 1;
const TOKEN_CACHE_ERROR_REFRESH_INTERVAL = 10000;
const ANKI_RECENTLY_MODIFIED_INTERVAL = 10000;
const HAS_LETTER_REGEX = /\p{L}/u;

const _intersects = (clientX: number, clientY: number, element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return (
        clientX >= rect.x - BOUNDING_BOX_PADDING &&
        clientX <= rect.x + rect.width + BOUNDING_BOX_PADDING &&
        clientY >= rect.y - BOUNDING_BOX_PADDING &&
        clientY <= rect.y + rect.height + BOUNDING_BOX_PADDING
    );
};

export interface SubtitleModelWithIndex extends SubtitleModel {
    index: number;
}

type TokenColorCache = Map<number, Map<string, TokenColor>>;

class VideoFetcher implements Fetcher {
    private readonly videoSrcCB: () => string;

    constructor(videoSrcCB: () => string) {
        this.videoSrcCB = videoSrcCB;
    }

    fetch(url: string, body: any) {
        const httpPostCommand: VideoToExtensionCommand<HttpPostMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'http-post',
                url,
                body,
                messageId: uuidv4(),
            },
            src: this.videoSrcCB(),
        };
        return browser.runtime.sendMessage(httpPostCommand);
    }
}

export default class SubtitleController {
    private readonly video: HTMLMediaElement;
    private readonly settings: SettingsProvider;
    private readonly videoFetcher: VideoFetcher;
    private anki: Anki | undefined;
    private yomitanTracks: (Yomitan | undefined)[];

    private showingSubtitles?: SubtitleModelWithIndex[];
    private lastLoadedMessageTimestamp: number;
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingLoadedMessage: boolean;
    private subtitleSettings?: SubtitleSettings;
    private subtitleStyles?: string[];
    private subtitleClasses?: string[];
    private notificationElementOverlayHideTimeout?: NodeJS.Timeout;
    private _subtitles: SubtitleModelWithIndex[];
    private subtitleCollection: SubtitleCollection<SubtitleModelWithIndex>;
    private bottomSubtitlesElementOverlay: ElementOverlay;
    private topSubtitlesElementOverlay: ElementOverlay;
    private notificationElementOverlay: ElementOverlay;
    private shouldRenderBottomOverlay: boolean;
    private shouldRenderTopOverlay: boolean;
    private subtitleTrackAlignments: { [key: number]: SubtitleAlignment | undefined };
    private unblurredSubtitleTracks: { [key: number]: boolean | undefined };
    disabledSubtitleTracks: { [key: number]: boolean | undefined };
    subtitleFileNames?: string[];
    _forceHideSubtitles: boolean;
    _displaySubtitles: boolean;
    surroundingSubtitlesCountRadius: number;
    surroundingSubtitlesTimeRadius: number;
    autoCopyCurrentSubtitle: boolean;
    convertNetflixRuby: boolean;
    subtitleHtml: SubtitleHtml;
    _preCacheDom;

    dictionaryTracks: (DictionaryTrack | undefined)[] | undefined;
    videoColorCache: EventColorCache;
    appColorCache: EventColorCache;
    private tokenColorCache: TokenColorCache;
    private tokenizeCache: Map<number, Map<string, string[]>>;
    private lemmatizeCache: Map<number, Map<string, string[]>>;
    private erroredCache: Map<number, Set<number>>;
    private uncollectedCache: Map<number, Set<number>>;
    private newTokenInShowingSubtitles: boolean;
    private uncollectedNeedsRefresh: boolean;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiLastRecentlyModifiedCheck: number;
    private colorCacheLastRefresh: number;
    private colorCacheBuilding: boolean;
    private tokenRequestFailed: boolean;

    readonly autoPauseContext: AutoPauseContext = new AutoPauseContext();

    onNextToShow?: (subtitle: SubtitleModel) => void;
    onSlice?: (subtitle: SubtitleSlice<SubtitleModelWithIndex>) => void;
    onOffsetChange?: () => void;
    onMouseOver?: (event: MouseEvent) => void;

    constructor(video: HTMLMediaElement, settings: SettingsProvider) {
        this.video = video;
        this.settings = settings;
        this.yomitanTracks = [];
        this.videoFetcher = new VideoFetcher(() => this.video.src);
        this._preCacheDom = false;
        this._subtitles = [];
        this.subtitleCollection = new SubtitleCollection<SubtitleModelWithIndex>([]);
        this.showingSubtitles = [];
        this.shouldRenderBottomOverlay = true;
        this.shouldRenderTopOverlay = false;
        this.unblurredSubtitleTracks = {};
        this.disabledSubtitleTracks = {};
        this.subtitleTrackAlignments = { 0: 'bottom' };
        this._forceHideSubtitles = false;
        this._displaySubtitles = true;
        this.lastLoadedMessageTimestamp = 0;
        this.lastOffsetChangeTimestamp = 0;
        this.showingOffset = undefined;
        this.surroundingSubtitlesCountRadius = 1;
        this.surroundingSubtitlesTimeRadius = 5000;
        this.showingLoadedMessage = false;
        this.autoCopyCurrentSubtitle = false;
        this.convertNetflixRuby = false;
        this.subtitleHtml = SubtitleHtml.remove;
        const { subtitlesElementOverlay, topSubtitlesElementOverlay, notificationElementOverlay } = this._overlays();
        this.bottomSubtitlesElementOverlay = subtitlesElementOverlay;
        this.topSubtitlesElementOverlay = topSubtitlesElementOverlay;
        this.notificationElementOverlay = notificationElementOverlay;
        this.videoColorCache = {};
        this.appColorCache = {};
        this.tokenColorCache = new Map();
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
        this.erroredCache = new Map();
        this.uncollectedCache = new Map();
        this.newTokenInShowingSubtitles = false;
        this.uncollectedNeedsRefresh = false;
        this.ankiRecentlyModifiedCardIds = new Set<number>();
        this.ankiLastRecentlyModifiedCheck = Date.now();
        this.colorCacheLastRefresh = Date.now();
        this.colorCacheBuilding = false;
        this.tokenRequestFailed = false;
    }

    get subtitles() {
        return this._subtitles;
    }

    set subtitles(subtitles) {
        this._subtitles = subtitles;
        this.subtitleCollection = new SubtitleCollection(subtitles, {
            showingCheckRadiusMs: 150,
            returnNextToShow: true,
        });
        this.autoPauseContext.clear();
        this._clearColorCaches();
        this._initColorCache();
    }

    reset() {
        this.subtitles = [];
        this.subtitleFileNames = undefined;
        this.cacheHtml();
        this._clearColorCaches();
    }

    cacheHtml() {
        const htmls = this._buildSubtitlesHtml(this.subtitles);

        if (this.shouldRenderBottomOverlay && this.bottomSubtitlesElementOverlay instanceof CachingElementOverlay) {
            this.bottomSubtitlesElementOverlay.uncacheHtml();
            for (const html of htmls) {
                this.bottomSubtitlesElementOverlay.cacheHtml(html.key, html.html());
            }
        }
        if (this.shouldRenderTopOverlay && this.topSubtitlesElementOverlay instanceof CachingElementOverlay) {
            this.topSubtitlesElementOverlay.uncacheHtml();
            for (const html of htmls) {
                this.topSubtitlesElementOverlay.cacheHtml(html.key, html.html());
            }
        }
    }

    get bottomSubtitlePositionOffset(): number {
        return this.bottomSubtitlesElementOverlay.contentPositionOffset;
    }

    set bottomSubtitlePositionOffset(value: number) {
        this.bottomSubtitlesElementOverlay.contentPositionOffset = value;
    }

    get topSubtitlePositionOffset(): number {
        return this.topSubtitlesElementOverlay.contentPositionOffset;
    }

    set topSubtitlePositionOffset(value: number) {
        this.topSubtitlesElementOverlay.contentPositionOffset = value;
    }

    set subtitlesWidth(value: number) {
        this.bottomSubtitlesElementOverlay.contentWidthPercentage = value;
        this.topSubtitlesElementOverlay.contentWidthPercentage = value;
    }

    setSubtitleSettings(newSubtitleSettings: SubtitleSettings) {
        const styles = this._computeStyles(newSubtitleSettings);
        const classes = this._computeClasses(newSubtitleSettings);
        if (
            this.subtitleStyles === undefined ||
            !this._arrayEquals(styles, this.subtitleStyles, (a, b) => a === b) ||
            this.subtitleClasses === undefined ||
            !this._arrayEquals(classes, this.subtitleClasses, (a, b) => a === b)
        ) {
            this.subtitleStyles = styles;
            this.subtitleClasses = classes;
            this.cacheHtml();
        }

        const newAlignments = allTextSubtitleSettings(newSubtitleSettings).map((s) => s.subtitleAlignment);
        if (!this._arrayEquals(newAlignments, Object.values(this.subtitleTrackAlignments), (a, b) => a === b)) {
            this.subtitleTrackAlignments = newAlignments;
            this.shouldRenderBottomOverlay = Object.values(this.subtitleTrackAlignments).includes(
                'bottom' as SubtitleAlignment
            );
            this.shouldRenderTopOverlay = Object.values(this.subtitleTrackAlignments).includes(
                'top' as SubtitleAlignment
            );
            const { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams } =
                this._elementOverlayParams();
            this._applyElementOverlayParams(this.bottomSubtitlesElementOverlay, subtitleOverlayParams);
            this._applyElementOverlayParams(this.topSubtitlesElementOverlay, topSubtitleOverlayParams);
            this._applyElementOverlayParams(this.notificationElementOverlay, notificationOverlayParams);
            this.bottomSubtitlesElementOverlay.hide();
            this.topSubtitlesElementOverlay.hide();
            this.notificationElementOverlay.hide();
        }

        this.unblurredSubtitleTracks = {};

        this.subtitleSettings = newSubtitleSettings;
    }

    private _computeStyles(settings: SubtitleSettings) {
        return allTextSubtitleSettings(settings).map((s) => computeStyleString(s));
    }

    private _computeClasses(settings: SubtitleSettings) {
        return allTextSubtitleSettings(settings).map((s) => this._computeClassesForTrack(s));
    }

    private _computeClassesForTrack(settings: TextSubtitleSettings) {
        return settings.subtitleBlur ? 'asbplayer-subtitles-blurred' : '';
    }

    private _getSubtitleTrackAlignment(trackIndex: number) {
        return this.subtitleTrackAlignments[trackIndex] || this.subtitleTrackAlignments[0];
    }

    private _applyElementOverlayParams(overlay: ElementOverlay, params: ElementOverlayParams) {
        overlay.offsetAnchor = params.offsetAnchor;
        overlay.fullscreenContainerClassName = params.fullscreenContainerClassName;
        overlay.fullscreenContentClassName = params.fullscreenContentClassName;
        overlay.nonFullscreenContainerClassName = params.nonFullscreenContainerClassName;
        overlay.nonFullscreenContentClassName = params.nonFullscreenContentClassName;
    }

    set displaySubtitles(displaySubtitles: boolean) {
        this._displaySubtitles = displaySubtitles;
        this.showingSubtitles = undefined;
    }

    set forceHideSubtitles(forceHideSubtitles: boolean) {
        this._forceHideSubtitles = forceHideSubtitles;
        this.showingSubtitles = undefined;
    }

    ankiCardWasUpdated() {
        this.uncollectedNeedsRefresh = true;
    }

    private _overlays() {
        const { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams } =
            this._elementOverlayParams();

        return {
            subtitlesElementOverlay: new CachingElementOverlay(subtitleOverlayParams),
            topSubtitlesElementOverlay: new CachingElementOverlay(topSubtitleOverlayParams),
            notificationElementOverlay: new CachingElementOverlay(notificationOverlayParams),
        };
    }

    private _elementOverlayParams() {
        const subtitleOverlayParams: ElementOverlayParams = {
            targetElement: this.video,
            nonFullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
            nonFullscreenContentClassName: 'asbplayer-subtitles',
            fullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
            fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
            offsetAnchor: OffsetAnchor.bottom,
            contentWidthPercentage: -1,
            onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
        };
        const topSubtitleOverlayParams: ElementOverlayParams = {
            targetElement: this.video,
            nonFullscreenContainerClassName: 'asbplayer-subtitles-container-top',
            nonFullscreenContentClassName: 'asbplayer-subtitles',
            fullscreenContainerClassName: 'asbplayer-subtitles-container-top',
            fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
            offsetAnchor: OffsetAnchor.top,
            contentWidthPercentage: -1,
            onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
        };
        const notificationOverlayParams: ElementOverlayParams =
            this._getSubtitleTrackAlignment(0) === 'bottom'
                ? {
                      targetElement: this.video,
                      nonFullscreenContainerClassName: 'asbplayer-notification-container-top',
                      nonFullscreenContentClassName: 'asbplayer-notification',
                      fullscreenContainerClassName: 'asbplayer-notification-container-top',
                      fullscreenContentClassName: 'asbplayer-notification',
                      offsetAnchor: OffsetAnchor.top,
                      contentWidthPercentage: -1,
                      onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
                  }
                : {
                      targetElement: this.video,
                      nonFullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                      nonFullscreenContentClassName: 'asbplayer-notification',
                      fullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                      fullscreenContentClassName: 'asbplayer-notification',
                      offsetAnchor: OffsetAnchor.bottom,
                      contentWidthPercentage: -1,
                      onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
                  };

        return { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams };
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this.lastLoadedMessageTimestamp > 0 && Date.now() - this.lastLoadedMessageTimestamp < 1000) {
                return;
            }

            if (this.showingLoadedMessage) {
                this._setSubtitlesHtml(this.bottomSubtitlesElementOverlay, [{ html: () => '' }]);
                this._setSubtitlesHtml(this.topSubtitlesElementOverlay, [{ html: () => '' }]);
                this.showingLoadedMessage = false;
            }

            if (this.subtitles.length === 0) {
                return;
            }

            const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;
            const offset = showOffset ? this._computeOffset() : 0;
            const slice = this.subtitleCollection.subtitlesAt(this.video.currentTime * 1000);
            const showingSubtitles = this._findShowingSubtitles(slice);

            this.onSlice?.(slice);

            if (slice.willStopShowing && this._trackEnabled(slice.willStopShowing)) {
                this.autoPauseContext.willStopShowing(slice.willStopShowing);
            }

            if (slice.startedShowing && this._trackEnabled(slice.startedShowing)) {
                this.autoPauseContext.startedShowing(slice.startedShowing);
            }

            if (slice.nextToShow && slice.nextToShow.length > 0) {
                this.onNextToShow?.(slice.nextToShow[0]);
            }

            const subtitlesAreNew =
                this.showingSubtitles === undefined ||
                !this._arrayEquals(showingSubtitles, this.showingSubtitles, (a, b) => a.index === b.index);

            if (subtitlesAreNew) {
                this.showingSubtitles = showingSubtitles;
                this._autoCopyToClipboard(showingSubtitles);
                const { colorBufferStartIndex, colorBufferEndIndex } = this.getColorBufferIndexes(showingSubtitles);
                this._buildColorCache(this.subtitles.slice(colorBufferStartIndex, colorBufferEndIndex));
                this.colorCacheLastRefresh = Date.now();
            } else {
                if (Date.now() - this.colorCacheLastRefresh >= TOKEN_CACHE_ERROR_REFRESH_INTERVAL) {
                    this._initColorCache(); // Update when user collects a token or Anki opened after asbplayer
                    this.colorCacheLastRefresh = Date.now();
                }
                if (Date.now() - this.ankiLastRecentlyModifiedCheck >= ANKI_RECENTLY_MODIFIED_INTERVAL) {
                    this._checkAnkiRecentlyModifiedCards();
                    this.ankiLastRecentlyModifiedCheck = Date.now();
                }
            }

            const shouldRenderOffset =
                (showOffset && offset !== this.showingOffset) || (!showOffset && this.showingOffset !== undefined);

            if ((!showOffset && !this._displaySubtitles) || this._forceHideSubtitles) {
                this.bottomSubtitlesElementOverlay.hide();
                this.topSubtitlesElementOverlay.hide();
            } else if (
                subtitlesAreNew ||
                shouldRenderOffset ||
                this.newTokenInShowingSubtitles ||
                this.uncollectedNeedsRefresh
            ) {
                this.newTokenInShowingSubtitles = false;
                this._resetUnblurState();
                if (this.shouldRenderBottomOverlay) {
                    const showingSubtitlesBottom = showingSubtitles.filter(
                        (s) => this._getSubtitleTrackAlignment(s.track) === 'bottom'
                    );
                    this._renderSubtitles(showingSubtitlesBottom, OffsetAnchor.bottom);
                }
                if (this.shouldRenderTopOverlay) {
                    const showingSubtitlesTop = showingSubtitles.filter(
                        (s) => this._getSubtitleTrackAlignment(s.track) === 'top'
                    );
                    this._renderSubtitles(showingSubtitlesTop, OffsetAnchor.top);
                }

                if (showOffset) {
                    this._appendSubtitlesHtml(this._buildTextHtml(this._formatOffset(offset)));
                    this.showingOffset = offset;
                } else {
                    this.showingOffset = undefined;
                }
            }
        }, 100);
    }

    private _renderSubtitles(subtitles: SubtitleModelWithIndex[], offset: OffsetAnchor) {
        if (offset == OffsetAnchor.top) {
            this._setSubtitlesHtml(this.topSubtitlesElementOverlay, this._buildSubtitlesHtml(subtitles));
        } else {
            this._setSubtitlesHtml(this.bottomSubtitlesElementOverlay, this._buildSubtitlesHtml(subtitles));
        }
    }

    private _resetUnblurState() {
        if (Object.keys(this.unblurredSubtitleTracks).length === 0) {
            return;
        }

        for (const element of [
            ...this.bottomSubtitlesElementOverlay.displayingElements(),
            ...this.topSubtitlesElementOverlay.displayingElements(),
        ]) {
            const track = Number(element.dataset.track);

            if (this.unblurredSubtitleTracks[track] === true) {
                element.classList.add('asbplayer-subtitles-blurred');
            }
        }

        this.unblurredSubtitleTracks = {};
    }

    private _autoCopyToClipboard(subtitles: SubtitleModel[]) {
        if (this.autoCopyCurrentSubtitle && subtitles.length > 0 && document.hasFocus()) {
            const text = subtitles
                .map((s) => s.text)
                .filter((text) => text !== '')
                .join('\n');

            if (text !== '') {
                const command: VideoToExtensionCommand<CopyToClipboardMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'copy-to-clipboard',
                        dataUrl: `data:,${encodeURIComponent(text)}`,
                    },
                    src: this.video.src,
                };

                browser.runtime.sendMessage(command);
            }
        }
    }

    private _findShowingSubtitles(slice: SubtitleSlice<SubtitleModelWithIndex>): SubtitleModelWithIndex[] {
        return slice.showing.filter((s) => this._trackEnabled(s)).sort((s1, s2) => s1.track - s2.track);
    }

    private _findNextToShowSubtitles(slice: SubtitleSlice<SubtitleModelWithIndex>): SubtitleModelWithIndex[] {
        return slice.nextToShow?.filter((s) => this._trackEnabled(s)).sort((s1, s2) => s1.track - s2.track) ?? [];
    }

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
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

    private _colorCacheValid(cachedColoredText: string | undefined, track: number, index: number) {
        if (cachedColoredText === undefined) return false;
        if (this.erroredCache.get(track)?.has(index)) return false;
        if (this.uncollectedCache.get(track)?.has(index)) return !this.uncollectedNeedsRefresh;
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

    private _buildSubtitlesHtml(subtitles: SubtitleModelWithIndex[]) {
        return subtitles.map((subtitle) => {
            return {
                html: () => {
                    if (subtitle.textImage) {
                        const className = this.subtitleClasses?.[subtitle.track] ?? '';
                        const imageScale =
                            ((this.subtitleSettings?.imageBasedSubtitleScaleFactor ?? 1) *
                                this.video.getBoundingClientRect().width) /
                            subtitle.textImage.screen.width;
                        const width = imageScale * subtitle.textImage.image.width;

                        return `
                            <div data-track="${
                                subtitle.track ?? 0
                            }" style="max-width:${width}px;margin:auto;" class="${className}"}">
                                <img
                                    style="width:100%;"
                                    alt="subtitle"
                                    src="${subtitle.textImage.dataUrl}"
                                />
                            </div>
                        `;
                    } else {
                        return this._buildTextHtml(subtitle.text, subtitle.track, subtitle.index);
                    }
                },
                key: String(subtitle.index),
            };
        });
    }

    private _buildTextHtml(text: string, track?: number, index?: number) {
        const trackNum = track ?? 0;
        const maybeColoredText = this.dictionaryTracks?.[trackNum]?.colorizeOnVideo
            ? (this.videoColorCache[trackNum]?.[index ?? -1] ?? text)
            : text;
        return `<span data-track="${trackNum}" class="${this._subtitleClasses(track)}" style="${this._subtitleStyles(
            track
        )}">${maybeColoredText}</span>`;
    }

    getColorBufferIndexes(subtitles?: SubtitleModelWithIndex[]) {
        if (!subtitles) {
            const slice = this.subtitleCollection.subtitlesAt(this.video.currentTime * 1000);
            subtitles = this._findShowingSubtitles(slice);
            if (!subtitles.length) subtitles = this._findNextToShowSubtitles(slice);
        }
        if (!subtitles.length) return { colorBufferStartIndex: 0, colorBufferEndIndex: TOKEN_CACHE_BUILD_AHEAD };
        const colorBufferStartIndex = Math.min(...subtitles.map((s) => s.index));
        const colorBufferEndIndex = Math.max(...subtitles.map((s) => s.index)) + 1 + TOKEN_CACHE_BUILD_AHEAD;
        return { colorBufferStartIndex, colorBufferEndIndex };
    }

    private async _initColorCache() {
        const { colorBufferStartIndex, colorBufferEndIndex } = this.getColorBufferIndexes();
        return await this._buildColorCache(this.subtitles.slice(colorBufferStartIndex, colorBufferEndIndex));
    }

    private async _buildColorCache(subtitles: SubtitleModelWithIndex[]) {
        if (!subtitles.length) return;
        if (!this.dictionaryTracks) this.dictionaryTracks = await this.settings.getSingle('dictionaryTracks');
        if (!this.dictionaryTracks || this.dictionaryTracks.every((dt) => !this._dictionaryTrackEnabled(dt))) return;
        if (this.colorCacheBuilding) return;

        let uncollectedNeedsRefresh = false;
        try {
            this.colorCacheBuilding = true;
            this.tokenRequestFailed = false;
            if (!this.anki) {
                try {
                    this.anki = new Anki(await this.settings.getAll(), this.videoFetcher);
                    await this.anki.requestPermission();
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    this.anki = undefined;
                }
            }
            for (const [track, dt] of this.dictionaryTracks.entries()) {
                if (this.yomitanTracks[track]) continue;
                if (!this._dictionaryTrackEnabled(dt)) continue;
                if (!this.videoColorCache[track]) this.videoColorCache[track] = {};
                if (!this.appColorCache[track]) this.appColorCache[track] = {};
                if (!this.tokenColorCache.has(track)) this.tokenColorCache.set(track, new Map());
                if (!this.tokenizeCache.has(track)) this.tokenizeCache.set(track, new Map());
                if (!this.lemmatizeCache.has(track)) this.lemmatizeCache.set(track, new Map());
                if (!this.erroredCache.has(track)) this.erroredCache.set(track, new Set());
                if (!this.uncollectedCache.has(track)) this.uncollectedCache.set(track, new Set());
                try {
                    const yt = new Yomitan(dt!, this.videoFetcher);
                    await yt.version();
                    this.yomitanTracks[track] = yt;
                } catch (e) {
                    console.warn(`YomitanTrack${track + 1} version request failed:`, e);
                    this.yomitanTracks[track] = undefined;
                }
            }

            if (this.uncollectedNeedsRefresh) {
                uncollectedNeedsRefresh = true;
                const existingIndexes = new Set(subtitles.map((s) => s.index));
                for (const [_, uc] of this.uncollectedCache.entries()) {
                    for (const index of uc) {
                        if (existingIndexes.has(index)) continue;
                        subtitles.push(this.subtitles[index]); // Process all uncollected subtitles even if not in buffer
                    }
                }
            }

            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track }) => {
                            const dt = this.dictionaryTracks![track];
                            if (!this._dictionaryTrackEnabled(dt)) return;
                            const cachedColoredText = dt!.colorizeOnVideo
                                ? this.videoColorCache[track][index]
                                : this.appColorCache[track][index];
                            if (this._colorCacheValid(cachedColoredText, track, index)) return;
                            const { videoColoredText, appColoredText } = await this._colorizeText(
                                text,
                                track,
                                index,
                                dt!
                            );
                            const coloredText = dt!.colorizeOnVideo ? videoColoredText : appColoredText;
                            if (cachedColoredText === coloredText) return;
                            if (dt!.colorizeOnVideo) this.videoColorCache[track][index] = videoColoredText;
                            if (dt!.colorizeOnApp) this.appColorCache[track][index] = appColoredText;

                            if (this._getSubtitleTrackAlignment(track) === 'bottom') {
                                if (
                                    this.shouldRenderBottomOverlay &&
                                    this.bottomSubtitlesElementOverlay instanceof CachingElementOverlay
                                ) {
                                    this.bottomSubtitlesElementOverlay.uncacheHtmlKey(String(index));
                                }
                            } else {
                                if (
                                    this.shouldRenderTopOverlay &&
                                    this.topSubtitlesElementOverlay instanceof CachingElementOverlay
                                ) {
                                    this.topSubtitlesElementOverlay.uncacheHtmlKey(String(index));
                                }
                            }
                            if (this.showingSubtitles?.some((s) => s.index === index)) {
                                this.newTokenInShowingSubtitles = true;
                            }
                            if (dt!.colorizeOnApp) {
                                const command: VideoToExtensionCommand<SubtitleColorsUpdatedFromVideoMessage> = {
                                    sender: 'asbplayer-video',
                                    message: {
                                        command: 'subtitleColorsUpdated',
                                        eventColorCache: { [track]: { [index]: appColoredText } },
                                    },
                                    src: this.video.src,
                                };
                                browser.runtime.sendMessage(command);
                            }
                        })
                    );
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
        } finally {
            if (uncollectedNeedsRefresh) this.uncollectedNeedsRefresh = false; // Don't reset if it became true during processing
            if (this.tokenRequestFailed) {
                this.anki = undefined;
                this.yomitanTracks = [];
                this.tokenRequestFailed = false;
            }
            this.colorCacheBuilding = false;
        }
    }

    private async _colorizeText(
        text: string,
        track: number,
        index: number,
        dt: DictionaryTrack
    ): Promise<{ videoColoredText: string; appColoredText: string }> {
        const erc = this.erroredCache.get(track)!;
        const ucc = this.uncollectedCache.get(track)!;
        const tc = this.tokenizeCache.get(track)!;
        const tcc = this.tokenColorCache.get(track)!;

        try {
            const yt = this.yomitanTracks[track];
            if (!this.anki || !yt) {
                erc.add(index);
                return {
                    videoColoredText: this._applyTokenStyle(text, TokenColor.ERROR, dt, true),
                    appColoredText: this._applyTokenStyle(text, TokenColor.ERROR, dt, false),
                };
            }

            let videoColoredText: string = '';
            let appColoredText: string = '';
            let textHasError = false;
            let textHasUncollected = false;
            let rawTokens = tc.get(text);
            if (!rawTokens) {
                rawTokens = await yt.tokenize(text);
                tc.set(text, rawTokens);
            }
            for (const rawToken of rawTokens) {
                const trimmedToken = rawToken.trim();

                // Token is already cached or not a word
                const cachedTokenColor = tcc.get(trimmedToken);
                if (this._tokenColorValid(cachedTokenColor)) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, cachedTokenColor!, dt, true);
                    if (dt.colorizeOnApp)
                        appColoredText += this._applyTokenStyle(rawToken, cachedTokenColor!, dt, false);
                    if (cachedTokenColor === TokenColor.ERROR) textHasError = true;
                    else if (cachedTokenColor === TokenColor.UNCOLLECTED) textHasUncollected = true;
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, TokenColor.MATURE, dt, true);
                    if (dt.colorizeOnApp)
                        appColoredText += this._applyTokenStyle(rawToken, TokenColor.MATURE, dt, false);
                    tcc.set(trimmedToken, TokenColor.MATURE);
                    continue;
                }

                // Check if this possibly inflected token is collected
                const tokenWordFieldColor = await this._getWordFieldColor(trimmedToken, dt);
                if (tokenWordFieldColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, tokenWordFieldColor, dt, true);
                    if (dt.colorizeOnApp)
                        appColoredText += this._applyTokenStyle(rawToken, tokenWordFieldColor, dt, false);
                    if (tokenWordFieldColor === TokenColor.ERROR) textHasError = true;
                    tcc.set(trimmedToken, tokenWordFieldColor);
                    continue;
                }

                // Check if this token's lemma is collected
                const lemmaWordColor = await this._handleLemmatize(
                    trimmedToken,
                    track,
                    dt,
                    yt,
                    !dt.dictionaryAnkiSentenceFields.length,
                    (t) => this._getWordFieldColor(t, dt)
                );
                if (lemmaWordColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, lemmaWordColor, dt, true);
                    if (dt.colorizeOnApp) appColoredText += this._applyTokenStyle(rawToken, lemmaWordColor, dt, false);
                    if (lemmaWordColor === TokenColor.ERROR) textHasError = true;
                    tcc.set(trimmedToken, lemmaWordColor);
                    continue;
                }

                // Check if this possibly inflected token is collected in sentence fields
                const tokenSentenceFieldColor = await this._getSentenceFieldColor(trimmedToken, track, dt, yt);
                if (tokenSentenceFieldColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, tokenSentenceFieldColor, dt, true);
                    if (dt.colorizeOnApp)
                        appColoredText += this._applyTokenStyle(rawToken, tokenSentenceFieldColor, dt, false);
                    if (tokenSentenceFieldColor === TokenColor.ERROR) textHasError = true;
                    tcc.set(trimmedToken, tokenSentenceFieldColor);
                    continue;
                }

                // Check if this token's lemma is collected in sentence fields
                const lemmaSentenceColor = await this._handleLemmatize(trimmedToken, track, dt, yt, true, (t) =>
                    this._getSentenceFieldColor(t, track, dt, yt)
                );
                if (lemmaSentenceColor !== TokenColor.UNCOLLECTED) {
                    if (dt.colorizeOnVideo)
                        videoColoredText += this._applyTokenStyle(rawToken, lemmaSentenceColor, dt, true);
                    if (dt.colorizeOnApp)
                        appColoredText += this._applyTokenStyle(rawToken, lemmaSentenceColor, dt, false);
                    if (lemmaSentenceColor === TokenColor.ERROR) textHasError = true;
                    tcc.set(trimmedToken, lemmaSentenceColor);
                    continue;
                }

                // Token is uncollected
                if (dt.colorizeOnVideo)
                    videoColoredText += this._applyTokenStyle(rawToken, TokenColor.UNCOLLECTED, dt, true);
                if (dt.colorizeOnApp)
                    appColoredText += this._applyTokenStyle(rawToken, TokenColor.UNCOLLECTED, dt, false);
                textHasUncollected = true;
                tcc.set(trimmedToken, TokenColor.UNCOLLECTED);
            }

            textHasError ? erc.add(index) : erc.delete(index);
            textHasUncollected ? ucc.add(index) : ucc.delete(index);
            return { videoColoredText, appColoredText };
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error('Error colorizing subtitle text:', error);
            erc.add(index);
            return {
                videoColoredText: this._applyTokenStyle(text, TokenColor.ERROR, dt, true),
                appColoredText: this._applyTokenStyle(text, TokenColor.ERROR, dt, false),
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
        const tcc = this.tokenColorCache.get(track)!;
        const lc = this.lemmatizeCache.get(track)!;

        let tokenLemmas = lc.get(token);
        if (!tokenLemmas) {
            tokenLemmas = await yt.lemmatize(token);
            lc.set(token, tokenLemmas);
        }
        for (const tokenLemma of tokenLemmas) {
            const cachedTokenLemma = tcc.get(tokenLemma);
            if (this._tokenColorValid(cachedTokenLemma)) return cachedTokenLemma!;
            const tokenColor = await getFieldColor(tokenLemma);
            if (tokenColor !== TokenColor.UNCOLLECTED) {
                tcc.set(tokenLemma, tokenColor);
                return tokenColor;
            }
            if (cacheUncollected) {
                tcc.set(tokenLemma, TokenColor.UNCOLLECTED);
            }
        }
        return TokenColor.UNCOLLECTED;
    }

    private async _getWordFieldColor(token: string, dt: DictionaryTrack): Promise<TokenColor> {
        try {
            let cardIds = await this.anki!.findCardsWithWord(token, dt.dictionaryAnkiWordFields);
            if (!cardIds.length) return TokenColor.UNCOLLECTED;
            const suspendedResult = await this._handleSuspended(cardIds, dt);
            if (suspendedResult) return suspendedResult;
            const intervals = await this.anki!.currentIntervals(cardIds);
            return this._getTokenColorFromIntervals(token, intervals, cardIds, dt);
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color using word fields for token "${token}":`, error);
            return TokenColor.ERROR;
        }
    }

    private async _getSentenceFieldColor(
        token: string,
        track: number,
        dt: DictionaryTrack,
        yt: Yomitan
    ): Promise<TokenColor> {
        try {
            const cardIds = await this.anki!.findCardsContainingWord(token, dt.dictionaryAnkiSentenceFields);
            if (!cardIds.length) return TokenColor.UNCOLLECTED;
            const rawCardInfos = await this.anki!.cardsInfo(cardIds);
            if (!rawCardInfos.length) return TokenColor.ERROR;
            const tc = this.tokenizeCache.get(track)!;
            const lc = this.lemmatizeCache.get(track)!;

            // Tokenize the sentence field and filter cards that actually contain the token
            const validCardInfos = await filterAsync(
                rawCardInfos,
                async (cardInfo: any) => {
                    for (const sentenceField of dt.dictionaryAnkiSentenceFields) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        let fieldTokens = tc.get(field.value);
                        if (!fieldTokens) {
                            fieldTokens = (await yt.tokenize(field.value)).map((t) => t.trim());
                            tc.set(field.value, fieldTokens);
                        }
                        if (fieldTokens.includes(token)) return true;
                        if (!dt.dictionarySubtitleLemmatization) continue;
                        for (const fieldToken of fieldTokens) {
                            let fieldTokenLemmas = lc.get(fieldToken);
                            if (!fieldTokenLemmas) {
                                fieldTokenLemmas = await yt.lemmatize(fieldToken);
                                lc.set(fieldToken, fieldTokenLemmas);
                            }
                            if (fieldTokenLemmas.includes(token)) return true;
                        }
                    }
                    return false;
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (!validCardInfos.length) return TokenColor.UNCOLLECTED;

            const suspendedResult = await this._handleSuspended(
                validCardInfos.map((c) => c.cardId),
                dt
            );
            if (suspendedResult) return suspendedResult;
            return this._getTokenColorFromIntervals(
                token,
                validCardInfos.map((cardInfo) => cardInfo.interval),
                validCardInfos.map((cardInfo) => cardInfo.cardId),
                dt
            );
        } catch (error) {
            this.tokenRequestFailed = true;
            console.error(`Error getting color using sentence fields for token "${token}":`, error);
            return TokenColor.ERROR;
        }
    }

    private _getTokenColorFromIntervals(
        token: string,
        intervals: number[],
        cardIds: number[],
        dt: DictionaryTrack
    ): TokenColor {
        if (!intervals.length) {
            console.error(`No intervals found for token "${token}" with card IDs:`, cardIds);
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

    private async _handleSuspended(cardIds: number[], dt: DictionaryTrack): Promise<TokenColor | null> {
        if (dt.dictionaryAnkiTreatSuspended === DictionaryAnkiTreatSuspended.NORMAL) return null;
        if (!(await this.anki!.areSuspended(cardIds)).every((s) => s)) return null;
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

    private _clearColorCaches() {
        this.videoColorCache = {};
        this.appColorCache = {};
        this.tokenColorCache.clear();
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
        this.erroredCache.clear();
        this.uncollectedCache.clear();
    }

    unbind() {
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
            this.notificationElementOverlayHideTimeout = undefined;
        }

        this.bottomSubtitlesElementOverlay.dispose();
        this.topSubtitlesElementOverlay.dispose();
        this.notificationElementOverlay.dispose();
        this.onNextToShow = undefined;
        this.onSlice = undefined;
        this.onOffsetChange = undefined;
        this.onMouseOver = undefined;
        this._clearColorCaches();
    }

    refresh() {
        if (this.shouldRenderBottomOverlay) this.bottomSubtitlesElementOverlay.refresh();
        if (this.shouldRenderTopOverlay) this.topSubtitlesElementOverlay.refresh();
        this.notificationElementOverlay.refresh();
    }

    currentSubtitle(): [SubtitleModelWithIndex | null, SubtitleModel[] | null] {
        const now = 1000 * this.video.currentTime;
        let subtitle = null;
        let index = null;

        for (let i = 0; i < this.subtitles.length; ++i) {
            const s = this.subtitles[i];

            if (
                now >= s.start &&
                now < s.end &&
                (typeof s.track === 'undefined' || !this.disabledSubtitleTracks[s.track])
            ) {
                subtitle = s;
                index = i;
                break;
            }
        }

        if (subtitle === null || index === null) {
            return [null, null];
        }

        return [
            subtitle,
            surroundingSubtitles(
                this.subtitles,
                index,
                this.surroundingSubtitlesCountRadius,
                this.surroundingSubtitlesTimeRadius
            ),
        ];
    }

    unblur(track: number) {
        for (const element of [
            ...this.bottomSubtitlesElementOverlay.displayingElements(),
            ...this.topSubtitlesElementOverlay.displayingElements(),
        ]) {
            const elementTrack = Number(element.dataset.track);

            if (track === elementTrack && element.classList.contains('asbplayer-subtitles-blurred')) {
                this.unblurredSubtitleTracks[track] = true;
                element.classList.remove('asbplayer-subtitles-blurred');
            }
        }
    }

    offset(offset: number, skipNotifyPlayer = false) {
        if (!this.subtitles || this.subtitles.length === 0) {
            return;
        }

        this.subtitles = this.subtitles.map((s) => ({
            text: s.text,
            textImage: s.textImage,
            start: s.originalStart + offset,
            originalStart: s.originalStart,
            end: s.originalEnd + offset,
            originalEnd: s.originalEnd,
            track: s.track,
            index: s.index,
        }));

        this.lastOffsetChangeTimestamp = Date.now();

        if (!skipNotifyPlayer) {
            const command: VideoToExtensionCommand<OffsetFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'offset',
                    value: offset,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);
        }

        this.onOffsetChange?.();

        this.settings.getSingle('rememberSubtitleOffset').then((rememberSubtitleOffset) => {
            if (rememberSubtitleOffset) {
                this.settings.set({ lastSubtitleOffset: offset });
            }
        });
    }

    private _computeOffset(): number {
        if (!this.subtitles || this.subtitles.length === 0) {
            return 0;
        }

        const s = this.subtitles[0];
        return s.start - s.originalStart;
    }

    private _formatOffset(offset: number): string {
        const roundedOffset = Math.floor(offset);
        return roundedOffset >= 0 ? '+' + roundedOffset + ' ms' : roundedOffset + ' ms';
    }

    notification(locKey: string, replacements?: { [key: string]: string }) {
        const text = i18n.t(locKey, replacements ?? {});
        this.notificationElementOverlay.setHtml([{ html: () => this._buildTextHtml(text) }]);

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
        }

        this.notificationElementOverlayHideTimeout = setTimeout(() => {
            this.notificationElementOverlay.hide();
            this.notificationElementOverlayHideTimeout = undefined;
        }, 3000);
    }

    showLoadedMessage(nonEmptyTrackIndex: number[]) {
        if (!this.subtitleFileNames) {
            return;
        }

        let loadedMessage: string;

        const nonEmptySubtitleFileNames: string[] = this._nonEmptySubtitleNames(nonEmptyTrackIndex);

        if (nonEmptySubtitleFileNames.length === 0) {
            loadedMessage = this.subtitleFileNames[0];
        } else {
            loadedMessage = nonEmptySubtitleFileNames.join('<br>');
        }

        if (this.subtitles.length > 0) {
            const offset = this.subtitles[0].start - this.subtitles[0].originalStart;

            if (offset !== 0) {
                loadedMessage += `<br>${this._formatOffset(offset)}`;
            }
        }

        const overlay =
            this._getSubtitleTrackAlignment(0) === 'bottom'
                ? this.bottomSubtitlesElementOverlay
                : this.topSubtitlesElementOverlay;
        this._setSubtitlesHtml(overlay, [
            {
                html: () => {
                    return this._buildTextHtml(loadedMessage);
                },
            },
        ]);
        this.showingLoadedMessage = true;
        this.lastLoadedMessageTimestamp = Date.now();
    }

    private _nonEmptySubtitleNames(nonEmptyTrackIndex: number[]) {
        if (nonEmptyTrackIndex.length === 0) return [];

        const nonEmptySubtitleFileNames = [];
        for (let i = 0; i < nonEmptyTrackIndex.length; i++) {
            nonEmptySubtitleFileNames.push(this.subtitleFileNames![nonEmptyTrackIndex[i]]);
        }

        return nonEmptySubtitleFileNames;
    }

    private _setSubtitlesHtml(subtitlestOverlay: ElementOverlay, htmls: KeyedHtml[]) {
        subtitlestOverlay.setHtml(htmls);
    }

    private _appendSubtitlesHtml(html: string) {
        if (this.shouldRenderBottomOverlay) this.bottomSubtitlesElementOverlay.appendHtml(html);
        if (this.shouldRenderTopOverlay) this.topSubtitlesElementOverlay.appendHtml(html);
    }

    private _subtitleClasses(track?: number) {
        if (track === undefined || this.subtitleClasses === undefined) {
            return '';
        }

        return this.subtitleClasses[track] ?? this.subtitleClasses;
    }

    private _subtitleStyles(track?: number) {
        if (this.subtitleStyles === undefined) {
            return '';
        }

        if (track === undefined) {
            return this.subtitleStyles[0] ?? '';
        }

        return this.subtitleStyles[track] ?? this.subtitleStyles[0] ?? '';
    }

    private _arrayEquals<T>(a: T[], b: T[], equals: (lhs: T, rhs: T) => boolean): boolean {
        if (a.length !== b.length) {
            return false;
        }

        for (let i = 0; i < a.length; ++i) {
            if (!equals(a[i], b[i])) {
                return false;
            }
        }

        return true;
    }

    intersects(clientX: number, clientY: number): boolean {
        const bottomContainer = this.bottomSubtitlesElementOverlay.containerElement;

        if (bottomContainer !== undefined && _intersects(clientX, clientY, bottomContainer)) {
            return true;
        }

        const topContainer = this.topSubtitlesElementOverlay.containerElement;

        if (topContainer !== undefined && _intersects(clientX, clientY, topContainer)) {
            return true;
        }

        return false;
    }
}
