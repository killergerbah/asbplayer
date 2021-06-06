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

## Demos

- [Sentence mining video files with asbplayer](https://www.youtube.com/watch?v=7v0Hly_Q_Bs)
- [Sentence mining streaming video with asbplayer](https://www.youtube.com/watch?v=m55HbFJMilk)
- [Sentence mining streaming video with asbplayer (drag and drop)](https://www.youtube.com/watch?v=kJXVVixD8H8)

## Guides

- [Sentence mining streaming workflow](https://learnjapanese.moe/streamworkflow/)

## Browser compatibility

- The asbplayer application and the asbplayer extension has only been tested and Chrome 91 and later.
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