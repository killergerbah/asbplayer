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
    // A content script can outlive a development reload. In that brief period
    // the extension API object remains present but its storage namespace has
    // already been invalidated.
    const storage = browser.storage?.local;
    if (!storage) {
        return false;
    }

    try {
        const result = await storage.get({ [shouldShowKey]: false });
        const shouldShow = result ? result[shouldShowKey] : false;

        if (shouldShow) {
            await storage.remove(shouldShowKey);
            await storage.set({ [lastUpdateAlertVersionKey]: browser.runtime.getManifest().version });
        }

        return shouldShow;
    } catch {
        return false;
    }
};
