document.addEventListener('DOMContentLoaded', (e) => {
    const displaySubtitlesCheckbox = document.getElementById('displaySubtitlesInput');
    const recordAudioCheckbox = document.getElementById('recordAudioInput');
    const screenshotCheckbox = document.getElementById('screenshotInput');
    const cleanScreenshotCheckbox = document.getElementById('cleanScreenshotInput');
    const subtitlePositionOffsetBottomInput = document.getElementById('subtitlePositionOffsetBottomInput');

    function notifySettingsUpdated() {
        chrome.runtime.sendMessage({
            sender: 'asbplayer-popup',
            message: {
                command: 'settings-updated'
            }
        });
    }

    displaySubtitlesCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({displaySubtitles: displaySubtitlesCheckbox.checked}, () => notifySettingsUpdated());
    });

    recordAudioCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({recordMedia: recordAudioCheckbox.checked}, () => notifySettingsUpdated());
    });

    screenshotCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({screenshot: screenshotCheckbox.checked}, () => notifySettingsUpdated());
    });

    cleanScreenshotCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({cleanScreenshot: cleanScreenshotCheckbox.checked}, () => notifySettingsUpdated());
    });

    subtitlePositionOffsetBottomInput.addEventListener('change', (e) => {
        const offset = Number(subtitlePositionOffsetBottomInput.value);
        chrome.storage.sync.set({subtitlePositionOffsetBottom: offset}, () => notifySettingsUpdated());
    });

    chrome.storage.sync.get({
        displaySubtitles: true,
        recordMedia: true,
        screenshot: true,
        cleanScreenshot: true,
        subtitlePositionOffsetBottom: 100
    },
    (data) => {
        displaySubtitlesCheckbox.checked = data.displaySubtitles;
        recordAudioCheckbox.checked = data.recordMedia;
        screenshotCheckbox.checked = data.screenshot;
        cleanScreenshotCheckbox.checked = data.cleanScreenshot;
        subtitlePositionOffsetBottomInput.value = data.subtitlePositionOffsetBottom;
    });
});