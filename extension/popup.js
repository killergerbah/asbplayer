document.addEventListener('DOMContentLoaded', (e) => {
    const displaySubtitlesCheckbox = document.getElementById('displaySubtitlesInput');
    const recordAudioCheckbox = document.getElementById('recordAudioInput');
    const screenshotCheckbox = document.getElementById('screenshotInput');
    const cleanScreenshotCheckbox = document.getElementById('cleanScreenshotInput');
    const cropScreenshotCheckbox = document.getElementById('cropScreenshotInput');
    const bindKeysCheckbox = document.getElementById('bindKeysInput');
    const subsDragAndDropCheckbox = document.getElementById('subsDragAndDropInput');
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

    cropScreenshotCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({cropScreenshot: cropScreenshotCheckbox.checked}, () => notifySettingsUpdated());
    });

    bindKeysCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({bindKeys: bindKeysCheckbox.checked}, () => notifySettingsUpdated());
    });

    subsDragAndDropCheckbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({subsDragAndDrop: subsDragAndDropCheckbox.checked}, () => notifySettingsUpdated());
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
        cropScreenshot: true,
        bindKeys: true,
        subsDragAndDrop: true,
        subtitlePositionOffsetBottom: 100
    },
    (data) => {
        displaySubtitlesCheckbox.checked = data.displaySubtitles;
        recordAudioCheckbox.checked = data.recordMedia;
        screenshotCheckbox.checked = data.screenshot;
        cleanScreenshotCheckbox.checked = data.cleanScreenshot;
        cropScreenshotCheckbox.checked = data.cropScreenshot;
        bindKeysCheckbox.checked = data.bindKeys;
        subsDragAndDropCheckbox.checked = data.subsDragAndDrop;
        subtitlePositionOffsetBottomInput.value = data.subtitlePositionOffsetBottom;
    });

    chrome.commands.getAll((commands) => {
        for (const c of commands) {
            if (c.name === 'copy-subtitle') {
                let help;

                if (c.shortcut === '') {
                    help = 'Keyboard shortcut to copy subtitle is not bound.'
                } else {
                    help = c.shortcut + " copies current subtitle to asbplayer";
                }

                document.getElementById('help').innerHTML = help;
                break;
            }
        }
    });
});