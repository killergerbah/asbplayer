export default class SubtitleContainer {

    constructor(video) {
        this.video = video;
        this.subtitles = [];
        this.showingSubtitles = [];
        this.displaySubtitles = true;
        this.subtitlePositionOffsetBottom = 100;
    }

    bind() {
        this.subtitlesInterval = setInterval(() => {
            if (this.subtitles.length === 0) {
                return;
            }

            if (this.showingLoadedMessage) {
                return;
            }

            if (!this.displaySubtitles) {
                this._hideSubtitles();
                return;
            }

            const now = 1000 * this.video.currentTime;
            const showingSubtitles = [];

            for (let i = 0; i < this.subtitles.length; ++i) {
                const s = this.subtitles[i];

                if (now >= s.start && now < s.end) {
                    showingSubtitles.push(s.text);
                }
            }

            if (!this._arrayEquals(showingSubtitles, this.showingSubtitles)) {
                const html = showingSubtitles.join('<br />');
                this._subtitlesHtml(html);
                this.showingSubtitles = showingSubtitles;
            }
        }, 100);
    }

    unbind() {
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = null;
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

    currentSubtitle() {
        const now = 1000 * this.video.currentTime;
        let subtitle = null;

        for (let i = 0; i < this.subtitles.length; ++i) {
            const s = this.subtitles[i];

            if (now >= s.start && now < s.end) {
                subtitle = s;
                break;
            }
        }

        return subtitle;
    }

    showLoadedMessage(message) {
        this._subtitlesHtml(message);
        this.showingLoadedMessage = true;
        setTimeout(() => {
            if (this.showingLoadedMessage) {
                this._subtitlesHtml("");
                this.showingLoadedMessage = false;
            }
        }, 1000);
    }

    _subtitlesHtml(html) {
        this._subtitlesElement().innerHTML = html;
        this._fullscreenSubtitlesElement().innerHTML = html;
    }

    _subtitlesElement() {
        if (this.subtitlesElement) {
            return this.subtitlesElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = "asbplayer-subtitles-container";
        div.className = "asbplayer-subtitles";
        this._applyNonFullscreenStyles(container, div);
        document.body.appendChild(container);

        function toggle() {
            if (document.fullscreenElement) {
                container.style.display = "none";
            } else {
                container.style.display = "";
            }
        }

        toggle();
        this.subtitlesElementFullscreenChangeListener = (e) => toggle();
        this.subtitlesElementStylesInterval = setInterval(() => this._applyNonFullscreenStyles(container, div), 1000);
        document.addEventListener('fullscreenchange', this.subtitlesElementFullscreenChangeListener);
        this.subtitlesElement = div;
        this.subtitlesContainerElement = container;

        return this.subtitlesElement;
    }

    _applyNonFullscreenStyles(container, div) {
        const rect = this.video.getBoundingClientRect();
        container.style.maxWidth = rect.width + "px";
        const buffer = Math.max(50, rect.height * 0.2);
        container.style.top = (rect.top + rect.height + window.pageYOffset - this.subtitlePositionOffsetBottom) + "px";
        container.style.bottom = null;
        container.style.height = rect.height;

        this._applySubtitleSettings(div);
    }

    _fullscreenSubtitlesElement() {
        if (this.fullscreenSubtitlesElement) {
            return this.fullscreenSubtitlesElement;
        }

        const div = document.createElement('div');
        const container = document.createElement('div');
        container.appendChild(div);
        container.className = "asbplayer-subtitles-container";
        div.className = "asbplayer-fullscreen-subtitles";
        this._applyFullscreenStyles(container, div);
        this._findFullscreenSubtitlesContainer(container).appendChild(container);
        container.style.display = "none";
        const that = this;

        function toggle() {
            if (document.fullscreenElement) {
                container.style.display = "";
                container.remove();
                that._findFullscreenSubtitlesContainer(container).appendChild(container);
            } else {
                container.style.display = "none";
            }
        }

        toggle();
        this.fullscreenSubtitlesElementFullscreenChangeListener = (e) => toggle();
        document.addEventListener('fullscreenchange', this.fullscreenSubtitlesElementFullscreenChangeListener);
        this.fullscreenSubtitlesElement = div;
        this.fullscreenSubtitlesContainerElement = container;

        return this.fullscreenSubtitlesElement;
    }

    _applyFullscreenStyles(container, div) {
        this._applySubtitleSettings(div);
        const rect = this.video.getBoundingClientRect();
        container.style.top = null;
        container.style.bottom = this.subtitlePositionOffsetBottom + "px";
        container.style.maxWidth = "100%";
    }

    _applySubtitleSettings(div) {
        if (this.subtitleSettings) {
            div.style.color = this.subtitleSettings.subtitleColor;
            div.style.fontSize = this.subtitleSettings.subtitleSize + "px";

            if (this.subtitleSettings.subtitleOutlineThickness > 0) {
                const thickness = this.subtitleSettings.subtitleOutlineThickness;
                const color = this.subtitleSettings.subtitleOutlineColor;
                div.style.textShadow = `0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}, 0 0 ${thickness}px ${color}`;
            } else {
                div.style.textShadow = "";
            }

            if (this.subtitleSettings.subtitleBackgroundOpacity > 0) {
                const opacity = this.subtitleSettings.subtitleBackgroundOpacity;
                const color = this.subtitleSettings.subtitleBackgroundColor;
                const {r, g, b} = this._hexToRgb(color);
                div.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`
            } else {
                div.style.backgroundColor = "";
            }
        }
    }

    _findFullscreenSubtitlesContainer(subtitles) {
        const testNode = subtitles.cloneNode(true);
        testNode.innerHTML = "&nbsp;"; // The node needs to take up some space to perform test clicks
        let current = this.video.parentElement;

        if (!current) {
            return document.body;
        }

        let chosen = null;

        do {
            const rect = current.getBoundingClientRect();

            if (rect.height > 0
                && (!chosen || rect.height >= chosen.getBoundingClientRect().height)
                && this._clickable(current, testNode)) {
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

    _clickable(container, element) {
        container.appendChild(element);
        const rect = element.getBoundingClientRect();
        const clickedElement = document.elementFromPoint(rect.x, rect.y);
        const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);
        element.remove();
        return clickable;
    }

    _arrayEquals(a, b) {
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
            document.removeEventListener('fullscreenchange', this.subtitlesElementFullscreenChangeListener);
            clearInterval(this.subtitlesElementStylesInterval);
            this.subtitlesElement.remove();
            this.subtitlesContainerElement.remove();
            this.subtitlesContainerElement = null;
            this.subtitlesElement = null;
        }

        if (this.fullscreenSubtitlesElement) {
            document.removeEventListener('fullscreenchange', this.fullscreenSubtitlesElementFullscreenChangeListener);
            this.fullscreenSubtitlesElement.remove();
            this.fullscreenSubtitlesContainerElement.remove();
            this.fullscreenSubtitlesContainerElement = null;
            this.fullscreenSubtitlesElement = null;
        }

        this.showingSubtitles = [];
    }

    // https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    _hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        }
    }
}