# asbplayer
A browser-based media player for subtitle sentence mining. Combine subtitles and media extracted from streaming or local video sources to create media-rich Anki flashcards.

asbplayer is hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

If you've benefited from asbplayer please consider supporting my work by [buying me a coffee](https://github.com/sponsors/killergerbah?frequency=one-time) ❤️. You can also talk with me and other language learners on [Discord](https://discord.gg/ad7VAQru7m).

## Usage

### Loading files
Drag-and-drop media and subtitle files into the asbplayer window to load them.

### Syncing with streaming video in another tab
Install the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/latest). There are two ways to sync streaming video with asbplayer:

1. Drag-and-drop a subtitle file into the video element you want to sync.
2. Load a file into asbplayer and click on the camera in the bottom right to pick a video element to sync. This is the recommended way to load BluRay subtitle files onto streaming video.

### Anki
Integration with AnkiConnect can be configured in the settings as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).

`Ctrl+Shift+X` (default bind) for streaming video or `Ctrl+Shift+Q` for local media files opens the Anki export dialog.

`Ctrl+Shift+Z` (default bind) for streaming video or `Ctrl+Shift+A` for local media files will mine the current subtitle without opening the Anki export dialog. Cards can later be exported for these subtitles by opening the copy history in asbplayer.

### Changing subtitle offset
`Ctrl+Left/Right` will adjust subtitle offset so that the previous/next subtitle appears at the current timestamp. `Ctrl+Shift+Left/Right` will adjust offset by 100 ms increments.

You can also adjust offset manually by clicking on the text field in the controls, typing a number, and pressing `Enter`.

### Subtitle track detection for streaming video
`Ctrl+Shift+F` (default bind) will show detected subtitle tracks for streaming video. Below are the sites where automatic subtitle detection is supported:
1. Netflix (on main /watch url)
2. Youtube (on main /watch url)
   
`Ctrl+Shift+F` also allows you to choose an empty subtitle track so that you can mine streaming video without subtitles.


### Keyboard shortcuts
| Keys                                      | Action                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Shift+A`                            | Copy current subtitle                                                                                                           |
| `Ctrl+Shift+Q`                            | Copy current subtitle and open Anki export dialog                                                                               |
| `Ctrl+Shift+Z` (default, streaming video) | Copy current subtitle<br>When video is synced without a subtitle file, starts/stops recording audio                             |
| `Ctrl+Shift+X` (default, streaming video) | Copy current subtitle and open Anki export dialog<br>When video is synced without a subtitle file, starts/stops recording audio |
| `Ctrl+Shift+F` (default, streaming video) | Select video element to mine without a subtitle file, or with detected subtitles on supported sites                             |
| `Space`                                   | Play/pause                                                                                                                      |
| `S`                                       | Toggle subtitles                                                                                                                |
| `S+1, S+2...`                             | Toggle subtitle track 1, 2... in video                                                                                          |
| `W+1, W+2...`                             | Toggle subtitle track 1, 2... in asbplayer                                                                                      |
| `A/D`                                     | Seek backward/forward by 10 seconds                                                                                             |
| `Left/Right`                              | Seek to previous/next subtitle                                                                                                  |
| `Down`                                    | Seek to beginning of current subtitle                                                                                           |
| `Ctrl+Left/Right` or `Shift+Left/Right`   | Adjust offset to previous/next subtitle                                                                                         |
| `Ctrl+Shift+Left/Right`                   | Adjust offset by +/- 100ms                                                                                                      |

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
    - If you're mining streaming video make sure you use an extension keyboard shortcut (`Ctrl+Shift+X` by default) from the tab with the streaming video.
### Demos

- [Sentence mining streaming video with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=W9Lf3C7sRzc)
- [Sentence mining streaming video with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=kJXVVixD8H8)
- [Sentence mining streaming video with asbplayer (no subtitle file)](https://www.youtube.com/watch?v=sgrJF99WX-Q)
- [Sentence mining video files with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=BSr_JusW8E8)
- [Sentence mining video files with asbplayer (synchronous workflow using Yomichan export)](https://www.youtube.com/watch?v=J3E82spYqIk)
- [Sentence mining video files with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=HsrrpnfM4pI)

### Browser compatibility

The asbplayer application and extension have only been tested on Chrome 100 and later and likely work on other Chromium-based browsers.

Local video file playback is supported only for codecs supported by the browser. The [animebook](https://github.com/animebook/animebook.github.io#video-format-support) readme has a detailed explanation of this and links  to browsers that have good compatibility. Personally, I use Microsoft Edge and paid one dollar for HEVC support.

Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).

## Contributing

Pull requests are welcome! However, to reduce back-and-forth during review ideally consult with me on the corresponding issue or on [Discord](https://discord.gg/ad7VAQru7m) before attempting changes to UI/UX.  Format code according to the Prettier config and attempt to match the style of surrounding code.

## Building and running
```
# Install yarn
npm install --global yarn

# Make sure you're on yarn 3
yarn set version berry && yarn set version canary 

# Install dependencies
yarn

# Starts the development server
yarn workspace @project/client run start 

# Build the extension to extension/dist
yarn workspace @project/extension buildDev 
```

If you have problems building try deleting `node_modules` and re-running `yarn`.
