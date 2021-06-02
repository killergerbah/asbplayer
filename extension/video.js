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
        const videoElements = document.getElementsByTagName('video');

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
        this.dragContainer = new DragContainer(video);
        this.keyBindings = new KeyBindings();
        this.recordMedia = true;
        this.screenshot = true;
        this.cleanScreenshot = true;
        this.bindKeys = true;
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
                    },
                    src: this.video.src
                });
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings();
        this.subtitleContainer.bind();
        this.dragContainer.bind();
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
            },
            src: this.video.src
        });
    }

    _subscribe() {
        this.playListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false
                },
                src: this.video.src
            });
        };

        this.pauseListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false
                },
                src: this.video.src
            });
        };

        this.seekedListener = (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false
                },
                src: this.video.src
            });
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);

        this.heartbeatInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat'
                },
                src: this.video.src
            });
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            clearInterval(this.heartbeatInterval);
        });

        this.listener = (request, sender, sendResponse) => {
            if (request.sender === 'asbplayer-extension-to-video' && request.src === this.video.src) {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this._play();
                        break;
                    case 'pause':
                        this.video.pause();
                        break;
                    case 'currentTime':
                        this.seek(request.message.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        this.subtitleContainer.subtitles = request.message.value;
                        this.subtitleContainer.showLoadedMessage(request.message.name || "[Subtitles Loaded]");
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
            bindKeys: true,
            subsDragAndDrop: true,
            subtitlePositionOffsetBottom: 100
        },
        (data) => {
            this.recordMedia = data.recordMedia;
            this.screenshot = data.screenshot;
            this.cleanScreenshot = data.screenshot && data.cleanScreenshot;
            this.subtitleContainer.displaySubtitles = data.displaySubtitles;
            this.subtitleContainer.subtitlePositionOffsetBottom = data.subtitlePositionOffsetBottom;
            this.subtitleContainer.refresh();

            if (data.bindKeys) {
                this.keyBindings.bind(this);
            } else {
                this.keyBindings.unbind();
            }

            if (data.subsDragAndDrop) {
                this.dragContainer.bind();
            } else {
                this.dragContainer.unbind();
            }
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
        this.dragContainer.unbind();
        this.keyBindings.unbind();
    }

    async _copySubtitle() {
        const subtitle = this.subtitleContainer.currentSubtitle();

        if (subtitle) {
            if (this.recordMedia) {
                this.seek(subtitle.start / 1000);

                if (this.showControlsTimeout) {
                    clearTimeout(this.showControlsTimeout);
                    this.showControlsTimeout = null;
                }

                if (this.cleanScreenshot) {
                    this.controlsContainer.hide();
                }

                await this._play();

                if (this.cleanScreenshot) {
                    this.showControlsTimeout = setTimeout(() => {
                        this.controlsContainer.show();
                        this.showControlsTimeout = null;
                    }, 1000);
                }
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
                message: message,
                src: this.video.src
            });
        }
    }

    seek(timestamp) {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-seek', {
                detail: timestamp * 1000
            }));
        } else {
            this.video.currentTime = timestamp;
        }
    }

    async _play() {
        try {
            await this.video.play();
        } catch(ex) {
            // Deal with Amazon Prime player pausing in the middle of play, without loss of generality
            console.error(ex);

            if (this.video.readyState !== 4) {
                const listener = async (evt) => {
                    let retries = 3;

                    for (let i = 0; i < retries; ++i) {
                        try {
                            await this.video.play();
                        } catch (ex2) {
                            console.info("Failed to play on attempt " + i + ", retrying");
                        }
                    }

                    this.video.removeEventListener('canplay', listener);
                };

                this.video.addEventListener('canplay', listener);
            }
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
        this._garbageCollectElements();
        this._findElements();

        for (const e of this.elements) {
            e.classList.add('asbplayer-hide');
        }
    }

    _garbageCollectElements() {
        this.elements = this.elements.filter(e => document.body.contains(e));
    }

    _findElements() {
        for (const p of this._samplePoints()) {
            for (const element of  this._path(document.elementFromPoint(p.x, p.y))) {
                if (element && !this._contains(this.elements, element)) {
                    this.elements.push(element);
                }
            }
        }
    }

    * _samplePoints() {
        const rect = this.video.getBoundingClientRect();
        const stepX = rect.width / 20;
        const stepY = rect.height / 20;

        for (let x = rect.x; x <= rect.width + rect.x; x += stepX) {
            for (let y = rect.y; y <= rect.height + rect.y; y += stepY) {
                yield {x: x, y: y};
            }
        }
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

class DragContainer {

    constructor(video) {
        this.video = video;
    }

    bind() {
        if (this.bound) {
            return;
        }

        this.dropListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = null;
            this._imageElement().classList.add("asbplayer-hide");
            this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");

            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
                return;
            }

            const file = e.dataTransfer.files[0];

            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: {
                        name: file.name,
                        fileUrl: URL.createObjectURL(file)
                    }
                },
                src: this.video.src
            });
        };

        this.dragOverListener = (e) => e.preventDefault();

        this.dragEnterListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = e.target;
            this._imageElement().classList.remove("asbplayer-hide");
            this._imageElement().classList.add("asbplayer-drag-image-fade-in");
        };

        this.bodyDragEnterListener = (e) => {
            e.preventDefault();

            this._dragElement().classList.add("asbplayer-drag-zone-dragging");
        };

        this.bodyDropListener = (e) => {
            e.preventDefault();

            this._imageElement().classList.add("asbplayer-hide");
            this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
            this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
        };

        this.dragLeaveListener = (e) => {
            e.preventDefault();

            if (this.dragEnterElement === e.target) {
                this._imageElement().classList.add("asbplayer-hide");
                this._imageElement().classList.remove("asbplayer-drag-image-fade-in");
                this._dragElement().classList.remove("asbplayer-drag-zone-dragging");
            }
        };

        const dragElement = this._dragElement();

        dragElement.addEventListener('drop', this.dropListener);
        dragElement.addEventListener('dragover', this.dragOverListener);
        dragElement.addEventListener('dragenter', this.dragEnterListener);
        dragElement.addEventListener('dragleave', this.dragLeaveListener);
        document.body.addEventListener('dragenter', this.bodyDragEnterListener);
        document.body.addEventListener('drop', this.bodyDropListener);

        this.bound = true;
    }

    _dragElement() {
        if (this.dragElement) {
            return this.dragElement;
        }

        const dragElement = document.createElement('div');
        dragElement.classList.add("asbplayer-drag-zone-initial");
        this.dragElement = dragElement;
        this._applyDragElementStyles(dragElement);

        document.body.appendChild(dragElement);

        this.dragElementStylesInterval = setInterval(() => this._applyDragElementStyles(dragElement), 1000);

        return this.dragElement;
    }

    _applyDragElementStyles(dragElement) {
        const rect = this.video.getBoundingClientRect();
        dragElement.style.top = rect.top + "px";
        dragElement.style.left = rect.left + "px";
        dragElement.style.height = rect.height + "px";
        dragElement.style.width = rect.width + "px";
    }

    _imageElement() {
        if (this.imageElement) {
            return this.imageElement;
        }

        const container = document.createElement('div');
        container.classList.add("asbplayer-drag-image-container");
        container.classList.add("asbplayer-hide");

        const image = document.createElement('img');
        image.classList.add("asbplayer-drag-image");
        image.src = chrome.runtime.getURL('drag-image.png');

        this._applyImageContainerStyles(image, container);

        container.appendChild(image);
        document.body.appendChild(container);

        this.imageElementStylesInterval = setInterval(() => this._applyImageContainerStyles(image, container), 1000);
        this.imageElement = container;

        return this.imageElement;
    }

    _applyImageContainerStyles(image, container) {
        const rect = this.video.getBoundingClientRect();
        const imageLength = Math.min(rect.width, rect.height, 500);
        const topOffset = (rect.height - imageLength) / 2;
        const leftOffset =  (rect.width - imageLength) / 2;
        image.style.top = topOffset + "px";
        image.style.left = leftOffset + "px";
        image.style.width = imageLength + "px";
        image.style.height = imageLength + "px";
        container.style.top = rect.top + "px";
        container.style.left = rect.left + "px";
        container.style.height = rect.height + "px";
        container.style.width = rect.width + "px";
    }

    unbind() {
        if (this.dropListener) {
            this.dragElement.removeEventListener('drop', this.dropListener, true);
            this.dropListener = null;
        }

        if (this.dragOverListener) {
            this.dragElement.removeEventListener('dragover', this.dragOverListener, true);
            this.dragOverListener = null;
        }

        if (this.dragEnterListener) {
            this.dragElement.removeEventListener('dragenter', this.dragEnterListener, true);
            this.dragEnterListener = null;
        }

        if (this.dragLeaveListener) {
            this.dragElement.removeEventListener('dragleave', this.dragLeaveListener, true);
            this.dragLeaveListener =  null;
        }

        if (this.bodyDragEnterListener) {
            document.body.removeEventListener('dragenter', this.bodyDragEnterListener);
            this.bodyDragEnterListener = null;
        }
        if (this.bodyDropListener) {
            document.body.removeEventListener('drop', this.bodyDropListener);
            this.bodyDropListener = null;
        }

        if (this.imageElementStylesInterval) {
            clearInterval(this.imageElementStylesInterval);
            this.imageElementStylesInterval = null;
        }

        if (this.imageElement) {
            this.imageElement.remove();
            this.imageElement = null;
        }

        if (this.dragElementStylesInterval) {
            clearInterval(this.dragElementStylesInterval);
            this.dragElementStylesInterval = null;
        }

        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = null;
        }

        this.dragEnterElement = null;
        this.bound = false;
    }
}

