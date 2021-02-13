const tabs = {};

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.sender === 'asbplayer-video') {
            if (request.message.command === 'heartbeat') {
                tabs[sender.tab.id] = {
                    tab: sender.tab,
                    src: request.message.src,
                    timestamp: Date.now()
                };
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
        }
    }
);

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({displaySubtitles: true});
});

chrome.action.onClicked.addListener((tab) => {
    chrome.storage.sync.get('displaySubtitles', (data) => {
        chrome.storage.sync.set({displaySubtitles: !data.displaySubtitles}, () => {
            for (const tabId in tabs) {
                chrome.tabs.sendMessage(tabs[tabId].tab.id, {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'settings-updated'
                    }
                });
            }
        });
    });
});

chrome.action.disable();

setInterval(() => {
    const expired = Date.now() - 5000;
    const activeTabs = [];

    for (const tabId in tabs) {
        const info = tabs[tabId];
        if (info.timestamp < expired) {
            chrome.action.disable(info.tab.id, () => {
                chrome.action.setBadgeText({
                    text: null,
                    tabId: info.tab.id
                });
                chrome.action.setTitle({
                    title: 'asbplayer',
                    tabId: info.tab.id
                });
            });

            delete tabs[tabId];
        } else {
            chrome.action.enable(info.tab.id, () => {
                chrome.action.setTitle({
                    title: 'Toggle subs',
                    tabId: info.tab.id
                });
            });
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