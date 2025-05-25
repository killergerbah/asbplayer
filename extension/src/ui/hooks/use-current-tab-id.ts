import { useEffect, useState } from 'react';

export const useCurrentTabId = () => {
    const [currentTabId, setCurrentTabId] = useState<number>();

    useEffect(() => {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs.length > 0) {
                setCurrentTabId(tabs[0].id);
            }
        });
    }, []);

    useEffect(() => {
        const listener = (info: Browser.tabs.TabActiveInfo) => setCurrentTabId(info.tabId);
        browser.tabs.onActivated.addListener(listener);
        return () => browser.tabs.onActivated.removeListener(listener);
    });

    return currentTabId;
};
