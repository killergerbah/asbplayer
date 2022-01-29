import {
    OffsetMessage,
    SubtitleModel,
    SubtitleSettings,
    surroundingSubtitles,
    VideoToExtensionCommand,
} from '@project/common';

interface Rgb {
    r: number;
    g: number;
    b: number;
}

export default class SubtitleContainer {
    private readonly video: HTMLVideoElement;

    private showingSubtitles?: string[];
    private lastLoadedMessageTimestamp: number;
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;

    private subtitlesInterval?: NodeJS.Timer;
    private showingLoadedMessage: boolean;

    private fullscreenSubtitlesContainerElement?: HTMLElement;
    private fullscreenSubtitlesElement?: HTMLElement;
    private subtitlesContainerElement?: HTMLElement;
    private subtitlesElement?: HTMLElement;
    private subtitlesElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private subtitlesElementStylesInterval?: NodeJS.Timer;
    private subtitlesElementFullscreenPollingInterval?: NodeJS.Timer;
    private fullscreenSubtitlesElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private fullscreenSubtitlesElementFullscreenPollingInterval?: NodeJS.Timer;

    disabledSubtitleTracks: { [key: number]: boolean | undefined };
    subtitles: SubtitleModel[];
    subtitleFileNames?: string[];
    displaySubtitles: boolean;
    subtitlePositionOffsetBottom: number;
    subtitleSettings?: SubtitleSettings;
    surroundingSubtitlesCountRadius: number;
    surroundingSubtitlesTimeRadius: number;
    
    constructor(video: HTMLVideoElement) {
        this.video = video;
        this.subtitles = [];
        this.showingSubtitles = [];
        this.disabledSubtitleTracks = {};
        this.displaySubtitles = true;
        this.subtitlePositionOffsetBottom = 100;
        this.lastLoadedMessageTimestamp = 0;
        this.lastOffsetChangeTimestamp = 0;
        this.showingOffset = undefined;
        this.surroundingSubtitlesCountRadius = 1;
        this.surroundingSubtitlesTimeRadius = 5000;
        this.showingLoadedMessage = false;
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this.lastLoadedMessageTimestamp > 0 && Date.now() - this.lastLoadedMessageTimestamp < 1000) {
                return;
            }

            if (this.showingLoadedMessage) {
                this._subtitlesHtml('');
                this.showingLoadedMessage = false;
            }

            const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;

            if (!showOffset && !this.displaySubtitles) {
                this._hideSubtitles();
                return;
            }

            if (this.subtitles.length === 0) {
                return;
            }

            const offset = showOffset ? this._computeOffset() : 0;
            const now = 1000 * this.video.currentTime;
            let showingSubtitles = [];

            for (let i = 0; i < this.subtitles.length; ++i) {
                const s = this.subtitles[i];

                if (s.start < 0 || s.end < 0) {
                    continue;
                }

                if (
                    now >= s.start &&
                    now < s.end &&
                    (typeof s.track === 'undefined' || !this.disabledSubtitleTracks[s.track])
                ) {
                    showingSubtitles.push(s);
                }
            }

            showingSubtitles = showingSubtitles.sort((s1, s2) => s1.track - s2.track).map((s) => s.text);

