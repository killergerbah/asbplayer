import { fileUrlToBase64 } from './services/Base64';
import Recorder from './services/Recorder';

const videoElements = {};
const asbplayers = {};
const recorder = new Recorder();

function crop(dataUrl, rect) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get({cropScreenshot: true}, (data) => {
            if (!data.cropScreenshot) {
                resolve(dataUrl);
                return;
            }

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


function refreshSettings() {
    for (const id in videoElements) {
        chrome.tabs.sendMessage(videoElements[id].tab.id, {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'settings-updated'
            },
            src: videoElements[id].src
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
                videoElements[sender.tab.id + ':' + request.src] = {
                    tab: sender.tab,
                    src: request.src,
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
                        },
                        src: request.src
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
                            tabId: sender.tab.id,
                            src: request.src
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
                        src: request.src,
                        tabId: sender.tab.id
                    });
                }
            } else {
                chrome.tabs.query({}, (allTabs) => {
                    for (let t of allTabs) {
                        chrome.tabs.sendMessage(t.id, {
                            sender: 'asbplayer-extension-to-player',
                            message: request.message,
                            tabId: sender.tab.id,
                            src: request.src
                        });
                    }
                });
            }
        } else if (request.sender === 'asbplayer') {
            chrome.tabs.sendMessage(request.tabId, {
                sender: 'asbplayer-extension-to-video',
                message: request.message,
                src: request.src
            });
        } else if (request.sender === 'asbplayerv2') {
            if (request.tabId) {
                chrome.tabs.sendMessage(request.tabId, {
                    sender: 'asbplayer-extension-to-video',
                    message: request.message,
                    src: request.src
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
                for (const id in videoElements) {
                    if (videoElements[id].tab.id === tab.id) {
                        chrome.tabs.sendMessage(videoElements[id].tab.id, {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'copy-subtitle'
                            },
                            src: videoElements[id].src
                        });
                    }
                }
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

        for (const id in videoElements) {
            const info = videoElements[id];

            if (info.timestamp < expired) {
                delete videoElements[id];
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
