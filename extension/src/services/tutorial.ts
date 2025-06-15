export const isOnTutorialPage = () => {
    return window.location.href.startsWith(browser.runtime.getURL('/ftue-ui.html'));
};
