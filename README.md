# asbplayer

A browser-based media player intended to assist subtitle sentence mining.

- Can sync subtitles with HTML5 video elements as long as the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/tag/v0.2.1) is installed.
- A best-effort is made to ensure that subtitles displayed in video elements are text-selectable and can be scanned by
  popup dictionary extensions like Yomi-chan.
- Supports playback of local video and audio files.
- Supports audio clipping of local audio and video files.
- Implements a clipboard history for asynchronous sentence mining.

asbplayer is hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

## Browser compatibility

- Only Chrome supports video playback.
- Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).


