import Settings from './services/Settings';

document.addEventListener('DOMContentLoaded', async (e) => {
    const settings = new Settings();
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

    displaySubtitlesCheckbox.addEventListener('change', async (e) => {
        await settings.set({displaySubtitles: displaySubtitlesCheckbox.checked});
        notifySettingsUpdated();
    });

    recordAudioCheckbox.addEventListener('change', async (e) => {
        await settings.set({recordMedia: recordAudioCheckbox.checked});
        notifySettingsUpdated();
    });

    screenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({screenshot: screenshotCheckbox.checked});
        notifySettingsUpdated();
    });

    cleanScreenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({cleanScreenshot: cleanScreenshotCheckbox.checked});
        notifySettingsUpdated();
    });

    cropScreenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({cropScreenshot: cropScreenshotCheckbox.checked});
        notifySettingsUpdated();
    });

    bindKeysCheckbox.addEventListener('change', async (e) => {
        await settings.set({bindKeys: bindKeysCheckbox.checked});
        notifySettingsUpdated();
    });

    subsDragAndDropCheckbox.addEventListener('change', async (e) => {
        await settings.set({subsDragAndDrop: subsDragAndDropCheckbox.checked});
        notifySettingsUpdated();
    });

    subtitlePositionOffsetBottomInput.addEventListener('change', async (e) => {
        const offset = Number(subtitlePositionOffsetBottomInput.value);
        await settings.set({subtitlePositionOffsetBottom: offset});
        notifySettingsUpdated();
    });

    const currentSettings = await settings.get();
    displaySubtitlesCheckbox.checked = currentSettings.displaySubtitles;
    recordAudioCheckbox.checked = currentSettings.recordMedia;
    screenshotCheckbox.checked = currentSettings.screenshot;
    cleanScreenshotCheckbox.checked = currentSettings.cleanScreenshot;
    cropScreenshotCheckbox.checked = currentSettings.cropScreenshot;
    bindKeysCheckbox.checked = currentSettings.bindKeys;
    subsDragAndDropCheckbox.checked = currentSettings.subsDragAndDrop;
    subtitlePositionOffsetBottomInput.value = currentSettings.subtitlePositionOffsetBottom;

    chrome.commands.getAll((commands) => {
        for (const c of commands) {
            if (c.name === 'copy-subtitle') {
                let help;

                if (c.shortcut === '') {
                    help = 'Copy command is not bound.'
                } else {
                    help = c.shortcut + " copies current subtitle to asbplayer";
                }

                document.getElementById('help').innerHTML = help;
                break;
            }
        }
    });
});