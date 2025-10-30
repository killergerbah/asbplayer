import {
    AutoPauseContext,
    CopyToClipboardMessage,
    Fetcher,
    HttpPostMessage,
    OffsetFromVideoMessage,
    SubtitleModel,
    SubtitleHtml,
    VideoToExtensionCommand,
} from '@project/common';
import { Anki } from '@project/common/anki';
import {
    SettingsProvider,
    SubtitleAlignment,
    SubtitleSettings,
    TextSubtitleSettings,
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
const TOKEN_CACHE_BUILD_AHEAD = 5;
const TOKEN_CACHE_BATCH_SIZE = 5;
const TOKEN_CACHE_MAX_REFRESH_INTERVAL = 3000;
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

enum TokenColor {
    MATURE = 'white',
    YOUNG = 'yellow',
    UNKNOWN = 'orange',
    UNCOLLECTED = 'red',
    ERROR = 'gray',
}

enum TokenStyle {
    TEXT = 'text',
    UNDERLINE = 'underline',
    OVERLINE = 'overline',
}

const USER_TOKEN_STYLE = TokenStyle.TEXT;

export default class SubtitleController {
    private readonly video: HTMLMediaElement;
    private readonly settings: SettingsProvider;
    private readonly videoFetcher: VideoFetcher;
    private anki: Anki | undefined;
    private readonly yomitan: Yomitan;

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
    private tokenHtmlCache: Map<string, { html: string; hasError: boolean }> = new Map();
    private tokenizeCache: Map<string, string[]> = new Map();
    private deinflectCache: Map<string, string[]> = new Map();
    private newTokenInShowingSubtitles: boolean = false;
    private tokenCacheLastRefresh: number = Date.now();
    private tokenCacheBuilding: boolean = false;
    private ankiRequestFailed: boolean = false;
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

    readonly autoPauseContext: AutoPauseContext = new AutoPauseContext();

    onNextToShow?: (subtitle: SubtitleModel) => void;
    onSlice?: (subtitle: SubtitleSlice<SubtitleModelWithIndex>) => void;
    onOffsetChange?: () => void;
    onMouseOver?: (event: MouseEvent) => void;

    constructor(video: HTMLMediaElement, settings: SettingsProvider) {
        this.video = video;
        this.settings = settings;
        this.videoFetcher = new VideoFetcher(() => this.video.src);
        this.yomitan = new Yomitan(this.videoFetcher);
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
        this.initTokenCache();
    }

    reset() {
        this.subtitles = [];
        this.subtitleFileNames = undefined;
        this.cacheHtml();
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
                this._buildTokenCacheBuffer(showingSubtitles);
                this.tokenCacheLastRefresh = Date.now();
            } else {
                if (Date.now() - this.tokenCacheLastRefresh >= TOKEN_CACHE_MAX_REFRESH_INTERVAL) {
                    this.initTokenCache(); // Update when paused, e.g. user opened Anki after asbplayer
                    this.tokenCacheLastRefresh = Date.now();
                }
            }

            const shouldRenderOffset =
                (showOffset && offset !== this.showingOffset) || (!showOffset && this.showingOffset !== undefined);

            if ((!showOffset && !this._displaySubtitles) || this._forceHideSubtitles) {
                this.bottomSubtitlesElementOverlay.hide();
                this.topSubtitlesElementOverlay.hide();
            } else if (subtitlesAreNew || shouldRenderOffset || this.newTokenInShowingSubtitles) {
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

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
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
                        return this._buildTextHtml(subtitle.text, subtitle.track);
                    }
                },
                key: String(subtitle.index),
            };
        });
    }

    private _buildTextHtml(text: string, track?: number) {
        return `<span data-track="${track ?? 0}" class="${this._subtitleClasses(track)}" style="${this._subtitleStyles(
            track
        )}">${this.tokenHtmlCache.get(text)?.html ?? text}</span>`;
    }

    private async _buildTokenCacheBuffer(subtitles: SubtitleModelWithIndex[]) {
        if (!subtitles.length) return;
        const startIndex = Math.min(...subtitles.map((s) => s.index));
        const endIndex = Math.max(...subtitles.map((s) => s.index)) + 1;
        await this.buildTokenCache(this.subtitles.slice(startIndex, endIndex)); // Prioritize current subtitles
        await this.buildTokenCache(this.subtitles.slice(endIndex, endIndex + TOKEN_CACHE_BUILD_AHEAD), false);
    }

    private async initTokenCache() {
        const slice = this.subtitleCollection.subtitlesAt(this.video.currentTime * 1000);
        const showingSubtitles = this._findShowingSubtitles(slice);
        if (showingSubtitles.length) {
            await this._buildTokenCacheBuffer(showingSubtitles);
        } else if (slice.nextToShow?.length) {
            await this._buildTokenCacheBuffer(slice.nextToShow);
        } else {
            await this.buildTokenCache(this.subtitles.slice(0, TOKEN_CACHE_BUILD_AHEAD));
        }
    }

    private async buildTokenCache(subtitles: SubtitleModelWithIndex[], requestAnkiPermission: boolean = true) {
        if (!subtitles.length) return;
        if (this.tokenCacheBuilding) return;
        try {
            this.tokenCacheBuilding = true;
            this.ankiRequestFailed = false;
            if (!this.anki && requestAnkiPermission) {
                try {
                    this.anki = new Anki(await this.settings.getAll(), this.videoFetcher);
                    await this.anki.requestPermission();
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    this.anki = undefined;
                }
            }
            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track }) => {
                            const cachedTextHtml = this.tokenHtmlCache.get(text);
                            if (cachedTextHtml && !cachedTextHtml.hasError) return;
                            const coloredTextHtml = await this._colorizeText(text);
                            this.tokenHtmlCache.set(text, coloredTextHtml);
                            if (cachedTextHtml?.hasError && coloredTextHtml.hasError) return;

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
                        })
                    );
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
        } finally {
            if (this.ankiRequestFailed) {
                this.anki = undefined;
                this.ankiRequestFailed = false;
            }
            this.tokenCacheBuilding = false;
        }
    }

    private async _colorizeText(text: string): Promise<{ html: string; hasError: boolean }> {
        try {
            let coloredTextHtml: string = '';
            let textHasError = false;
            let rawTokens = this.tokenizeCache.get(text);
            if (!rawTokens) {
                rawTokens = await this.yomitan.tokenize(text);
                this.tokenizeCache.set(text, rawTokens);
            }
            for (const rawToken of rawTokens) {
                const trimmedToken = rawToken.trim();
                if (!HAS_LETTER_REGEX.test(trimmedToken)) {
                    coloredTextHtml += this._applyTokenStyle(rawToken, TokenColor.MATURE); // Symbols or numbers
                    continue;
                }
                const cachedToken = this.tokenHtmlCache.get(trimmedToken);
                if (cachedToken && !cachedToken.hasError) {
                    coloredTextHtml += cachedToken.html;
                    continue;
                }
                const tokenColor = await this._getTokenColor(trimmedToken);
                let coloredTokenHtml: string | undefined;
                let tokenHasError = false;
                if (tokenColor === TokenColor.UNCOLLECTED) {
                    let deinflectedTokens = this.deinflectCache.get(trimmedToken);
                    if (!deinflectedTokens) {
                        deinflectedTokens = await this.yomitan.deinflectToken(trimmedToken);
                        this.deinflectCache.set(trimmedToken, deinflectedTokens);
                    }
                    for (const deinflectedToken of deinflectedTokens) {
                        const cachedDeinflectedToken = this.tokenHtmlCache.get(deinflectedToken);
                        if (cachedDeinflectedToken && !cachedDeinflectedToken.hasError) {
                            coloredTokenHtml = cachedDeinflectedToken.html;
                            break;
                        }
                        const deinflectedColor = await this._getTokenColor(deinflectedToken);
                        if (deinflectedColor !== TokenColor.UNCOLLECTED) {
                            coloredTokenHtml = this._applyTokenStyle(rawToken, deinflectedColor);
                            tokenHasError = deinflectedColor === TokenColor.ERROR;
                            if (tokenHasError) textHasError = true;
                            this.tokenHtmlCache.set(deinflectedToken, {
                                html: coloredTokenHtml,
                                hasError: tokenHasError,
                            });
                            break;
                        }
                    }
                }
                if (!coloredTokenHtml) {
                    coloredTokenHtml = this._applyTokenStyle(rawToken, tokenColor);
                    tokenHasError = tokenColor === TokenColor.ERROR;
                    if (tokenHasError) textHasError = true;
                }
                coloredTextHtml += coloredTokenHtml;
                this.tokenHtmlCache.set(trimmedToken, { html: coloredTokenHtml, hasError: tokenHasError });
            }
            return { html: coloredTextHtml, hasError: textHasError };
        } catch (error) {
            console.error('Error colorizing subtitle text:', error);
            return { html: this._applyTokenStyle(text, TokenColor.ERROR), hasError: true };
        }
    }

    private async _getTokenColor(token: string): Promise<TokenColor> {
        try {
            if (!this.anki) return TokenColor.ERROR;

            // Search in word fields first
            let cardIds = await this.anki.findCardsWithWord(token, this.anki.getWordFields());
            if (cardIds.length) {
                const intervals = await this.anki.currentIntervals(cardIds);
                return this._getTokenColorFromIntervals(token, intervals, cardIds);
            }

            // Search in sentence fields
            const sentenceFields = this.anki.getSentenceFields();
            cardIds = await this.anki.findCardsContainingWord(token, sentenceFields);
            if (!cardIds.length) return TokenColor.UNCOLLECTED;
            const rawCardInfos = await this.anki.cardsInfo(cardIds);
            if (rawCardInfos.length === 0) return TokenColor.ERROR;

            // Tokenize the sentence field and filter cards that actually contain the token
            const validCardInfos = await filterAsync(
                rawCardInfos,
                async (cardInfo: any) => {
                    for (const sentenceField of sentenceFields) {
                        const field = cardInfo.fields[sentenceField];
                        if (!field) continue;
                        let fieldTokens = this.tokenizeCache.get(field.value);
                        if (!fieldTokens) {
                            fieldTokens = await this.yomitan.tokenize(field.value);
                            this.tokenizeCache.set(field.value, fieldTokens);
                        }
                        if (fieldTokens.map((t) => t.trim()).includes(token)) return true;
                    }
                    return false;
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );
            if (!validCardInfos.length) return TokenColor.UNCOLLECTED;
            const intervals = validCardInfos.map((cardInfo: any) => cardInfo.interval);
            return this._getTokenColorFromIntervals(
                token,
                intervals,
                validCardInfos.map((cardInfo) => cardInfo.cardId)
            );
        } catch (error) {
            this.ankiRequestFailed = true;
            console.error(`Error getting color for token "${token}":`, error);
            return TokenColor.ERROR;
        }
    }

    private _getTokenColorFromIntervals(token: string, intervals: number[], cardIds: number[]): TokenColor {
        if (!intervals.length) {
            console.error(`No intervals found for token "${token}" with card IDs:`, cardIds);
            return TokenColor.ERROR;
        }
        if (intervals.every((i) => i >= 21)) return TokenColor.MATURE;
        if (intervals.every((i) => i === 0)) return TokenColor.UNKNOWN;
        return TokenColor.YOUNG; // If < 21 && !== 0 or mixed intervals
    }

    private _applyTokenStyle(token: string, color: TokenColor): string {
        let style = USER_TOKEN_STYLE;
        if (color === TokenColor.ERROR && USER_TOKEN_STYLE === TokenStyle.TEXT) {
            style = TokenStyle.UNDERLINE;
        }
        switch (style) {
            case TokenStyle.TEXT:
                return `<span style="color: ${color};">${token}</span>`;
            case TokenStyle.UNDERLINE:
                return `<span style="text-decoration: underline ${color} ${color === TokenColor.ERROR ? 'double' : 'solid'};">${token}</span>`;
            // case TokenStyle.OVERLINE:
            //     return `<span style="text-decoration: overline ${color};">${token}</span>`;
            default:
                return token;
        }
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
        this.tokenHtmlCache.clear();
        this.tokenizeCache.clear();
        this.deinflectCache.clear();
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
