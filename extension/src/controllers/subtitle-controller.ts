import {
    CopyToClipboardMessage,
    OffsetFromVideoMessage,
    Rgb,
    SubtitleAlignment,
    SubtitleCollection,
    SubtitleModel,
    SubtitleSettings,
    surroundingSubtitles,
    VideoToExtensionCommand,
} from '@project/common';
import { AutoPauseContext } from '@project/common';
import { ElementOverlay, OffsetAnchor } from '../services/element-overlay';

export interface SubtitleModelWithIndex extends SubtitleModel {
    index: number;
}

export default class SubtitleController {
    private readonly video: HTMLVideoElement;

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

    readonly autoPauseContext: AutoPauseContext = new AutoPauseContext();

    onNextToShow?: (subtitle: SubtitleModel) => void;

    constructor(video: HTMLVideoElement) {
        this.video = video;
        this._subtitleAlignment = 'bottom';
        const { subtitlesElementOverlay, notificationElementOverlay } = this._overlays(this._subtitleAlignment);
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

    set subtitlePositionOffset(value: number) {
        this.subtitlesElementOverlay.contentPositionOffset = value;
    }

    setSubtitleSettings(subtitleSettings: SubtitleSettings) {
        this.subtitleSettings = subtitleSettings;
        this.subtitleStyles = undefined;
    }

    set subtitleAlignment(value: SubtitleAlignment) {
        if (this._subtitleAlignment === value) {
            return;
        }

        this.subtitlesElementOverlay.hide();
        this.notificationElementOverlay.hide();
        const { subtitlesElementOverlay, notificationElementOverlay } = this._overlays(value);
        subtitlesElementOverlay.contentPositionOffset = this.subtitlesElementOverlay.contentPositionOffset;
        notificationElementOverlay.contentPositionOffset = this.notificationElementOverlay.contentPositionOffset;
        this.subtitlesElementOverlay = subtitlesElementOverlay;
        this.notificationElementOverlay = notificationElementOverlay;
        this._subtitleAlignment = value;
    }

    set displaySubtitles(displaySubtitles: boolean) {
        this._displaySubtitles = displaySubtitles;
        this.showingSubtitles = undefined;
    }

    set forceHideSubtitles(forceHideSubtitles: boolean) {
        this._forceHideSubtitles = forceHideSubtitles;
        this.showingSubtitles = undefined;
    }

    private _overlays(alignment: SubtitleAlignment) {
        switch (alignment) {
            case 'bottom': {
                return {
                    subtitlesElementOverlay: new ElementOverlay(
                        this.video,
                        'asbplayer-subtitles-container-bottom',
                        'asbplayer-subtitles',
                        'asbplayer-subtitles-container-bottom',
                        'asbplayer-fullscreen-subtitles',
                        OffsetAnchor.bottom
                    ),
                    notificationElementOverlay: new ElementOverlay(
                        this.video,
                        'asbplayer-notification-container-top',
                        'asbplayer-notification',
                        'asbplayer-notification-container-top',
                        'asbplayer-notification',
                        OffsetAnchor.top
                    ),
                };
            }
            case 'top': {
                return {
                    subtitlesElementOverlay: new ElementOverlay(
                        this.video,
                        'asbplayer-subtitles-container-top',
                        'asbplayer-subtitles',
                        'asbplayer-subtitles-container-top',
                        'asbplayer-fullscreen-subtitles',
                        OffsetAnchor.top
                    ),
                    notificationElementOverlay: new ElementOverlay(
                        this.video,
                        'asbplayer-notification-container-bottom',
                        'asbplayer-notification',
                        'asbplayer-notification-container-bottom',
                        'asbplayer-notification',
                        OffsetAnchor.bottom
                    ),
                };
            }
        }
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this.lastLoadedMessageTimestamp > 0 && Date.now() - this.lastLoadedMessageTimestamp < 1000) {
                return;
            }

            if (this.showingLoadedMessage) {
                this._setSubtitlesHtml('');
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
                this._hideSubtitles();
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

    private _renderSubtitles(subtitles: SubtitleModel[]) {
        const html = this._buildSubtitlesHtml(subtitles);
        this._setSubtitlesHtml(html);
    }

    private _autoCopyToClipboard(subtitles: SubtitleModel[]) {
        if (this.autoCopyCurrentSubtitle && subtitles.length > 0 && document.hasFocus()) {
            const command: VideoToExtensionCommand<CopyToClipboardMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'copy-to-clipboard',
                    dataUrl: `data:,${encodeURIComponent(subtitles.map((s) => s.text).join('\n'))}`,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }
    }

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
    }

    private _buildSubtitlesHtml(subtitles: SubtitleModel[]) {
        let content;
        return subtitles
            .map((subtitle) => {
                if (subtitle.textImage) {
                    const imageScale =
                        ((this.subtitleSettings?.imageBasedSubtitleScaleFactor ?? 1) *
                            this.video.getBoundingClientRect().width) /
                        subtitle.textImage.screen.width;
                    const width = imageScale * subtitle.textImage.image.width;

                    content = `
<div style="max-width:${width}px;">
    <img
        style="width:100%;"
        alt="subtitle"
        src="${subtitle.textImage.dataUrl}"
    />
</div>
`;
                } else {
                    content = this._buildTextHtml(subtitle.text);
                }

                return content;
            })
            .join('\n');
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

        this._hideSubtitles();
        this.notificationElementOverlay.hide();
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

    notification(notification: string) {
        this.notificationElementOverlay.setHtml(this._buildTextHtml(notification));

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
        }

        this.notificationElementOverlayHideTimeout = setTimeout(() => {
            this.notificationElementOverlay.hide();
            this.notificationElementOverlayHideTimeout = undefined;
        }, 3000);
    }

    showLoadedMessage() {
        if (!this.subtitleFileNames) {
            return;
        }

        let loadedMessage;

        loadedMessage = this.subtitleFileNames.join('<br>');
        if (this.subtitles.length > 0) {
            const offset = this.subtitles[0].start - this.subtitles[0].originalStart;

            if (offset !== 0) {
                loadedMessage += `<br>${this._formatOffset(offset)}`;
            }
        }

        this._setSubtitlesHtml(this._buildTextHtml(loadedMessage));
        this.showingLoadedMessage = true;
        this.lastLoadedMessageTimestamp = Date.now();
    }

    private _setSubtitlesHtml(html: string) {
        this.subtitlesElementOverlay.setHtml(html);
    }

    private _appendSubtitlesHtml(html: string) {
        this.subtitlesElementOverlay.appendHtml(html);
    }

    private _subtitleStyles() {
        if (this.subtitleStyles) {
            return this.subtitleStyles;
        }

        if (this.subtitleSettings) {
            const color = this.subtitleSettings.subtitleColor;
            const fontSize = this.subtitleSettings.subtitleSize + 'px';
            let textShadow: string;

            if (this.subtitleSettings.subtitleOutlineThickness > 0) {
                const thickness = this.subtitleSettings.subtitleOutlineThickness;
                const color = this.subtitleSettings.subtitleOutlineColor;
                textShadow = `0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}`;
            } else {
                textShadow = '';
            }

            let backgroundColor: string;

            if (this.subtitleSettings.subtitleBackgroundOpacity > 0) {
                const opacity = this.subtitleSettings.subtitleBackgroundOpacity;
                const color = this.subtitleSettings.subtitleBackgroundColor;
                const { r, g, b } = this._hexToRgb(color);
                backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                backgroundColor = '';
            }

            let fontFamily: string;

            if (this.subtitleSettings.subtitleFontFamily && this.subtitleSettings.subtitleFontFamily.length > 0) {
                fontFamily = `${this.subtitleSettings.subtitleFontFamily}`;
            } else {
                fontFamily = '';
            }

            this.subtitleStyles = `color:${color} !important;font-size:${fontSize} !important;text-shadow:${textShadow} !important;background-color:${backgroundColor} !important;font-family:${fontFamily} !important`;
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

    private _hideSubtitles() {
        this.subtitlesElementOverlay.hide();
    }

    // https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    private _hexToRgb(hex: string): Rgb {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        if (!result) {
            return { r: 255, g: 255, b: 255 };
        }

        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        };
    }
}
