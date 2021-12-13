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
    const preferredSubLanguagesInput = document.getElementById('preferredSubLanguagesInput');
    const autoSelectPreferredSubLanguageCheckbox = document.getElementById('autoSelectPreferredSubLanguageInput');
    const autoSyncSubtitlesCheckbox = document.getElementById('autoSyncSubtitlesInput');
    const keepPauseAfterSubSyncCheckbox = document.getElementById('keepPauseAfterSubSyncInput');
    const subtitlePositionOffsetBottomInput = document.getElementById('subtitlePositionOffsetBottomInput');

    function notifySettingsUpdated() {
        chrome.runtime.sendMessage({
            sender: 'asbplayer-popup',
            message: {
                command: 'settings-updated',
            },
        });
    }

    displaySubtitlesCheckbox.addEventListener('change', async (e) => {
        await settings.set({ displaySubtitles: displaySubtitlesCheckbox.checked });
        notifySettingsUpdated();
    });

    recordAudioCheckbox.addEventListener('change', async (e) => {
        await settings.set({ recordMedia: recordAudioCheckbox.checked });
        notifySettingsUpdated();
    });

    screenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({ screenshot: screenshotCheckbox.checked });
        notifySettingsUpdated();
    });

    cleanScreenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({ cleanScreenshot: cleanScreenshotCheckbox.checked });
        notifySettingsUpdated();
    });

    cropScreenshotCheckbox.addEventListener('change', async (e) => {
        await settings.set({ cropScreenshot: cropScreenshotCheckbox.checked });
        notifySettingsUpdated();
    });

    bindKeysCheckbox.addEventListener('change', async (e) => {
        await settings.set({ bindKeys: bindKeysCheckbox.checked });
        notifySettingsUpdated();
    });

    subsDragAndDropCheckbox.addEventListener('change', async (e) => {
        await settings.set({ subsDragAndDrop: subsDragAndDropCheckbox.checked });
        notifySettingsUpdated();
    });

    preferredSubLanguagesInput.addEventListener('change', async () => {
        preferredSubLanguagesInput.value = preferredSubLanguagesInput.value.replaceAll(/ /g, '');
        await settings.set({ preferredSubLanguages: preferredSubLanguagesInput.value });
        notifySettingsUpdated();
    });

    autoSelectPreferredSubLanguageCheckbox.addEventListener('change', async () => {
        await settings.set({ autoSelectPreferredSubLanguage: autoSelectPreferredSubLanguageCheckbox.checked });
        notifySettingsUpdated();
    });

    autoSyncSubtitlesCheckbox.addEventListener('change', async () => {
        await settings.set({ autoSyncSubtitles: autoSyncSubtitlesCheckbox.checked });
        notifySettingsUpdated();
    });

    keepPauseAfterSubSyncCheckbox.addEventListener('change', async () => {
        await settings.set({ keepPauseAfterSubSync: keepPauseAfterSubSyncCheckbox.checked });
        notifySettingsUpdated();
    });

    subtitlePositionOffsetBottomInput.addEventListener('change', async (e) => {
        const offset = Number(subtitlePositionOffsetBottomInput.value);
        await settings.set({ subtitlePositionOffsetBottom: offset });
        notifySettingsUpdated();
    });

    asbplayerUrlInput.addEventListener('change', async (e) => {
        await settings.set({ asbplayerUrl: asbplayerUrlInput.value });
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
    preferredSubLanguagesInput.value = currentSettings.preferredSubLanguages;
    autoSelectPreferredSubLanguageCheckbox.checked = currentSettings.autoSelectPreferredSubLanguage;
    autoSyncSubtitlesCheckbox.checked = currentSettings.autoSyncSubtitles;
    keepPauseAfterSubSyncCheckbox.checked = currentSettings.keepPauseAfterSubSync;
    subtitlePositionOffsetBottomInput.value = currentSettings.subtitlePositionOffsetBottom;
    asbplayerUrlInput.value = currentSettings.asbplayerUrl;

    chrome.commands.getAll((commands) => {
        let help = [];

        for (const c of commands) {
            if (c.name === 'copy-subtitle') {
                if (c.shortcut === '') {
                    help.push('Copy command is not bound.');
                } else {
                    help.push(c.shortcut + ' copies subtitle to asbplayer.');
                }
            }

            if (c.name === 'copy-subtitle-with-dialog') {
                if (c.shortcut === '') {
                    help.push('Copy-with-dialog command is not bound.');
                } else {
                    help.push(c.shortcut + ' copies subtitle to asbplayer and opens Anki dialog.');
                }
            }

            if (c.name === 'toggle-video-select') {
                if (c.shortcut === '') {
                    help.push('Video-select command is not bound.');
                } else {
                    help.push(
                        c.shortcut +
                            " enables selection of a video to mine without a subtitle file. Once a video is selected, either of the 'copy' shortcuts will start and stop recording."
                    );
                }
            }

            if (c.name === 'sync-external-subtitle') {
                if (c.shortcut === '') {
                    help.push('Subtitle Sync command is not bound.');
                } else {
                    help.push(
                        c.shortcut +
                            ' allows to sync Subtitles from supported Web Pages without the need of local Files or Downloads.'
                    );
                }
            }
        }

        document.getElementById('help').innerHTML = help.join('<hr>');
    });
});
