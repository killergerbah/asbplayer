const shouldShowKey = 'shouldShowUpdateAlert';
const lastUpdateAlertVersionKey = 'lastUpdateAlertVersion';

export const enqueueUpdateAlert = async () => {
    const lastUpdateVersion = (await chrome.storage.local.get(lastUpdateAlertVersionKey))[lastUpdateAlertVersionKey];

    if (lastUpdateVersion === chrome.runtime.getManifest().version) {
        return;
    }

    await chrome.storage.local.set({ [shouldShowKey]: true });
};

export const shouldShowUpdateAlert = async () => {
    const shouldShow = (await chrome.storage.local.get({ [shouldShowKey]: false }))[shouldShowKey];

    if (shouldShow) {
        await chrome.storage.local.remove(shouldShowKey);
        await chrome.storage.local.set({ [lastUpdateAlertVersionKey]: chrome.runtime.getManifest().version });
    }

    return shouldShow;
};
