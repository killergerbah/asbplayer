import { useEffect, useState } from 'react';

export const useCurrentTabId = () => {
    const [currentTabId, setCurrentTabId] = useState<number>();

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs.length > 0) {
                setCurrentTabId(tabs[0].id);
            }
        });
    }, []);

    useEffect(() => {
        const listener = (info: chrome.tabs.TabActiveInfo) => setCurrentTabId(info.tabId);
        chrome.tabs.onActivated.addListener(listener);
        return () => chrome.tabs.onActivated.removeListener(listener);
    });

    return currentTabId;
};
