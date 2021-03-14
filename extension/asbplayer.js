window.addEventListener('message', (event) => {
    if (event.source !== window) {
        return;
    }

    if (event.data.sender === 'asbplayer') {
        chrome.runtime.sendMessage({
            sender: event.data.sender,
            message: event.data.message,
            tabId: event.data.tabId
        });
    }
});

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-extension-to-player') {
            window.postMessage(request , '*');
        }
    }
);

window.addEventListener('DOMContentLoaded', (e) => {
    window.postMessage({
        sender: 'asbplayer-extension-to-player',
        message: {
            command: 'version',
            version: '0.4.2'
        }
    });
});
