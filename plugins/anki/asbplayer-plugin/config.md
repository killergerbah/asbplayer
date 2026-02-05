# asbplayer Plugin Configuration

Configure the WebSocket server for one-click mining with asbplayer.

## Settings

- **port**: WebSocket server port (default: `8766`). Must match asbplayer's "WebSocket Server URL" setting (in misc settings). The URL format is `ws://127.0.0.1:<port>/ws`.

- **postMineAction**: Action to perform after mining a word:
    - `0` = None
    - `1` = Open Anki dialog
    - `2` = Update last card (default)
    - `3` = Export card
