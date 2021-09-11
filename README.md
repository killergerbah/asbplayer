# asbplayer

A browser-based media player intended to assist subtitle sentence mining.

- Can sync subtitle files with HTML5 video elements as long as the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/latest) is installed.
- A best-effort is made to ensure that subtitles displayed in video elements are text-selectable and can be scanned by
  popup dictionary extensions like Yomi-chan.
- Local media can be played in "condensed mode," skipping sections without subtitles.
- Supports creation of audio/screenshot Anki flashcards from both streaming video and local media through AnkiConnect.

asbplayer is hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

## Usage
The below information can also be found in asbplayer by clicking on the question mark button in the top right.

### Loading files
- Drag and drop mkv, srt, ass, or mp3 files into the player.
- Multiple files can be dragged and dropped simultaneously e.g. mkv+srt, mp3+ass, etc.
- Multiple subtitle files can loaded simultaneously. When multiple subtitle files are loaded, they can be toggled on and off in-video using `S+1`, `S+2`, etc.

### Syncing with streaming video in another tab
- Install the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/latest).
- Drag-and-drop a subtitle file into the video element you want to sync.
- Or, load a subtitle file into asbplayer and use the camera button in the bottom right.
- It is recommended to use an extension keyboard shortcut (`Ctrl+Shift+X` by default) to mine subtitles since that will include audio/screenshots.

### Anki
- Synchronous workflow:
    - For synced streaming video, open the Anki dialog during playback by using `Ctrl+Shift+X`.
    - For local file playback, open the Anki dialog during playback by using `Ctrl+Shift+Q`.
- Asynchronous workflow:
    - For synced streaming video, copy the current subtitle by using `Ctrl+Shift+Z`.
    - For local file playback, copy the current subtitle by using `Ctrl+Shift+A`.
    - Use the star button in the copy history of asbplayer to open the Anki dialog.
- For synced streaming video, an audio/image will only be available if an extension keyboard shortcut was used (`Ctrl+Shift+X` or `Ctrl+Shift+Z` by default).
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
|Ctrl+Shift+Q|Copy current subtitle and open Anki export dialog|
|Ctrl+Shift+Z|Copy current subtitle (streaming video in another tab)|
|Ctrl+Shift+X|Copy current subtitle and open Anki export dialog (streaming video in another tab)|     
|Space|Play/pause|
|S|Toggle subtitles|
|S+1, S+2...|Toggle subtitle track 1, 2... in video|
|D+1, D+2...|Toggle subtitle track 1, 2... in asbplayer|
|Left/Right|Seek to previous/next subtitle|
|Ctrl+Left/Right or Shift+Left/Right|Adjust offset to previous/next subtitle
|Ctrl+Shift+Left/Right|Adjust offset by +/- 100ms|

### Common issues
- asbplayer isn't detecting streaming video.
    - Try refreshing both the asbplayer tab and the video in the other tab.
    - Make sure that in the extension details, the extension has access to all sites.
      A lot of video players are loaded inside of iframes, so it's difficult to
      list every single URL that the extension might need access to.
- The extension keyboard shortcuts aren't working.
    - Try uninstalling and reinstalling the extension and restarting Chrome.
    - Make sure the extension isn't installed twice.
    - Verify the keyboard shortcut is bound as in this [video](https://youtu.be/wYWbgovfNlI).
- asbplayer can't connect to Anki. It shows an error message e.g. 'Failed to fetch.'
    - If you're using Brave, make sure asbplayer isn't being blocked by Shield.
    - Make sure that asbplayer is allowed by AnkiConnect, as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).
    - Check that your browser or an ad blocker isn't blocking the request. A good place to start is by opening your browser's developer console and looking for errors.
- asbplayer isn't including audio/screenshot in flashcards.
    - If you're mining streaming video make sure you use an extension keyboard shortcut (`Ctrl+Shift+X` by default).
### Demos

- [Sentence mining streaming video with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=W9Lf3C7sRzc)
- [Sentence mining streaming video with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=kJXVVixD8H8)
- [Sentence mining streaming video with asbplayer (no subtitle file)](https://www.youtube.com/watch?v=sgrJF99WX-Q)
- [Sentence mining video files with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=J3E82spYqIk)
- [Sentence mining video files with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=HsrrpnfM4pI)

### Browser compatibility

- The asbplayer application and extension have only been tested on Chrome 91 and later and likely work on other Chromium-based browsers.
- Local video file playback is supported only for codecs supported by the browser. The [animebook](https://github.com/animebook/animebook.github.io#video-format-support) readme has a detailed explanation of this and links
  to browsers that have good compatibility. Personally, I use Microsoft Edge and paid one dollar for HEVC support.
- Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).

## Building and running
```
# Install yarn
npm install --global yarn

# Install dependencies
yarn

# Starts the development server
yarn workspace @project/client run start 

# Build the extension to extension/dist
yarn workspace @project/extension buildDev 
```
