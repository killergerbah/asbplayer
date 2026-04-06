import { SidePanelLocation } from '@project/common';

const appRequestedLocationKey = 'sidePanelAppRequestedLocation';

export const setAppRequestedLocation = async (location: SidePanelLocation) => {
    await browser.storage.local.set({ [appRequestedLocationKey]: location });
};

export const getAppRequestedLocation = async (): Promise<SidePanelLocation | undefined> => {
    const value = (await browser.storage.local.get(appRequestedLocationKey))?.[appRequestedLocationKey];
    return value as SidePanelLocation | undefined;
};

export const onAppRequestedAppLocationChanged = (callback: (location?: SidePanelLocation) => void) => {
    const listener = (changes: { [key: string]: Browser.storage.StorageChange }) => {
        for (const key of Object.keys(changes)) {
            if (key === appRequestedLocationKey && changes[key].newValue !== undefined) {
                callback(changes[key].newValue as SidePanelLocation);
            }
        }
    };
    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
};
