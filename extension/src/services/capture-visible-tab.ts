export const captureVisibleTab = async (tabId: number): Promise<string> => {
    const tab = await chrome.tabs.get(tabId);
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 100 });
};
