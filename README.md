# asbplayer

A browser-based media player for subtitle sentence mining, hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/). Combine subtitles and media extracted from streaming or local video sources to create media-rich Anki flashcards.

Talk with me and other language learners on [Discord](https://discord.gg/ad7VAQru7m).

## Supporters
Thank you to all of my sponsors:
[@vivekchoksi](https://www.github.com/vivekchoksi)
[@nzarbayezid](https://www.github.com/nzarbayezid)

If you've benefited from asbplayer, please consider [supporting my work](https://github.com/sponsors/killergerbah?frequency=one-time) ❤️.

## Usage

### Loading files
Drag-and-drop media and subtitle files into the asbplayer window to load them.

### Syncing with streaming video
Install the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/latest). There are two ways to sync streaming video with asbplayer:

1. Drag-and-drop a subtitle file into the video element you want to sync.
2. Load a file into asbplayer and click on the camera in the bottom right to pick a video element to sync. This is the recommended way to load BluRay subtitle files onto streaming video.

### Creating Anki flashcards
Integration with AnkiConnect can be configured in the settings as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).

<kbd>Ctrl+Shift+X</kbd> (default bind) for streaming video or <kbd>Ctrl+Shift+Q</kbd> for local media files opens the Anki export dialog.

<kbd>Ctrl+Shift+Z</kbd> (default bind) for streaming video or <kbd>Ctrl+Shift+A</kbd> for local media files will mine the current subtitle without opening the Anki export dialog. Cards can later be exported for these subtitles by opening the copy history in asbplayer.

### Adjusting Anki flashcards

All text fields can be edited before exporting an Anki flashcard.

To adjust audio or subtitle selection, adjust the selected time interval for the card using the slider at the bottom of the export dialog.
The newly selected time interval can be applied using the checkmark buttons in either the sentence or audio fields. See this [video](https://youtu.be/BSr_JusW8E8?t=34) for a demo of this.


### Changing subtitle offset
<kbd>Ctrl+Left/Right</kbd> will adjust subtitle offset so that the previous/next subtitle appears at the current timestamp. <kbd>Ctrl+Shift+Left/Right</kbd> will adjust offset by 100 ms increments.

You can also adjust offset manually by clicking on the text field in the controls, typing a number, and pressing <kbd>Enter</kbd>.

### Subtitle track detection for streaming video
<kbd>Ctrl+Shift+F</kbd> (default bind) will show detected subtitle tracks for streaming video. Below are the sites where automatic subtitle detection is supported:
- Netflix (on main /watch url)
- Youtube (on main /watch url)
   
<kbd>Ctrl+Shift+F</kbd> also allows you to choose an empty subtitle track so that you can mine streaming video without subtitles.

### Audio track selection for mkv files

An audio track selector will appear for `mkv` files if experimental web platform features are enabled from `chrome://flags`.

### Keyboard shortcuts
| Keys                                                      | Action                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| <kbd>Ctrl+Shift+A</kbd>                                   | Copy current subtitle                                                                                                           |
| <kbd>Ctrl+Shift+Q</kbd>                                   | Copy current subtitle and open Anki export dialog                                                                               |
| <kbd>Ctrl+Shift+Z</kbd> (default, streaming video)        | Copy current subtitle<br>When video is synced without a subtitle file, starts/stops recording audio                             |
| <kbd>Ctrl+Shift+X</kbd> (default, streaming video)        | Copy current subtitle and open Anki export dialog<br>When video is synced without a subtitle file, starts/stops recording audio |
| <kbd>Ctrl+Shift+F</kbd> (default, streaming video)        | Select video element to mine without a subtitle file, or with detected subtitles on supported sites                             |
| <kbd>Space</kbd>                                          | Play/pause                                                                                                                      |
| <kbd>S</kbd>                                              | Toggle subtitles                                                                                                                |
| <kbd>S+1, S+2...</kbd>                                    | Toggle subtitle track 1, 2... in video                                                                                          |
| <kbd>W+1, W+2...</kbd>                                    | Toggle subtitle track 1, 2... in asbplayer                                                                                      |
| <kbd>A/D</kbd>                                            | Seek backward/forward by 10 seconds                                                                                             |
| <kbd>Left/Right</kbd>                                     | Seek to previous/next subtitle                                                                                                  |
| <kbd>Down</kbd>                                           | Seek to beginning of current subtitle                                                                                           |
| <kbd>Ctrl+Left/Right</kbd> or <kbd>Shift+Left/Right</kbd> | Adjust offset to previous/next subtitle                                                                                         |
| <kbd>Ctrl+Shift+Left/Right</kbd>                          | Adjust offset by +/- 100ms                                                                                                      |

## Common issues
### asbplayer isn't detecting streaming video.
- Try refreshing both the asbplayer tab and the video in the other tab.
- Make sure that in the extension details, the extension has access to all sites.
A lot of video players are loaded inside of iframes, so it's difficult to
know every single URL that the extension might need access to.

### The extension keyboard shortcuts aren't working.
- Try uninstalling and reinstalling the extension and restarting Chrome.
- Make sure the extension isn't installed twice.
- Verify the keyboard shortcuts are bound as in this [video](https://youtu.be/wYWbgovfNlI).
  
### asbplayer can't connect to Anki. It shows an error message e.g. 'Failed to fetch.'
- If you're using Brave, make sure asbplayer isn't being blocked by Shield.
- Make sure that asbplayer is allowed by AnkiConnect, as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).
- Check that your browser or an ad blocker isn't blocking the request. A good place to start is by opening your browser's developer console and looking for errors.

### asbplayer isn't including audio/screenshot in flashcards.
- If you're mining streaming video make sure you use an extension keyboard shortcut (<kbd>Ctrl+Shift+X</kbd> by default) from the tab with the streaming video.

## Demos

- [Sentence mining streaming video with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=W9Lf3C7sRzc)
- [Sentence mining streaming video with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=kJXVVixD8H8)
- [Sentence mining streaming video with asbplayer (no subtitle file)](https://www.youtube.com/watch?v=sgrJF99WX-Q)
- [Sentence mining video files with asbplayer (synchronous workflow)](https://www.youtube.com/watch?v=BSr_JusW8E8)
- [Sentence mining video files with asbplayer (synchronous workflow using Yomichan export)](https://www.youtube.com/watch?v=J3E82spYqIk)
- [Sentence mining video files with asbplayer (asynchronous workflow)](https://www.youtube.com/watch?v=HsrrpnfM4pI)

## Community guides

- [Shiki's Lazy Sentence Mining Workflow](https://docs.google.com/document/d/e/2PACX-1vQuEAoZFoJbULZzCJ3_tW7ayT_DcQl9eDlrXMnuPGTwDk62r5fQrXak3ayxBsEgkL85_Z-YY5W4yUom/pub)
- [Sentence mining from Netflix and YouTube with asbplayer](https://soyuz18.notion.site/Sentence-mining-from-Netflix-and-YouTube-with-asbplayer-83a03590cd8349ba81ca10340645b565)

## Browser compatibility

The asbplayer application and extension have only been tested on Chrome 101 and later and likely work on other Chromium-based browsers.

Local video file playback is supported only for codecs supported by the browser. The [animebook](https://github.com/animebook/animebook.github.io#video-format-support) readme has a detailed explanation of this and links  to browsers that have good compatibility. Personally, I use Microsoft Edge and paid one dollar for HEVC support.

## Contributing

Pull requests are welcome! However, to reduce back-and-forth during review ideally consult with me on the corresponding issue or on [Discord](https://discord.gg/ad7VAQru7m) before attempting changes to UI/UX.  When making changes, format code according to the Prettier config and attempt to match the style of surrounding code.

Thank you to all those who have contributed to this project:
[@Renji-XD](https://www.github.com/Renji-XD)
[@MatiasIslaA](https://www.github.com/MatiasIslaA)
[@cyphar](https://www.github.com/cyphar)

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
