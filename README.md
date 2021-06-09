# asbplayer

A browser-based media player intended to assist subtitle sentence mining.

- Can sync subtitles with HTML5 video elements as long as the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/tag/latest) is installed.
- A best-effort is made to ensure that subtitles displayed in video elements are text-selectable and can be scanned by
  popup dictionary extensions like Yomi-chan.
- Supports playback of local video and audio files.
- Local video and audio files can be played in "condensed mode," skipping sections without subtitles.
- Supports audio-clipping/screenshotting of video and audio files.
- Supports audio-clipping/screenshotting of streaming video synced through the extension.
- Implements a copy history for asynchronous sentence mining.
- Supports creation of flashcards with audio/screenshot through AnkiConnect.

asbplayer is hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

## Usage
The below information can also be found in the application by clicking on the question mark button in the top right.

### Loading files
- Drag and drop mkv, srt, ass, or mp3 files into the player.
- Multiple files can be dragged and dropped simultaneously e.g. mkv+srt, mp3+ass, etc.

### Syncing with streaming video in another tab
- Install the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/tag/latest).
- Drag-and-drop a subtitle file into the video element you want to sync.
- Or, load a subtitle file into asbplayer
- Use the camera button in the bottom right.
- If the icon does not appear try refreshing the video in the other tab.
- It is recommended to use the extension keyboard shortcut (`Ctrl+Alt+Z` by default) to mine subtitles since that will include audio/screenshots. If the keyboard shortcut is not working for some reason try:
    - Uninstalling and reinstalling the extension and restarting Chrome.
    - Verifying the keyboard shortcut is bound as in this [video](https://youtu.be/wYWbgovfNlI).
    
### Anki
- Use the star button in the copy history.
- Audio/image will be exported only if an audio/image source was available when the subtitle was copied.
- Specifically, for synced streaming video, an audio/image will only be available if the extension keyboard shortcut was used (`Ctrl+Alt+Z` by default).
- Configure Anki settings with the settings button in the top right. See this [video](https://youtu.be/Mv7fEVb6PHo?t=44) for how to configure AnkiConnect so that asbplayer can connect to Anki.

### Changing subtitle offset
- Use `Ctrl+Left/Right` to cause the previous/next subtitle to appear at the current timestamp.
- Use `Ctrl+Shift+Left/Right` to adjust timing further by 100 ms increments.
- Or, click on the subtitle offset input field in the controls, type a number, and hit `Enter`.

### Condensed playback of local media files
- Load an audio/video file with a subtitle file.
- Use the speed gauge button in the bottom right.

### Keyboard shortcuts
|Keys        | Action              |
|------------|---------------------|
|Ctrl+Shift+A|Copy current subtitle|
|Ctrl+Shift+Z|Copy current subtitle (streaming video in another tab)|         
|Space|Play/pause|
|S|Toggle subtitles|
|Left/Right|Seek to previous/next subtitle|
|Ctrl+Left/Right|Adjust offset to previous/next subtitle
|Ctrl+Shift+Left/Right|Adjust offset by +/- 100ms|

### Demos

- [Sentence mining video files with asbplayer](https://www.youtube.com/watch?v=7v0Hly_Q_Bs)
- [Sentence mining streaming video with asbplayer](https://www.youtube.com/watch?v=m55HbFJMilk)
- [Sentence mining streaming video with asbplayer (drag and drop)](https://www.youtube.com/watch?v=kJXVVixD8H8)

### Browser compatibility

- The asbplayer application and the asbplayer extension has only been tested on Chrome 91 and later.
- The asbplayer application and the asbplayer extension may work on other Chromium-based browsers.
- Local video file playback is supported only for codecs supported by the browser.
- Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).

## Building and running
```
# Install yarn
npm install --global yarn

# Install dependencies
yarn

# Starts the devleopment server
yarn workspace @project/client run start 

# Build the extension to extension/dist
yarn workspace @project/extension buildDev 
```