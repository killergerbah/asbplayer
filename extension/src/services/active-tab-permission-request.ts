const key = 'tabRequestingActiveTabPermission';

export const getTabRequestingActiveTabPermission = async () => {
    const savedTab = (await chrome.storage.session.get(key))[key];

    if (savedTab === undefined) {
        return undefined;
    }

    const currentTabInfo = await tabInfo(savedTab.id);

    if (currentTabInfo === undefined || currentTabInfo.url !== savedTab.url) {
        await chrome.storage.session.remove(key);
        return undefined;
    }

    return savedTab.id;
};

export const setRequestingActiveTabPermission = async (tabId: number, requesting: boolean) => {
    if (requesting) {
        const tab = await tabInfo(tabId);

        if (tab === undefined) {
            await chrome.storage.session.remove(key);
        } else {
            await chrome.storage.session.set({ [key]: { id: tabId, url: tab.url } });
        }
    } else {
        await chrome.storage.session.remove(key);
    }
};

const tabInfo = async (tabId: number) => {
    return (await chrome.tabs.query({})).find((t) => t.id === tabId);
};
