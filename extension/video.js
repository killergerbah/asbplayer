var s = document.createElement('script');
s.src = chrome.runtime.getURL('netflix.js');
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = e.detail;
});

window.addEventListener('load', (event) => {
    const bindings = [];

    const interval = setInterval(() => {
        const allVideoElements = document.getElementsByTagName('video');
        // For now only allow one video per tab. Otherwise heartbeats can clobber each other.
        const videoElements = allVideoElements.length > 0 ? [allVideoElements[0]] : [];

        for (const v of videoElements) {
            const bindingExists = bindings.filter(b => b.video.isSameNode(v)).length > 0;

            if (!bindingExists) {
                const b = new Binding(v);
                b.bind();
                bindings.push(b);
            }
        }

        let i = 0;

        for (let i = bindings.length - 1; i >= 0; --i) {
            const b = bindings[i];
            let videoElementExists = false;

            for (const v of videoElements) {
                if (v.isSameNode(b.video)) {
                    videoElementExists = true;
                    break;
                }
            }

            if (!videoElementExists) {
                bindings.splice(i, 1);
                b.unbind();
            }
        }
    }, 1000);

    window.addEventListener('beforeunload', (event) => {
        for (let b of bindings) {
            b.unbind();
        }

        bindings.length = 0;

        clearInterval(interval);
    });
});

class Binding {

    constructor(video) {
        this.video = video;
        this.subtitleContainer = new SubtitleContainer(video);
        this.controlsContainer = new ControlsContainer(video);
        this.recordMedia = true;
        this.screenshot = true;
        this.cleanScreenshot = true;
    }

    bind() {
        let bound = false;

        if (this.video.readyState === 4) {
            this._bind();
            bound = true;
        } else {
            this.video.addEventListener('canplay', (event) => {
                if (!bound) {
                    this._bind();
                    bound = true;
                }

                chrome.runtime.sendMessage({
                    sender: 'asbplayer-video',
                    message: {
                        command: 'readyState',
                        value: 4
                    }
                });
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings();
        this.subtitleContainer.bind();
    }

    _notifyReady() {
        chrome.runtime.sendMessage({
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.video.duration,
                currentTime: this.video.currentTime,
                paused: this.video.paused,
                audioTracks: null,
                selectedAudioTrack: null
            }
        });
    }

    _subscribe() {
        this.playListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false
                }
            });
        };

        this.pauseListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false
                }
            });
        };

        this.seekedListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false
                }
            });
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);

        this.heartbeatInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                    src: this.video.src
                }
            });
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            clearInterval(this.heartbeatInterval);
        });

        this.listener = (request, sender, sendResponse) => {
            if (request.sender === 'asbplayer-extension-to-video') {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this.video.play();
                        break;
                    case 'pause':
                        this.video.pause();
                        break;
                    case 'currentTime':
                        this._seek(request.message.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        this.subtitleContainer.subtitles = request.message.value;
                        break;
                    case 'subtitleSettings':
                        this.subtitleContainer.subtitleSettings = request.message.value;
                        this.subtitleContainer.refresh();
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        this._copySubtitle();
                        break;
                    case 'screenshot-taken':
                        if (this.cleanScreenshot) {
                            if (this.showControlsTimeout) {
                                clearTimeout(this.showControlsTimeout);
                                this.showControlsTimeout = null;
                            }

                            this.controlsContainer.show();
                        }
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
    }

    _refreshSettings() {
        chrome.storage.sync.get({
            displaySubtitles: true,
            recordMedia: true,
            screenshot: true,
            cleanScreenshot: true,
            subtitlePositionOffsetBottom: 100
        },
        (data) => {
            this.recordMedia = data.recordMedia;
            this.screenshot = data.screenshot;
            this.cleanScreenshot = data.screenshot && data.cleanScreenshot;
            this.subtitleContainer.displaySubtitles = data.displaySubtitles;
            this.subtitleContainer.subtitlePositionOffsetBottom = data.subtitlePositionOffsetBottom;
            this.subtitleContainer.refresh();
        });
    }

    unbind() {
        if (this.playListener) {
            this.video.removeEventListener('play', this.playListener);
        }

        if (this.pauseListener) {
            this.video.removeEventListener('pause', this.pauseListener);
        }

        if (this.seekedListener) {
            this.video.removeEventListener('seeked', this.seekedListener);
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
        }

        this.subtitleContainer.unbind();
    }

    async _copySubtitle() {
        const subtitle = this.subtitleContainer.currentSubtitle();

        if (subtitle) {
            if (this.recordMedia) {
                this._seek(subtitle.start / 1000);

                if (this.showControlsTimeout) {
                    clearTimeout(this.showControlsTimeout);
                    this.showControlsTimeout = null;
                }

                if (this.cleanScreenshot) {
                    this.controlsContainer.hide();
                    this.showControlsTimeout = setTimeout(() => {
                        this.controlsContainer.show();
                        this.showControlsTimeout = null;
                    }, 500);
                }

                await this.video.play();
            }

            const message = {
                command: 'record-media-and-forward-subtitle',
                subtitle: subtitle,
                record: this.recordMedia,
                screenshot: this.screenshot
            };

            if (message.screenshot) {
                const rect = this.video.getBoundingClientRect();
                message.rect = {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }
            }

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: message
            });
        }
    }

    _seek(timestamp) {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-seek', {
                detail: timestamp * 1000
            }));
        } else {
            this.video.currentTime = timestamp;
        }
    }
}

class SubtitleContainer {

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

    _subtitlesHtml(html) {
        this._subtitlesElement().innerHTML = html;
        this._fullscreenSubtitlesElement().innerHTML = html;
    }

    _subtitlesElement() {
        if (!this.subtitlesElement) {
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
        }

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
        if (!this.fullscreenSubtitlesElement) {
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
        }

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

class ControlsContainer {

    constructor(video) {
        this.video = video;
        this.elements = [];
    }

    show() {
        for (const e of this.elements) {
            e.classList.remove('asbplayer-hide');
        }
    }

    hide() {
        this.show();
        this.elements = this._findElements();

        for (const e of this.elements) {
            e.classList.add('asbplayer-hide');
        }
    }

    _findElements() {
        const elements = [];

        for (const p of this._samplePoints()) {
            for (const element of  this._path(document.elementFromPoint(p.x, p.y))) {
                if (element && !this._contains(elements, element)) {
                    elements.push(element);
                }
            }
        }

        return elements;
    }

    * _samplePoints() {
        const rect = this.video.getBoundingClientRect();
        const stepX = rect.width / 20;
        const stepY = rect.height / 20;
        const points = [];

        for (let x = rect.x; x <= rect.width + rect.x; x += stepX) {
            for (let y = rect.y; y <= rect.height + rect.y; y += stepY) {
                yield {x: x, y: y};
            }
        }

        return points;
    }

    * _path(element) {
        if (!element || element.contains(this.video)) {
            return;
        }

        let current = element;
        yield current;

        while (true) {
            const parent = current.parentElement;

            if (!parent || parent.contains(this.video)) {
                break;
            }

            current = parent;
            yield current;
        }
    }

    _contains(elements, element) {
        for (const e of elements) {
            if (e.isSameNode(element)) {
                return true;
            }
        }

        return false;
    }
}