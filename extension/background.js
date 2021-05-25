function base64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const length = bytes.byteLength;

    for (let i = 0; i < length; ++i) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

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
                blob.arrayBuffer().then(buffer => resolve(base64(buffer)));
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

async function fileUrlToBase64(fileUrl) {
    return base64(await (await fetch(fileUrl)).arrayBuffer());
}

const videoTabs = {};
const asbplayers = {};
const recorder = new Recorder();

function refreshSettings() {
    for (const tabId in videoTabs) {
        chrome.tabs.sendMessage(videoTabs[tabId].tab.id, {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'settings-updated'
            }
        });
    }
}

function anyAsbplayerTab(resolve, reject, attempt, maxAttempts) {
    if (attempt >= maxAttempts) {
        reject(new Error("Could not find or create an asbplayer tab"));
        return;
    }

    for (const tabId in asbplayers) {
        resolve(tabId);
        return;
    }

    setTimeout(() => anyAsbplayerTab(resolve, attempt + 1, maxAttempts), 1000);
}

async function findAsbplayerTab(currentTab) {
    let chosenTabId = null;
    const now = Date.now();
    let min = null;

    for (const tabId in asbplayers) {
        const info = asbplayers[tabId];
        const elapsed = now - info.timestamp;

        if (min === null || elapsed < min) {
            min = elapsed;
            chosenTabId = tabId;
        }
    }

    if (chosenTabId) {
        return chosenTabId;
    }

    return new Promise((resolve, reject) => {
        chrome.tabs.create(
            {
                active: false,
                selected: false,
                url: 'https://killergerbah.github.io/asbplayer/',
                index: currentTab.index + 1
            },
            (tab) => anyAsbplayerTab(resolve, reject, 0, 5)
        );
    });
}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-video') {
            if (request.message.command === 'heartbeat') {
                videoTabs[sender.tab.id] = {
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
            } else if (request.message.command === 'toggle-subtitles') {
                chrome.storage.sync.get(
                    {displaySubtitles: true},
                    (data) => chrome.storage.sync.set({displaySubtitles: !data.displaySubtitles}, () => refreshSettings())
                );
            } else if (request.message.command === 'sync') {
                let chosenTabId = await findAsbplayerTab(sender.tab);
                await refreshAndPublishState();

                if (chosenTabId) {
                    const base64 = await fileUrlToBase64(request.message.subtitles.fileUrl);
                    URL.revokeObjectURL(request.message.subtitles.fileUrl);
                    chrome.tabs.sendMessage(Number(chosenTabId), {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'sync',
                            subtitles: {
                                name: request.message.subtitles.name,
                                base64: base64
                            }
                        },
                        tabId: sender.tab.id
                    });
                }
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
        } else if (request.sender === 'asbplayerv2') {
            if (request.tabId) {
                chrome.tabs.sendMessage(request.tabId, {
                    sender: 'asbplayer-extension-to-video',
                    message: request.message
                });
            } else if (request.message.command === 'heartbeat') {
                asbplayers[sender.tab.id] = {
                    tab: sender.tab,
                    id: request.message.id,
                    timestamp: Date.now()
                };
            }
        } else if (request.sender === 'asbplayer-popup') {
            refreshSettings();
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

async function refreshAndPublishState() {
    return new Promise((resolve, reject) => {
        const expired = Date.now() - 5000;

        for (const tabId in asbplayers) {
            const info = asbplayers[tabId];

            if (info.timestamp < expired) {
                delete asbplayers[tabId];
            }
        }

        const activeTabs = [];

        for (const tabId in videoTabs) {
            const info = videoTabs[tabId];

            if (info.timestamp < expired) {
                delete videoTabs[tabId];
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

            resolve();
        });
    });
}

setInterval(() => refreshAndPublishState(), 1000);
