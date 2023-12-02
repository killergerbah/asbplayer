import {
    CopyToClipboardMessage,
    OffsetFromVideoMessage,
    SubtitleModel,
    VideoToExtensionCommand,
    AutoPauseContext,
} from '@project/common';
import { SettingsProvider, SubtitleAlignment, SubtitleSettings } from '@project/common/settings';
import { computeStyleString, surroundingSubtitles } from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import {
    CachingElementOverlay,
    DefaultElementOverlay,
    ElementOverlay,
    ElementOverlayParams,
    KeyedHtml,
    OffsetAnchor,
} from '../services/element-overlay';
import i18n from 'i18next';

export interface SubtitleModelWithIndex extends SubtitleModel {
    index: number;
}

export default class SubtitleController {
    private readonly video: HTMLMediaElement;
    private readonly settings: SettingsProvider;

    private showingSubtitles?: SubtitleModelWithIndex[];
    private lastLoadedMessageTimestamp: number;
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;
    private subtitlesInterval?: NodeJS.Timer;
    private showingLoadedMessage: boolean;
    private subtitleSettings?: SubtitleSettings;
    private subtitleStyles?: string;
    private notificationElementOverlayHideTimeout?: NodeJS.Timer;
    private _subtitles: SubtitleModelWithIndex[];
    private subtitleCollection: SubtitleCollection<SubtitleModelWithIndex>;
    private subtitlesElementOverlay: ElementOverlay;
    private notificationElementOverlay: ElementOverlay;
    disabledSubtitleTracks: { [key: number]: boolean | undefined };
    subtitleFileNames?: string[];
    _forceHideSubtitles: boolean;
    _displaySubtitles: boolean;
    surroundingSubtitlesCountRadius: number;
    surroundingSubtitlesTimeRadius: number;
    autoCopyCurrentSubtitle: boolean;
    _subtitleAlignment: SubtitleAlignment;
    _preCacheDom;

    readonly autoPauseContext: AutoPauseContext = new AutoPauseContext();

    onNextToShow?: (subtitle: SubtitleModel) => void;

    constructor(video: HTMLMediaElement, settings: SettingsProvider) {
        this.video = video;
        this.settings = settings;
        this._subtitleAlignment = 'bottom';
        this._preCacheDom = false;
        const { subtitlesElementOverlay, notificationElementOverlay } = this._overlays(
            this._subtitleAlignment,
            this._preCacheDom
        );
        this.subtitlesElementOverlay = subtitlesElementOverlay;
        this.notificationElementOverlay = notificationElementOverlay;
        this._subtitles = [];
        this.subtitleCollection = new SubtitleCollection<SubtitleModelWithIndex>([]);
        this.showingSubtitles = [];
        this.disabledSubtitleTracks = {};
        this._forceHideSubtitles = false;
        this._displaySubtitles = true;
        this.lastLoadedMessageTimestamp = 0;
        this.lastOffsetChangeTimestamp = 0;
        this.showingOffset = undefined;
        this.surroundingSubtitlesCountRadius = 1;
        this.surroundingSubtitlesTimeRadius = 5000;
        this.showingLoadedMessage = false;
        this.autoCopyCurrentSubtitle = false;
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
    }

    get preCacheDom() {
        return this._preCacheDom;
    }

    set preCacheDom(preCacheDom) {
        if (this._preCacheDom === preCacheDom) {
            return;
        }

        this._resetOverlays(this._subtitleAlignment, preCacheDom);
        this._preCacheDom = preCacheDom;
    }

    cacheHtml() {
        if (!(this.subtitlesElementOverlay instanceof CachingElementOverlay)) {
            return;
        }

        this.subtitlesElementOverlay.uncacheHtml();
        const htmls = this._buildSubtitlesHtml(this.subtitles);

        for (const html of htmls) {
            this.subtitlesElementOverlay.cacheHtml(html.key, html.html());
        }
    }

    set subtitlePositionOffset(value: number) {
        this.subtitlesElementOverlay.contentPositionOffset = value;
    }

    setSubtitleSettings(subtitleSettings: SubtitleSettings) {
        const styles = computeStyleString(subtitleSettings);

        if (styles !== this.subtitleStyles) {
            this.subtitleStyles = styles;
            this.cacheHtml();
        }

        this.subtitleSettings = subtitleSettings;
    }

