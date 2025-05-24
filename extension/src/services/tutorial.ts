const tutorialUrls = [browser.runtime.getURL('/ftue-ui.html'), browser.runtime.getURL('/tutorial-ui.html')];

export const isOnTutorialPage = () => {
    return tutorialUrls.includes(window.location.href);
};
