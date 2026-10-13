---
sidebar_position: 9
---

# Mining to Jiten {#mining-to-jiten}

Save words to Jiten with sentences, pictures, and audio from your videos. You don't need Anki.

## Setup {#setup}

1. Install Jiten Reader and [load subtitles](../getting-started/loading-subtitles) in asbplayer.
2. In asbplayer settings, set **Mining → Mining destination** to **Jiten**.
3. Open the **Jiten** tab. Copy your API key from [Jiten settings](https://jiten.moe/settings#:~:text=API%20Key) and paste it into **Jiten API key**.
4. Choose whether to attach pictures and audio. Both are on by default. Sending these files requires Jiten+ or an eligible trial.

For streaming videos, also turn on **Take screenshot when mining** and **Record audio when mining** under **Streaming video**.

## Save one word {#attach-context}

Mine a word with Jiten Reader in asbplayer's subtitles. asbplayer automatically adds the sentence, picture, and audio to that word. You don't need to click another mining button.

This is on by default. Existing pictures and audio won't be replaced.

### Review before sending {#attach-manually}

To check or edit the sentence first:

1. In **Jiten** settings, turn off **Automatically attach sentence and media when mining with Jiten Reader**.
2. Mine a word with Jiten Reader.
3. Set **Mining → Mining button default action** to **Show mining dialog**, then click **Mine Subtitle**.
4. Check the word, sentence, picture, and audio. Edit if needed.
5. Click **Attach to Jiten**.

## Save all new words in a subtitle {#mine-new-words}

1. Select a **Mining deck** in **Jiten** settings. Use the account settings link there if you need to create one.
2. Let Jiten Reader process the subtitle so you can look up its words.
3. Set the mining button's action to **Show mining dialog**, then click **Mine Subtitle** and **Mine new words to Jiten**.

This saves words that Jiten marks as new and that aren't already in your selected deck.

For one-click mining, set **Mining → Mining button default action** to **Mine new words to Jiten**.

## If something goes wrong {#limits-and-retries}

- **Text is too long:** shorten the sentence or source to 150 characters or fewer, including any `**` marks around the word.
- **File is too large:** shorten the clip or reduce the picture size. Each file must be 5 MiB or smaller.
- **An upload fails:** follow the message in the dialog and try again. Files already saved won't be replaced.

See [Jiten settings](../reference/settings#jiten) for more options.
