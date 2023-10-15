import { useEffect, useState } from 'react';
import { getTabRequestingActiveTabPermission } from '../../services/active-tab-permission-request';

export const useRequestingActiveTabPermission = () => {
    const [requestingActiveTabPermission, setRequestingActiveTabPermission] = useState<boolean>();

    useEffect(() => {
        const init = async () => {
            const tabRequestingActiveTabPermission = await getTabRequestingActiveTabPermission();

            if (tabRequestingActiveTabPermission === undefined) {
                setRequestingActiveTabPermission(false);
            } else {
                const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });

                if (currentTabs.length > 0 && currentTabs[0].id === tabRequestingActiveTabPermission) {
                    setRequestingActiveTabPermission(true);
                } else {
                    setRequestingActiveTabPermission(false);
                }
            }
        };

        init();
    }, []);

    return requestingActiveTabPermission;
};
