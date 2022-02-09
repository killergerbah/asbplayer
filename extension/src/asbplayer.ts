window.addEventListener('message', (event) => {
    if (event.source !== window) {
        return;
    }

    if (event.data.sender === 'asbplayer' || event.data.sender === 'asbplayerv2') {
        chrome.runtime.sendMessage({
            sender: event.data.sender,
            message: event.data.message,
            tabId: event.data.tabId,
            src: event.data.src,
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.sender === 'asbplayer-extension-to-player') {
        window.postMessage(request, '*');
    }
});

const manifest = chrome.runtime.getManifest();

window.addEventListener('DOMContentLoaded', (e) => {
    window.postMessage({
        sender: 'asbplayer-extension-to-player',
        message: {
            command: 'version',
            version: manifest.version,
        },
    }, "*");
});