            if (
                !this.showingSubtitles ||
                !this._arrayEquals(showingSubtitles, this.showingSubtitles) ||
                (showOffset && offset !== this.showingOffset) ||
                (!showOffset && this.showingOffset !== null)
            ) {
                const html = showingSubtitles.join('<br />');
                this._subtitlesHtml(html);
                this.showingSubtitles = showingSubtitles;

                if (showOffset) {
                    this._appendSubtitlesHtml(this._formatOffset(offset));
                    this.showingOffset = offset;
                } else {
                    this.showingOffset = undefined;
                }
            }
        }, 100);
    }

    unbind() {
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }

        this._hideSubtitles();
    }

    refresh() {
        if (this.fullscreenSubtitlesContainerElement && this.fullscreenSubtitlesElement) {
            this._applyFullscreenStyles(this.fullscreenSubtitlesContainerElement, this.fullscreenSubtitlesElement);
        }

        if (this.subtitlesContainerElement && this.subtitlesElement) {
            this._applyNonFullscreenStyles(this.subtitlesContainerElement, this.subtitlesElement);
        }
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

        if (!subtitle || !index) {
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
            start: s.originalStart + offset,
            originalStart: s.originalStart,
            end: s.originalEnd + offset,
            originalEnd: s.originalEnd,
            track: s.track,
        }));

        const command: VideoToExtensionCommand<OffsetMessage> = {
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

    _computeOffset(): number {
        if (!this.subtitles || this.subtitles.length === 0) {
            return 0;
        }

        const s = this.subtitles[0];
        return s.start - s.originalStart;
    }

    _formatOffset(offset: number): string {
        const roundedOffset = Math.floor(offset);
        return roundedOffset >= 0 ? '+' + roundedOffset + ' ms' : roundedOffset + ' ms';
    }

    showLoadedMessage(message: string) {
        this._subtitlesHtml(message);
        this.showingLoadedMessage = true;
        this.lastLoadedMessageTimestamp = Date.now();
    }

    _subtitlesHtml(html: string) {
        this._subtitlesElement().innerHTML = html;
        this._fullscreenSubtitlesElement().innerHTML = html;
    }

    _appendSubtitlesHtml(html: string) {
        const currentHtml = this._subtitlesElement().innerHTML;
        const newHtml = currentHtml && currentHtml.length > 0 ? currentHtml + '<br>' + html : html;
        this._subtitlesElement().innerHTML = newHtml;
        this._fullscreenSubtitlesElement().innerHTML = newHtml;
    }

    _subtitlesElement(): HTMLElement {
        if (this.subtitlesElement) {
            return this.subtitlesElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = 'asbplayer-subtitles-container';
        div.className = 'asbplayer-subtitles';
        this._applyNonFullscreenStyles(container, div);
        document.body.appendChild(container);

        function toggle() {
            if (document.fullscreenElement) {
                container.style.display = 'none';
            } else {
                container.style.display = '';
            }
        }

        toggle();
        this.subtitlesElementFullscreenChangeListener = (e) => toggle();
        this.subtitlesElementStylesInterval = setInterval(() => this._applyNonFullscreenStyles(container, div), 1000);
        this.subtitlesElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.subtitlesElementFullscreenChangeListener);
        this.subtitlesElement = div;
        this.subtitlesContainerElement = container;

        return this.subtitlesElement;
    }

    _applyNonFullscreenStyles(container: HTMLElement, div: HTMLElement) {
        const rect = this.video.getBoundingClientRect();
        container.style.maxWidth = rect.width + 'px';
        container.style.top = rect.top + rect.height + window.pageYOffset - this.subtitlePositionOffsetBottom + 'px';
        container.style.bottom = '';

        this._applySubtitleSettings(div);
    }

    _fullscreenSubtitlesElement(): HTMLElement {
        if (this.fullscreenSubtitlesElement) {
            return this.fullscreenSubtitlesElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = 'asbplayer-subtitles-container';
        div.className = 'asbplayer-fullscreen-subtitles';
        this._applyFullscreenStyles(container, div);
        this._findFullscreenSubtitlesContainer(container).appendChild(container);
        container.style.display = 'none';
        const that = this;

        function toggle() {
            if (document.fullscreenElement && container.style.display === 'none') {
                container.style.display = '';
                container.remove();
                that._findFullscreenSubtitlesContainer(container).appendChild(container);
            } else if (!document.fullscreenElement) {
                container.style.display = 'none';
            }
        }

        toggle();
        this.fullscreenSubtitlesElementFullscreenChangeListener = (e) => toggle();
        this.fullscreenSubtitlesElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.fullscreenSubtitlesElementFullscreenChangeListener);
        this.fullscreenSubtitlesElement = div;
        this.fullscreenSubtitlesContainerElement = container;

        return this.fullscreenSubtitlesElement;
    }

    _applyFullscreenStyles(container: HTMLElement, div: HTMLElement) {
        this._applySubtitleSettings(div);
        const rect = this.video.getBoundingClientRect();
        container.style.top = '';
        container.style.bottom = this.subtitlePositionOffsetBottom + 'px';
        container.style.maxWidth = '100%';
    }

    _applySubtitleSettings(div: HTMLElement) {
        if (this.subtitleSettings) {
            div.style.color = this.subtitleSettings.subtitleColor;
            div.style.fontSize = this.subtitleSettings.subtitleSize + 'px';

            if (this.subtitleSettings.subtitleOutlineThickness > 0) {
                const thickness = this.subtitleSettings.subtitleOutlineThickness;
                const color = this.subtitleSettings.subtitleOutlineColor;
                div.style.textShadow = `0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}`;
            } else {
                div.style.textShadow = '';
            }

            if (this.subtitleSettings.subtitleBackgroundOpacity > 0) {
                const opacity = this.subtitleSettings.subtitleBackgroundOpacity;
                const color = this.subtitleSettings.subtitleBackgroundColor;
                const { r, g, b } = this._hexToRgb(color);
                div.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                div.style.backgroundColor = '';
            }

            if (this.subtitleSettings.subtitleFontFamily && this.subtitleSettings.subtitleFontFamily.length > 0) {
                div.style.fontFamily = this.subtitleSettings.subtitleFontFamily;
            } else {
                div.style.fontFamily = '';
            }
        }
    }

    _findFullscreenSubtitlesContainer(subtitles: HTMLElement): HTMLElement {
        const testNode = subtitles.cloneNode(true) as HTMLElement;
        testNode.innerHTML = '&nbsp;'; // The node needs to take up some space to perform test clicks
        let current = this.video.parentElement;

        if (!current) {
            return document.body;
        }

        let chosen: HTMLElement | undefined = undefined;

        do {
            const rect = current.getBoundingClientRect();

            if (
                rect.height > 0 &&
                (typeof chosen === 'undefined' ||
                    // Typescript is not smart enough to know that it's possible for 'chosen' to be defined here
                    rect.height >= (chosen as HTMLElement).getBoundingClientRect().height) &&
                this._clickable(current, testNode)
            ) {
                chosen = current;
                break;
            }

            current = current.parentElement;
        } while (current && !current.isSameNode(document.body.parentElement));

        if (chosen) {
            return chosen;
        }

        return document.body;
    }

    _clickable(container: HTMLElement, element: HTMLElement): boolean {
        container.appendChild(element);
        const rect = element.getBoundingClientRect();
        const clickedElement = document.elementFromPoint(rect.x, rect.y);
        const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);
        element.remove();
        return clickable;
    }

    _arrayEquals(a: any[], b: any[]): boolean {
        if (a.length !== b.length) {
            return false;
        }

        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    }

    _hideSubtitles() {
        if (this.subtitlesElement) {
            if (this.subtitlesElementFullscreenChangeListener) {
                document.removeEventListener('fullscreenchange', this.subtitlesElementFullscreenChangeListener);
            }

            if (this.subtitlesElementStylesInterval) {
                clearInterval(this.subtitlesElementStylesInterval);
            }

            if (this.subtitlesElementFullscreenPollingInterval) {
                clearInterval(this.subtitlesElementFullscreenPollingInterval);
            }

            this.subtitlesElement.remove();
            this.subtitlesContainerElement?.remove();
            this.subtitlesContainerElement = undefined;
            this.subtitlesElement = undefined;
        }

        if (this.fullscreenSubtitlesElement) {
            if (this.fullscreenSubtitlesElementFullscreenChangeListener) {
                document.removeEventListener(
                    'fullscreenchange',
                    this.fullscreenSubtitlesElementFullscreenChangeListener
                );
            }

            if (this.fullscreenSubtitlesElementFullscreenPollingInterval) {
                clearInterval(this.fullscreenSubtitlesElementFullscreenPollingInterval);
            }

            this.fullscreenSubtitlesElement.remove();
            this.fullscreenSubtitlesContainerElement?.remove();
            this.fullscreenSubtitlesContainerElement = undefined;
            this.fullscreenSubtitlesElement = undefined;
        }

        this.showingSubtitles = [];
    }

    // https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    _hexToRgb(hex: string): Rgb {
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
