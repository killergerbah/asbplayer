# asbplayer

A browser-based media player intended to assist subtitle sentence mining.

- Can sync subtitles with HTML5 video elements as long as the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/tag/latest) is installed.
- A best-effort is made to ensure that subtitles displayed in video elements are text-selectable and can be scanned by
  popup dictionary extensions like Yomi-chan.
- Supports playback of local video and audio files.
- Supports audio clipping of video and audio files.
- Supports audio clipping of streaming video synced through the extension.
- Implements a clipboard history for asynchronous sentence mining.
- Supports flashcard creation through AnkiConnect. Flashcards created from local video and audio files, or from streaming video using the extension with audio-recording enabled, will include clipped audio.

asbplayer is hosted at [https://killergerbah.github.io/asbplayer/](https://killergerbah.github.io/asbplayer/).

## Demos

- [Sentence mining video files with asbplayer](https://www.youtube.com/watch?v=Khipc3zLMiA)
- [Sentence mining streaming video with asbplayer](https://www.youtube.com/watch?v=fau1BNNDrEQ)

## Browser compatibility

- Tested on Chrome 88 and Firefox 86.
- Only Chrome supports video playback, and only for supported video and audio codecs.
- Audio track selection for `mkv` files is available if experimental web platform features are enabled from [chrome://flags](chrome://flags).
