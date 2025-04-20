const shouldShowKey = 'shouldShowUpdateAlert';
const lastUpdateAlertVersionKey = 'lastUpdateAlertVersion';

export const enqueueUpdateAlert = async () => {
    const result = await chrome.storage.local.get(lastUpdateAlertVersionKey);
    const lastUpdateVersion = result && result[lastUpdateAlertVersionKey];

    if (lastUpdateVersion === chrome.runtime.getManifest().version) {
        return;
    }

    await chrome.storage.local.set({ [shouldShowKey]: true });
};

export const shouldShowUpdateAlert = async () => {
    const result = await chrome.storage.local.get({ [shouldShowKey]: false });
    const shouldShow = result ? result[shouldShowKey] : false;

    if (shouldShow) {
        await chrome.storage.local.remove(shouldShowKey);
        await chrome.storage.local.set({ [lastUpdateAlertVersionKey]: chrome.runtime.getManifest().version });
    }

    return shouldShow;
};
