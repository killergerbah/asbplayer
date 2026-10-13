---
sidebar_position: 8
---

# One-click mining {#one-click-mining}

For Jiten, select **Mining → Mining destination → Jiten**, then choose either workflow:

- Mine an individual word with Jiten Reader. [Automatic sentence and media attachment](./jiten#attach-context) is enabled by default, so no additional asbplayer mining click is needed.
- Choose [**Mine new words to Jiten**](./jiten#mine-new-words) as the mining button's default action to mine all qualifying new words in a Reader-parsed subtitle with one click.

The instructions below cover Anki and Yomitan.

asbplayer is great at connecting subtitle and video content to AnkiConnect, but is not able to automatically provide word definitions on its own. For this reason, most sentence mining flows require at two or three mouse or keyboard inputs from the user.

One-click mining is possible if asbplayer is combined with another application that:

- supplies the missing word definition information, and
- already integrates with AnkiConnect.

[Yomitan](https://yomitan.wiki/) is an example of one such application.

## Install and configure Yomitan {#install-and-configure-yomitan}

Follow the directions on [Yomitan's website](https://yomitan.wiki/) to install Yomitan and configure it with a dictionary for your target language.

## Run asbplayer's AnkiConnect proxy {#run-asbplayers-ankiconnect-proxy}

Follow the [WebSocket server guide](./web-socket-server) to setup an AnkiConnect proxy that allows asbplayer to enrich AnkiConnect cards before they finally reach AnkiConnect.

## Point Yomitan at the proxy {#point-yomitan-at-the-proxy}

Configure Yomitan:

- The AnkiConnect URL should point at the AnkiConnect proxy rather than AnkiConnect. The default proxy URL is `http://127.0.0.1:8766`.
- Yomitan should be using the same **Note Type** as asbplayer.

To always use asbplayer's subtitle text for the Sentence field, enable [**Always use subtitle text for sentence field**](../reference/settings#always-use-subtitle-text-for-sentence-field) under **Mining** settings. This replaces the sentence text supplied by Yomitan with the mined subtitle text from all tracks.

## Mine with **Yomitan** as usual {#mine-with-yomitan-as-usual}

Mining sentences using Yomitan will create cards with word definition, image, and audio already provided. A truly one-click mining flow can be achieved if the proxy's `POST_MINE_ACTION` is `2` (update last card).