    set subtitleAlignment(value: SubtitleAlignment) {
        if (this._subtitleAlignment === value) {
            return;
        }

        const { subtitleOverlayParams, notificationOverlayParams } = this._elementOverlayParams(value);
        this._applyElementOverlayParams(this.subtitlesElementOverlay, subtitleOverlayParams);
        this._applyElementOverlayParams(this.notificationElementOverlay, notificationOverlayParams);
        this.subtitlesElementOverlay.hide();
        this.notificationElementOverlay.hide();
        this._subtitleAlignment = value;
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

    private _resetOverlays(alignment: SubtitleAlignment, preCacheDom: boolean, skipCacheHtml: boolean = false) {
        this.subtitlesElementOverlay.dispose();
        this.notificationElementOverlay.dispose();
        const { subtitlesElementOverlay, notificationElementOverlay } = this._overlays(alignment, preCacheDom);
        subtitlesElementOverlay.contentPositionOffset = this.subtitlesElementOverlay.contentPositionOffset;
        notificationElementOverlay.contentPositionOffset = this.notificationElementOverlay.contentPositionOffset;
        this.subtitlesElementOverlay = subtitlesElementOverlay;
        this.notificationElementOverlay = notificationElementOverlay;

        if (!skipCacheHtml) {
            this.cacheHtml();
        }
    }

    private _overlays(alignment: SubtitleAlignment, preCacheDom: boolean) {
        const { subtitleOverlayParams, notificationOverlayParams } = this._elementOverlayParams(alignment);

        if (preCacheDom) {
            return {
                subtitlesElementOverlay: new CachingElementOverlay(subtitleOverlayParams),
                notificationElementOverlay: new CachingElementOverlay(notificationOverlayParams),
            };
        }

        return {
            subtitlesElementOverlay: new DefaultElementOverlay(subtitleOverlayParams),
            notificationElementOverlay: new DefaultElementOverlay(notificationOverlayParams),
        };
    }

    private _elementOverlayParams(alignment: SubtitleAlignment) {
        let subtitleOverlayParams: ElementOverlayParams;
        let notificationOverlayParams: ElementOverlayParams;

        switch (alignment) {
            case 'bottom': {
                subtitleOverlayParams = {
                    targetElement: this.video,
                    nonFullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
                    nonFullscreenContentClassName: 'asbplayer-subtitles',
                    fullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
                    fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
                    offsetAnchor: OffsetAnchor.bottom,
                };
                notificationOverlayParams = {
                    targetElement: this.video,
                    nonFullscreenContainerClassName: 'asbplayer-notification-container-top',
                    nonFullscreenContentClassName: 'asbplayer-notification',
                    fullscreenContainerClassName: 'asbplayer-notification-container-top',
                    fullscreenContentClassName: 'asbplayer-notification',
                    offsetAnchor: OffsetAnchor.top,
                };
                break;
            }
            case 'top': {
                subtitleOverlayParams = {
                    targetElement: this.video,
                    nonFullscreenContainerClassName: 'asbplayer-subtitles-container-top',
                    nonFullscreenContentClassName: 'asbplayer-subtitles',
                    fullscreenContainerClassName: 'asbplayer-subtitles-container-top',
                    fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
                    offsetAnchor: OffsetAnchor.top,
                };
                notificationOverlayParams = {
                    targetElement: this.video,
                    nonFullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                    nonFullscreenContentClassName: 'asbplayer-notification',
                    fullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                    fullscreenContentClassName: 'asbplayer-notification',
                    offsetAnchor: OffsetAnchor.bottom,
                };
                break;
            }
        }

        return { subtitleOverlayParams, notificationOverlayParams };
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this.lastLoadedMessageTimestamp > 0 && Date.now() - this.lastLoadedMessageTimestamp < 1000) {
                return;
            }

            if (this.showingLoadedMessage) {
                this._setSubtitlesHtml([{ html: () => '' }]);
                this.showingLoadedMessage = false;
            }

            if (this.subtitles.length === 0) {
                return;
            }

            const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;
            const offset = showOffset ? this._computeOffset() : 0;
            const now = 1000 * this.video.currentTime;
            let showingSubtitles: SubtitleModelWithIndex[] = [];
            const slice = this.subtitleCollection.subtitlesAt(now);
            showingSubtitles = slice.showing.filter((s) => this._trackEnabled(s)).sort((s1, s2) => s1.track - s2.track);

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
            }

            const shouldRenderOffset =
                (showOffset && offset !== this.showingOffset) || (!showOffset && this.showingOffset !== undefined);

            if ((!showOffset && !this._displaySubtitles) || this._forceHideSubtitles) {
                this.subtitlesElementOverlay.hide();
            } else if (subtitlesAreNew || shouldRenderOffset) {
                this._renderSubtitles(showingSubtitles);

                if (showOffset) {
                    this._appendSubtitlesHtml(this._buildTextHtml(this._formatOffset(offset)));
                    this.showingOffset = offset;
                } else {
                    this.showingOffset = undefined;
                }
            }
        }, 100);
    }

    private _renderSubtitles(subtitles: SubtitleModelWithIndex[]) {
        this._setSubtitlesHtml(this._buildSubtitlesHtml(subtitles));
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

                chrome.runtime.sendMessage(command);
            }
        }
    }

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
    }

    private _buildSubtitlesHtml(subtitles: SubtitleModelWithIndex[]) {
        return subtitles.map((subtitle) => {
            return {
                html: () => {
                    if (subtitle.textImage) {
                        const imageScale =
                            ((this.subtitleSettings?.imageBasedSubtitleScaleFactor ?? 1) *
                                this.video.getBoundingClientRect().width) /
                            subtitle.textImage.screen.width;
                        const width = imageScale * subtitle.textImage.image.width;

                        return `
<div style="max-width:${width}px;">
    <img
        style="width:100%;"
        alt="subtitle"
        src="${subtitle.textImage.dataUrl}"
    />
</div>
`;
                    } else {
                        return this._buildTextHtml(subtitle.text);
                    }
                },
                key: String(subtitle.index),
            };
        });
    }

    private _buildTextHtml(text: string) {
        return `<span style="${this._subtitleStyles()}">${text}</span>`;
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

        this.subtitlesElementOverlay.dispose();
        this.notificationElementOverlay.dispose();
    }

    refresh() {
        this.subtitlesElementOverlay.refresh();
        this.notificationElementOverlay.refresh();
    }

    currentSubtitle(): [SubtitleModel | null, SubtitleModel[] | null] {
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

            chrome.runtime.sendMessage(command);
        }

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

        this._setSubtitlesHtml([
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

    private _setSubtitlesHtml(htmls: KeyedHtml[]) {
        this.subtitlesElementOverlay.setHtml(htmls);
    }

    private _appendSubtitlesHtml(html: string) {
        this.subtitlesElementOverlay.appendHtml(html);
    }

    private _subtitleStyles() {
        if (this.subtitleStyles) {
            return this.subtitleStyles;
        }

        if (this.subtitleSettings) {
            this.subtitleStyles = computeStyleString(this.subtitleSettings);
            return this.subtitleStyles;
        }

        return '';
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
}
