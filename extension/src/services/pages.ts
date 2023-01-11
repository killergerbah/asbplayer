import pagesConfig from '../pages.json';

export function currentPageConfig() {
    const urlObj = new URL(window.location.href);

    for (const page of pagesConfig.pages) {
        const regex = new RegExp(page.host);

        if (regex.exec(urlObj.host) !== null) {
            return { url: urlObj, page };
        }
    }

    return { url: undefined, page: undefined };
}

export function loadPageScripts() {
    const { page } = currentPageConfig();

    if (page !== undefined) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(`pages/${page.script}`);
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
        return true;
    }

    return false;
}
