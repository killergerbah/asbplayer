# asbplayer

A browser-based subtitle file player with features intended to assist language learning.

- Syncs subtitles with video playback in other tabs e.g. Netflix or CrunchyRoll as long as 
  the [extension](https://github.com/killergerbah/asbplayer/releases/tag/v0.1.0) is installed.
- When synced, allows seeking directly to target subtitles.
- Subtitles can be marked for sentence mining.
- Can playback and sync with local audio and video files, as long as the browser supports the file format.
- Supports audio clipping of local audio and video files.

Try it at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

## Browser compatibility

- The app has only been tested on Chrome version 88.
- Video playback likely doesn't work on any other browser than Chrome, as currently only `mkv` files are allowed, and
  Chrome is the only browser that I know of that supports `mkv` playback.
- Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).
 
![Player preview](https://i.imgur.com/JoFl6Lu.gif)


