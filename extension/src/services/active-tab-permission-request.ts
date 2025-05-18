const key = 'tabRequestingActiveTabPermission';

export const getTabRequestingActiveTabPermission = async () => {
    const result = await browser.storage.session.get(key);
    const savedTab = result ? result[key] : undefined;

    if (savedTab === undefined) {
        return undefined;
    }

    const currentTabInfo = await tabInfo(savedTab.tabId);

    if (currentTabInfo === undefined || currentTabInfo.url !== savedTab.url) {
        await browser.storage.session.remove(key);
        return undefined;
    }

    return { tabId: savedTab.tabId, src: savedTab.src };
};

export const setRequestingActiveTabPermission = async (tabId: number, src: string, requesting: boolean) => {
    if (requesting) {
        const tab = await tabInfo(tabId);

        if (tab === undefined) {
            await browser.storage.session.remove(key);
        } else {
            await browser.storage.session.set({ [key]: { tabId, src, url: tab.url } });
        }
    } else {
        await browser.storage.session.remove(key);
    }
};

const tabInfo = async (tabId: number) => {
    return await browser.tabs.get(tabId);
};
