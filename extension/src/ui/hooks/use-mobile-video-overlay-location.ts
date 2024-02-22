import { useEffect, useState } from 'react';

export interface Location {
    tabId: number;
    src: string;
}

export const useMobileVideoOverlayLocation = () => {
    const [location, setLocation] = useState<Location>();

    useEffect(() => {
        const init = async () => {
            const tabs = await chrome.tabs.query({ active: true });

            if (tabs.length === 0 || !tabs[0].id) {
                return;
            }

            const src = new URLSearchParams(window.location.search).get('src');

            if (!src) {
                return;
            }

            setLocation({ src, tabId: tabs[0].id });
        };
        init();
    }, []);

    return location;
};
