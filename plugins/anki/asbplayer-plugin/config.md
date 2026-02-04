# asbplayer Plugin Configuration

Configure the WebSocket server for one-click mining with asbplayer.

## Settings

- **port**: WebSocket server port (default: `8766`). Must match the asbplayer extension's "WebSocket server URL" setting. The URL format is `ws://localhost:<port>`.

- **postMineAction**: Action to perform after mining a word:
    - `0` = None
    - `1` = Open Anki dialog
    - `2` = Update last card (default)
    - `3` = Export card

## Usage

1. Install this addon in Anki
2. In the asbplayer browser extension settings, set the WebSocket server URL to `ws://localhost:8766`
3. When you add a card in Anki (e.g., via Yomitan), asbplayer will automatically update it with the captured audio/screenshot
