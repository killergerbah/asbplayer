import {
    OffsetFromVideoMessage,
    Rgb,
    SubtitleModel,
    SubtitleSettings,
    surroundingSubtitles,
    VideoToExtensionCommand,
} from '@project/common';
import { ElementOverlay, OffsetAnchor } from './ElementOverlay';

interface SubtitleModelWithIndex extends SubtitleModel {
    index: number;
}

export default class SubtitleContainer {
    private readonly video: HTMLVideoElement;
    private readonly subtitlesElementOverlay: ElementOverlay;
    private readonly notificationElementOverlay: ElementOverlay;

    private showingSubtitles?: SubtitleModelWithIndex[];
    private lastLoadedMessageTimestamp: number;
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;
    private subtitlesInterval?: NodeJS.Timer;
    private showingLoadedMessage: boolean;
    private subtitleSettings?: SubtitleSettings;
    private subtitleStyles?: string;
    private notificationElementOverlayHideTimeout?: NodeJS.Timer;

    disabledSubtitleTracks: { [key: number]: boolean | undefined };
    subtitles: SubtitleModel[];
    subtitleFileNames?: string[];
    forceHideSubtitles: boolean;
    displaySubtitles: boolean;
    surroundingSubtitlesCountRadius: number;
    surroundingSubtitlesTimeRadius: number;

    onStartedShowing?: () => void;
    onWillStopShowing?: () => void;

    constructor(video: HTMLVideoElement) {
        this.video = video;
        this.subtitlesElementOverlay = new ElementOverlay(
            video,
            'asbplayer-subtitles-container',
            'asbplayer-subtitles',
            'asbplayer-subtitles-container',
            'asbplayer-fullscreen-subtitles',
            OffsetAnchor.bottom
        );
        this.notificationElementOverlay = new ElementOverlay(
            video,
            'asbplayer-subtitles-container',
            'asbplayer-subtitles',
            'asbplayer-subtitles-container',
            'asbplayer-fullscreen-subtitles',
            OffsetAnchor.top
        );
        this.subtitles = [];
        this.showingSubtitles = [];
        this.disabledSubtitleTracks = {};
        this.forceHideSubtitles = false;
        this.displaySubtitles = true;
        this.lastLoadedMessageTimestamp = 0;
        this.lastOffsetChangeTimestamp = 0;
        this.showingOffset = undefined;
        this.surroundingSubtitlesCountRadius = 1;
        this.surroundingSubtitlesTimeRadius = 5000;
        this.showingLoadedMessage = false;
    }

    set subtitlePositionOffsetBottom(value: number) {
        this.subtitlesElementOverlay.contentPositionOffset = value;
    }

    setSubtitleSettings(subtitleSettings: SubtitleSettings) {
        this.subtitleSettings = subtitleSettings;
        this.subtitleStyles = undefined;
    }

    private _showing(s: SubtitleModel, now: number) {
        return (
            now >= s.start && now < s.end && (typeof s.track === 'undefined' || !this.disabledSubtitleTracks[s.track])
        );
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

            const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;

            if ((!showOffset && !this.displaySubtitles) || this.forceHideSubtitles) {
                this._hideSubtitles();
                return;
            }

            if (this.subtitles.length === 0) {
                return;
            }

            const offset = showOffset ? this._computeOffset() : 0;
            const now = 1000 * this.video.currentTime;
            const previous = now - 100;
            const next = now + 100;
            let showingSubtitles: SubtitleModelWithIndex[] = [];
            let startedShowing: boolean = false;
            let willStopShowing: boolean = false;

            for (let i = 0; i < this.subtitles.length; ++i) {
                const s = this.subtitles[i];

                if (s.start < 0 || s.end < 0) {
                    continue;
                }

                let indexedSubtitle: SubtitleModelWithIndex | undefined;

                if (this._showing(s, now)) {
                    indexedSubtitle = indexedSubtitle ?? { ...s, index: i };
                    showingSubtitles.push(indexedSubtitle);

                    if (!startedShowing && !this._showing(s, previous)) {
                        startedShowing = true;
                    }

                    if (!willStopShowing && !this._showing(s, next)) {
                        willStopShowing = true;
                    }
                }
            }

            showingSubtitles = showingSubtitles.sort((s1, s2) => s1.track - s2.track);

            if (willStopShowing) {
                this.onWillStopShowing?.();
            }

            if (
                !this.showingSubtitles ||
                !this._arrayEquals(showingSubtitles, this.showingSubtitles, (a, b) => a.index === b.index) ||
                (showOffset && offset !== this.showingOffset) ||
                (!showOffset && this.showingOffset !== undefined)
            ) {
                const html = this._buildSubtitlesHtml(showingSubtitles);
                this._setSubtitlesHtml(html);
                this.showingSubtitles = showingSubtitles;

                if (showOffset) {
                    this._appendSubtitlesHtml(this._buildTextHtml(this._formatOffset(offset)));
                    this.showingOffset = offset;
                } else {
                    this.showingOffset = undefined;
                }

                if (startedShowing) {
                    this.onStartedShowing?.();
                }
            }
        }, 100);
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
        return `<span style="${this._subtitleStyles()}">${text}</span><br>`;
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

    offset(offset: number) {
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
        }));

        const command: VideoToExtensionCommand<OffsetFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'offset',
                value: offset,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);

        this.lastOffsetChangeTimestamp = Date.now();
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

    showLoadedMessage(message: string) {
        this._setSubtitlesHtml(this._buildTextHtml(message));
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
        this.showingSubtitles = [];
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
