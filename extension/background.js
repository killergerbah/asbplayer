class Recorder {

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.audio = null;
    }

    async record(time) {
        if (this.recording) {
            console.error("Already recording, cannot start");
            return new Promise((resolve, reject) => reject(new Error("Already recording, cannot start")));
        }

        return new Promise((resolve, reject) => {
            chrome.tabCapture.capture({audio: true}, async (stream) => {
                const audioBase64 = await this._start(stream, time);
                resolve(audioBase64);
            });
        });
    }

    async _start(stream, time) {
        return new Promise((resolve, reject) => {
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
            };
            recorder.onstop = (e) => {
                const blob = new Blob(chunks);
                blob.arrayBuffer().then(buffer => resolve(this._base64(buffer)));
            };
            recorder.start();
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play();

            this.recorder = recorder;
            this.recording = true;
            this.stream = stream;
            this.audio = audio;
            setTimeout(() => this._stop(), time);
        });
    }

    _base64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const length = bytes.byteLength;

        for (let i = 0; i < length; ++i) {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa(binary);
    }

    _stop() {
        if (!this.recording) {
            console.error("Not recording, unable to stop");
            return;
        }

        this.recording = false;
        this.recorder.stop();
        this.recorder = null;
        this.stream.getAudioTracks()[0].stop();
        this.stream = null;
        this.audio.pause();
        this.audio.srcObject = null;
        this.audio = null;
    }
}

function crop(dataUrl, rect) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        image.src = dataUrl;
    });
}

function captureVisibleTab(rect) {
    return new Promise(async (resolve, reject) => {
        chrome.tabs.captureVisibleTab(
            null,
            {format: 'jpeg'},
            async (dataUrl) => {
                const croppedDataUrl = await crop(dataUrl, rect);
                resolve(croppedDataUrl.substr(croppedDataUrl.indexOf(',') + 1));
            }
        );
    });
}

const tabs = {};
const recorder = new Recorder();

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-video') {
            if (request.message.command === 'heartbeat') {
                tabs[sender.tab.id] = {
                    tab: sender.tab,
                    src: request.message.src,
                    timestamp: Date.now()
                };
            } else if (request.message.command === 'record-media-and-forward-subtitle') {
                const subtitle = request.message.subtitle;
                const message = {
                    command: 'copy',
                    subtitle: subtitle
                };

                let audioPromise = null;
                let imagePromise = null;

                if (request.message.record) {
                    const time = subtitle.end - subtitle.start + 500;
                    audioPromise = recorder.record(time);
                }

                if (request.message.screenshot) {
                    imagePromise = captureVisibleTab(request.message.rect);
                }

                if (imagePromise) {
                    const imageBase64 = await imagePromise;
                    message['image'] = {
                        base64: imageBase64,
                        extension: 'jpeg'
                    };
                    chrome.tabs.sendMessage(sender.tab.id, {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'screenshot-taken'
                        }
                    });
                }

                if (audioPromise) {
                    const audioBase64 = await audioPromise;
                    message['audio'] = {
                        base64: audioBase64,
                        extension: 'webm'
                    };
                }

                chrome.tabs.query({}, (allTabs) => {
                    for (let t of allTabs) {
                        chrome.tabs.sendMessage(t.id, {
                            sender: 'asbplayer-extension-to-player',
                            message: message,
                            tabId: sender.tab.id
                        });
                    }
                });
            } else {
                chrome.tabs.query({}, (allTabs) => {
                    for (let t of allTabs) {
                        chrome.tabs.sendMessage(t.id, {
                            sender: 'asbplayer-extension-to-player',
                            message: request.message,
                            tabId: sender.tab.id
                        });
                    }
                });
            }
        } else if (request.sender === 'asbplayer') {
            chrome.tabs.sendMessage(request.tabId, {
                sender: 'asbplayer-extension-to-video',
                message: request.message
            });
        } else if (request.sender === 'asbplayer-popup') {
            for (const tabId in tabs) {
                chrome.tabs.sendMessage(tabs[tabId].tab.id, {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'settings-updated'
                    }
                });
            }
        }
    }
);

chrome.commands.onCommand.addListener((command) => {
    if (command === 'copy-subtitle') {
        chrome.tabs.query({active: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
                return;
            }

            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle'
                    }
                });
            }
        });
    }
});

setInterval(() => {
    const expired = Date.now() - 5000;
    const activeTabs = [];

    for (const tabId in tabs) {
        const info = tabs[tabId];
        if (info.timestamp < expired) {
            delete tabs[tabId];
        } else {
            activeTabs.push({
                id: info.tab.id,
                title: info.tab.title,
                src: info.src
            });
        }
    }

    chrome.tabs.query({}, (allTabs) => {
        for (let t of allTabs) {
            chrome.tabs.sendMessage(t.id, {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'tabs',
                    tabs: activeTabs
                }
            });
        }
    });
}, 1000);
