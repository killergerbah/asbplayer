const shouldShowKey = 'shouldShowUpdateAlert';
const lastUpdateAlertVersionKey = 'lastUpdateAlertVersion';

export const enqueueUpdateAlert = async () => {
    const result = await browser.storage.local.get(lastUpdateAlertVersionKey);
    const lastUpdateVersion = result && result[lastUpdateAlertVersionKey];

    if (lastUpdateVersion === browser.runtime.getManifest().version) {
        return;
    }

    await browser.storage.local.set({ [shouldShowKey]: true });
};

export const shouldShowUpdateAlert = async () => {
    const result = await browser.storage.local.get({ [shouldShowKey]: false });
    const shouldShow = result ? result[shouldShowKey] : false;

    if (shouldShow) {
        await browser.storage.local.remove(shouldShowKey);
        await browser.storage.local.set({ [lastUpdateAlertVersionKey]: browser.runtime.getManifest().version });
    }

    return shouldShow;
};
