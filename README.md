# asbplayer

**asbplayer** is a browser-based media player and Chrome extension developed for language learners who learn their target language through subtitled media. With asbplayer, you can:

-   **Easily create high-quality flashcards** out of subtitled videos.
-   **Load text-selectable subtitles onto most video sources**, including streaming sources.
-   **Extract subtitles from popular streaming services** like Netflix and YouTube.
-   **Seek through subtitles** using a **navigable subtitle list**.
-   **Focus your learning** on subtitled sections of media using **playback modes** such as:
    -   **Condensed playback**: Only play subtitled sections of a video.
    -   **Fast-forward playback**: Fast-forward through unsubtitled sections of video.
    -   **Auto-pause**: Automatically pause at the beginning or end of every subtitle.
-   **Customizable keyboard shortcuts** to access most of asbplayer's features, including subtitle navigation.

## Thanks

Thank you to all of my sponsors:

-   [@vivekchoksi](https://www.github.com/vivekchoksi)
-   [@nzarbayezid](https://www.github.com/nzarbayezid)
-   [@ManuJapan](https://www.github.com/ManuJapan)
-   AdamM
-   realgoodsmiley
-   Alex
-   [@m4eko](https://github.com/m4eko)
-   Simon
-   Attenius
-   medyas
-   [@zaerald](https://github.com/zaerald)

... and to those who have donated privately.

Thank you to all those who have contributed to asbplayer:

-   [@Renji-XD](https://www.github.com/Renji-XD)
-   [@MatiasIslaA](https://www.github.com/MatiasIslaA)
-   [@cyphar](https://www.github.com/cyphar)
-   [@alexbofa](https://www.github.com/alexbofa)
-   [@Zyphdoz](https://github.com/Zyphdoz)
-   [@Zyphdoz](https://github.com/Zyphdoz)
-   [@artjomsR](https://github.com/artjomsR)

Thank you to all those who have translated asbplayer:

-   Mana Tsutsumi (Japanese, initial translation)
-   Kai Böse (German)
-   Triline (Polish)
-   NeverWinterSwor (Simplified Chinese)
-   Yagxter (Brazilian Portuguese)

If you are a non-English native, and would like to help translate asbplayer, please contact me on [Discord](https://discord.gg/ad7VAQru7m).

## Getting Started

First, see if you can get started with one of the [community guides](#community-guides).

Otherwise, the following steps will work for any language:

1. Install a dictionary for your target language that allows you to do instant lookups. Popular ones are [Yomichan](https://chrome.google.com/webstore/detail/yomichan/ogmnaimimemjmbakcfefmnahgdfhfami) for Japanese and [VocabSieve](https://github.com/FreeLanguageTools/vocabsieve) for European languages.
2. Install [Anki](https://apps.ankiweb.net/), and create a deck and note type.
3. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) plugin for Anki.
4. [Configure](https://killergerbah.github.io/asbplayer/?view=settings) asbplayer to create cards via AnkiConnect using your deck and note type.

5. Enhance a video using asbplayer and subtitle files.

    - **For streaming video:** After installing the [Chrome extension](https://github.com/killergerbah/asbplayer/releases/latest), drag-and-drop a subtitle file into the streaming video you want to mine.
    - **For local files:** Drag-and-drop media/subtitle files into the [asbplayer website](https://killergerbah.github.io/asbplayer).

    You may have to [adjust the subtitle offset](#adjusting-subtitle-offset) to get the subtitles in sync.

6. When a subtitle appears that you want to mine, use <kbd>Ctrl + Shift + X</kbd> to open the flashcard creator.
7. Fill in the definition and word fields and then export the card. To fill in the definition field you may use the dictionary you installed in step 1.

## Community guides

-   [Shiki's Lazy Sentence Mining Workflow (Japanese)](https://docs.google.com/document/d/e/2PACX-1vQuEAoZFoJbULZzCJ3_tW7ayT_DcQl9eDlrXMnuPGTwDk62r5fQrXak3ayxBsEgkL85_Z-YY5W4yUom/pub)
-   [Sentence mining from Netflix and YouTube with asbplayer (Japanese)](https://soyuz18.notion.site/Sentence-mining-from-Netflix-and-YouTube-with-asbplayer-83a03590cd8349ba81ca10340645b565)
-   [Refold's installation guide](https://www.youtube.com/watch?v=Pv4Sp01Uh64)
-   [Refold's sentence mining guide (Japanese + European languages)](https://www.youtube.com/watch?v=jXO4gmCmcNE)
-   [Sentence Mining: Learning Japanese From Anime (Japanese)](https://www.youtube.com/watch?v=B60cj69MSmA)

## Demos

-   [3 ways to mine streaming video with asbplayer](https://www.youtube.com/watch?v=HrIJZ6cUMFw)
-   [Sentence mining a video file with asbplayer](https://www.youtube.com/watch?v=BSr_JusW8E8)

## Detailed usage

### Enhancing streaming video with asbplayer features

Install the Chrome [extension](https://github.com/killergerbah/asbplayer/releases/latest). There are three ways to enhance streaming video with asbplayer:

1. Drag-and-drop a subtitle file into the video element you want to enhance.
2. Load a subtitle file into the [asbplayer website](https://killergerbah.github.io/asbplayer/) and click on the camera in the bottom right to pick a video element to enhance. This is the recommended way to load BluRay subtitle files onto streaming video.
3. Use <kbd>Ctrl + Shift + F</kbd> to select a video element to enhance. From the dialog that appears you can choose whether to load an [auto-detected subtitle track](#subtitle-track-detection-for-streaming-video) or an empty one.

asbplayer features will then be accessible for that video.

### Enhancing local video files with asbplayer features

Drag-and-drop media and subtitle files into the [asbplayer website](https://killergerbah.github.io/asbplayer/) to load them. asbplayer features will then be accessible for those files.

### Keyboard shortcuts

Keyboard shortcuts are customizable from the [asbplayer website settings](https://killergerbah.github.io/asbplayer/?view=settings#keyboard-shortcuts). Once asbplayer has been bound to a video, you can use the keyboard shortcuts to access most of asbplayer's features.

### Creating Anki flashcards

Make sure [Anki](https://apps.ankiweb.net/) and [AnkiConnect](https://ankiweb.net/shared/info/2055492159) are installed. Integration with AnkiConnect can be configured in the [settings](https://killergerbah.github.io/asbplayer/?view=settings) as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).

When a subtitle that you want to mine appears, <kbd>Ctrl + Shift + X</kbd> opens the flashcard creator.

### Adjusting Anki flashcards

All text fields can be edited from the flashcard creator prior to flashcard creation.

Adjust the selected time interval for the card using the slider at the bottom of the export dialog.
The newly selected time interval can be applied to the card using the buttons availablbe in the sentence and audio sections of the card. See this [video](https://youtu.be/BSr_JusW8E8?t=34) for a demo.

### Adjusting subtitle offset

Use <kbd>Ctrl + Left/Right</kbd> to adjust subtitle offset so that the previous/next subtitle appears at the current timestamp. Then use <kbd>Ctrl + Shift + Left/Right</kbd> for finer adjustment by 100ms increments.

If you are using the asblayer website, you can also use the "Subtitle Offset" text field available in the controls UI.

### Subtitle track detection for streaming video

Use <kbd>Ctrl + Shift + F</kbd> to see auto-detected subtitle tracks for streaming video. Below are the sites where automatic subtitle detection is supported:

-   Netflix
-   Youtube
-   Disney Plus (known issue: subtitles sometimes off by ~5 seconds)
-   Hulu
-   TVer
-   Bandai Channel
-   Amazon Prime (known issue: subtitles sometimes off by ~30 seconds)

<kbd>Ctrl + Shift + F</kbd> also allows you to load an empty subtitle track so that you can extract audio and screenshots from streaming video without loading subtitles.

### Audio track selection for mkv files

An audio track selector will appear for `mkv` files if experimental web platform features are enabled from `chrome://flags`. Note that enabling this flag may cause issues with other features of asbplayer, such as card creation through the Chrome extension.

## Common issues

### asbplayer can't connect to Anki. It shows an error message e.g. 'Failed to fetch.'

-   If you're using Brave, make sure asbplayer isn't being blocked by Shield.
-   Make sure that asbplayer is allowed by AnkiConnect, as in this [video](https://youtu.be/Mv7fEVb6PHo?t=44).
-   Make sure that the origin you add to the AnkiConnect settings is exactly `https://killergerah.github.io` (and not `https://killergerah.github.io/asbplayer`).
-   Check that your browser or an ad blocker isn't blocking the request. A good place to start is by opening your browser's developer console and looking for errors.
-   As of this writing enabling experimental web platform features is known to cause this issue. Try disabling this flag from `chrome://flags`.
-   On later versions of macOS, AnkiConnect will not respond when Anki is backgrounded. See "Notes for MacOS Users" on the [AnkiConnect developer's website](https://foosoft.net/projects/anki-connect/).

### When using the 'update last card' feature, the card does not update in Anki.

-   Make sure Anki's card browser is closed when using 'update last card.' There is a [known issue](https://github.com/FooSoft/anki-connect/issues/82) with AnkiConnect where cards will not appear to update when the card browser is open.

### When loading a local file asbplayer either shows a black screen, or doesn't play audio.

-   See the [Browser Compatibility](#browser-compatibility) section.

### asbplayer isn't detecting streaming video.

-   Try refreshing both the asbplayer tab and the video in the other tab.
-   Make sure that in the extension details, the extension has access to all sites.

### Keyboard shortcuts aren't working.

-   Check the the [keyboard shortcut settings](https://killergerbah.github.io/asbplayer/?view=settings#keyboard-shortcuts).
-   If you are using the extension:
    -   Check `chrome://extensions/shortcuts`.
    -   Try refreshing the page and loading subtitles again.
    -   Try uninstalling and reinstalling the extension, and restarting Chrome.
    -   Make sure the extension isn't installed twice.

### asbplayer isn't including audio/screenshot in flashcards.

-   If you're mining streaming video via the Chrome extension, make sure that the streaming video tab is selected and in the foreground when you use a mining keyboard shortcut

### asbplayer isn't properly cropping screenshots from streaming video.

-   Make sure the browser zoom setting is at 100%.
-   You can disable cropping altogether using the extension settings menu.

## Browser compatibility

The asbplayer application and extension have only been tested on the latest version Chrome and likely work on other Chromium-based browsers.

Local video file playback is supported only for codecs supported by the browser. The [animebook](https://github.com/animebook/animebook.github.io?tab=readme-ov-file#video-format-support-last-update-january-2023) readme has a detailed explanation of this and links to browsers that have good compatibility.

## Contributing

Pull requests are welcome! However, to reduce back-and-forth during review ideally consult with me on the corresponding issue or on [Discord](https://discord.gg/ad7VAQru7m) before attempting changes to UI/UX. When making changes, format code according to the Prettier config and attempt to match the style of surrounding code.

## Building and running

```
# Install yarn
npm install --global yarn

# Make sure you're on yarn 3
yarn set version 3.2.0

# Install dependencies
yarn

# Starts the development server for the website
yarn workspace @project/client run start

# Build the extension to extension/dist
yarn workspace @project/extension buildDev
```

If you have problems building try deleting `node_modules` and re-running `yarn`.

## Contact

Submit bugs or feature requests from the [issues page](https://github.com/killergerbah/asbplayer/issues). Join the [Discord](https://discord.gg/ad7VAQru7m) server to talk with me and other language learners.

## Donations

If you've benefited from asbplayer, please consider supporting my work via [Github Sponsors](https://github.com/sponsors/killergerbah?frequency=one-time) or [Ko-fi](https://ko-fi.com/killergerbah).
