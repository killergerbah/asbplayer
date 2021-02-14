document.addEventListener('DOMContentLoaded', (e) => {
    const checkbox = document.getElementById('displaySubtitlesInput');
    checkbox.addEventListener('change', (e) => {
        chrome.storage.sync.set({displaySubtitles: checkbox.checked}, () => {
            chrome.runtime.sendMessage({
                sender: 'asbplayer-popup',
                message: {
                    command: 'settings-updated'
                }
            });
        });
    });

    chrome.storage.sync.get('displaySubtitles', (data) => {
        checkbox.checked = data.displaySubtitles;
    });
});