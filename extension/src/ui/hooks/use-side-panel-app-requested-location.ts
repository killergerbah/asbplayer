import { getAppRequestedLocation, onAppRequestedAppLocationChanged } from '@/services/side-panel';
import { SidePanelLocation } from '@project/common';
import { useEffect, useState } from 'react';

export const useSidePanelAppRequestedLocation = () => {
    const [appRequestedLocation, setAppRequestedLocation] = useState<SidePanelLocation>();

    useEffect(() => {
        getAppRequestedLocation().then(setAppRequestedLocation);
        return onAppRequestedAppLocationChanged(setAppRequestedLocation);
    }, []);

    return { appRequestedLocation };
};
