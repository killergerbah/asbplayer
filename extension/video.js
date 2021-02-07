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

        for (let v of videoElements) {
            const bindingExists = bindings.filter(b => b.v === v).length > 0;

            if (!bindingExists) {
                const b = new Binding(v);
                b.bind();
                bindings.push(b);
            }
        }

        let i = 0;

        while (i < bindings.length) {
            const b = bindings[i];
            let videoElementExists = false;

            for (let v of videoElements) {
                if (v === b.v) {
                    videoElementExists = true;
                    break;
                }
            }

            if (videoElementExists) {
                ++i;
            } else {
                bindings.splice(i, 1);
                b.unbind();
            }
        }
    }, 1000);

    window.addEventListener('beforeunload', (event) => {
        for (let b of bindings) {
            b.unbind();
        }

        clearInterval(interval);
    });
});

class Binding {

    constructor(v) {
        this.v = v;
    }

    bind() {
        let bound = false;

        if (this.v.readyState === 4) {
            this._bind();
            bound = true;
        } else {
            this.v.addEventListener('canplay', (event) => {
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
    }

    _notifyReady() {
        chrome.runtime.sendMessage({
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.v.duration,
                currentTime: this.v.currentTime,
                paused: this.v.paused,
                audioTracks: null,
                selectedAudioTrack: null
            }
        });
    }

    _subscribe() {
        this.v.addEventListener('play', (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false
                }
            });
        });

        this.v.addEventListener('pause', (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false
                }
            });
        });

        this.v.addEventListener('seeked', (event) => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.v.currentTime,
                    echo: false
                }
            });
        });

        this.heartbeatInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                    src: this.v.src
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
                        this.v.play();
                        break;
                    case 'pause':
                        this.v.pause();
                        break;
                    case 'currentTime':
                        this._seek(request.message.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
    }

    _seek(timestamp) {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-seek', {
                detail: timestamp * 1000
            }));
        } else {
            this.v.currentTime = timestamp;
        }
    }

    unbind() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
        }
    }
}
