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
        this.subtitles = [];
        this.showingSubtitles = [];
        this.displaySubtitles = false;
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
                        this.subtitles = request.message.value;
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);

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

            // FIXME: Right now we only show one subtitle at a time because the non-fullscreen positioning is based on 'top' and not 'bottom'
            for (let i = this.subtitles.length - 1; i >= 0; --i) {
                const s = this.subtitles[i];

                if (now >= s.start && now < s.end) {
                    showingSubtitles.push(s.text);
                    break;
                }
            }

            if (!this._arrayEquals(showingSubtitles, this.showingSubtitles)) {
                const html = showingSubtitles.join('<br />');
                this._subtitlesHtml(html);
                this.showingSubtitles = showingSubtitles;
            }
        }, 100);
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

    _refreshSettings() {
        chrome.storage.sync.get('displaySubtitles', (data) => {
            this.displaySubtitles = data.displaySubtitles;
        });
    }

    unbind() {
        if (this.playListener) {
            this.video.removeEventListener(this.playListener);
        }

        if (this.pauseListener) {
            this.video.removeEventListener(this.pauseListener);
        }

        if (this.seekedListener) {
            this.video.removeEventListener(this.seekedListener);
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
        }
    }

    _subtitlesHtml(html) {
        this._subtitlesElement().innerHTML = html;
        this._fullscreenSubtitlesElement().innerHTML = html;
    }

    _hideSubtitles() {
        if (this.subtitlesElement) {
            this.subtitlesElement.remove();
            this.subtitlesElement = null;
        }

        if (this.fullscreenSubtitlesElement) {
            this.fullscreenSubtitlesElement.remove();
            this.fullscreenSubtitlesElement = null;
        }
    }

    _subtitlesElement() {
        if (!this.subtitlesElement) {
            const div = document.createElement('span');
            div.className = "asbplayer-subtitles";
            this._applyNonFullscreenStyles(div);
            document.body.appendChild(div);

            function toggle() {
                if (document.fullscreenElement) {
                    div.style.display = "none";
                } else {
                    div.style.display = "inline";
                }
            }

            toggle();
            document.addEventListener('fullscreenchange', (e) => toggle());
            document.addEventListener('resize', (e) => this._applyNonFullscreenStyles(div));
            this.subtitlesElement = div;
        }

        return this.subtitlesElement;
    }

    _applyNonFullscreenStyles(div) {
        const rect = this.video.getBoundingClientRect();
        div.style.paddingBottom = null;
        const buffer = Math.max(50, rect.height * 0.2);
        div.style.top = (rect.top + rect.height + window.pageYOffset - buffer) + "px";
        div.style.bottom = null;
        div.style.left = (rect.left + window.pageXOffset) + "px";
        div.style.width = rect.width + "px";
        div.style.height = rect.height;
    }

    _fullscreenSubtitlesElement() {
        if (!this.fullscreenSubtitlesElement) {
            const div = document.createElement('span');
            div.className = "asbplayer-fullscreen-subtitles";
            const rect = this.video.getBoundingClientRect();
            div.style.top = null;
            div.style.bottom = "0px";
            div.style.paddingBottom = "70px";
            div.style.left = "0px";
            div.style.width = "100%";
            div.style.height = rect.height;
            this.video.parentElement.appendChild(div);
            div.style.display = "none";

            function toggle() {
                if (document.fullscreenElement) {
                    div.style.display = "inline";
                } else {
                    div.style.display = "none";
                }
            }

            toggle();
            document.addEventListener('fullscreenchange', (e) => toggle());
            this.fullscreenSubtitlesElement = div;
        }

        return this.fullscreenSubtitlesElement;
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
}