class KeyBindings {

    constructor() {
    }

    bind(context) {
        if (this.bound) {
            return;
        }

        this.listener = (e) => {
            if (!context.subtitleContainer.subtitles || context.subtitleContainer.subtitles.length === 0) {
                return;
            }

            if (e.keyCode === 83) {
                chrome.runtime.sendMessage({
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggle-subtitles'
                    },
                    src: context.video.src
                });
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            let forward;

            if (e.keyCode === 37) {
                forward = false;
            } else if (e.keyCode === 39) {
                forward = true;
            } else {
                return;
            }

            const subtitles = context.subtitleContainer.subtitles;
            const now = Math.round(1000 * context.video.currentTime);
            let newSubtitleIndex = -1;

            if (forward) {
                let minDiff = Number.MAX_SAFE_INTEGER;

                for (let i = 0; i < subtitles.length; ++i) {
                    const s = subtitles[i];
                    const diff = s.start - now;

                    if (minDiff <= diff) {
                        continue;
                    }

                    if (now < s.start) {
                        minDiff = diff;
                        newSubtitleIndex = i;
                    }
                }
            } else {
                let minDiff = Number.MAX_SAFE_INTEGER;

                for (let i = 0; i < subtitles.length; ++i) {
                    const s = subtitles[i];
                    const diff = now - s.start;

                    if (minDiff <= diff) {
                        continue;
                    }

                    if (now > s.start) {
                        minDiff = diff;
                        newSubtitleIndex = now < s.end ? Math.max(0, i - 1) : i;
                    }
                }
            }

            if (newSubtitleIndex !== -1) {
                e.preventDefault();
                e.stopImmediatePropagation();
                context.seek(subtitles[newSubtitleIndex].start / 1000);
            }
        };

        window.addEventListener("keydown", this.listener, true);
        this.bound = true;
    }

    unbind() {
        if (this.listener) {
            window.removeEventListener("keydown", this.listener, true);
            this.listener = null;
        }

        this.bound = false;
    }
}