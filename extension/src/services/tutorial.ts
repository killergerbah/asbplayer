export const isOnTutorialPage = () => {
    return window.location.href === browser.runtime.getURL('/ftue-ui.html');
};
