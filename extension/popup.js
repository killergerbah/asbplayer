document.addEventListener('DOMContentLoaded', (e) => {
    const displaySubtitlesCheckbox = document.getElementById('displaySubtitlesInput');
    const recordAudioCheckbox = document.getElementById('recordAudioInput');

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

    chrome.storage.sync.get(['displaySubtitles', 'recordMedia'], (data) => {
        displaySubtitlesCheckbox.checked = data.displaySubtitles;
        recordAudioCheckbox.checked = data.recordMedia;
    });
});