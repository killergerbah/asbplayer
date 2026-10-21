# Anki add-on for one-click mining support

## Requirements

- At least Anki 25.02 for Qt6 support (https://github.com/ankitects/anki/releases/tag/25.02)

## To manually install the add-on:

1. In Anki, go to Tools -> Add-ons -> View Files
2. Copy/paste the asbplayer-addon folder into this directory
3. Restart Anki

## Development setup

The add-on only ever runs inside Anki, which supplies `aqt`, `anki` and `PyQt6` itself. To
get type checking and editor completion for those APIs while working on it outside of Anki,
in this directory run:

```sh
uv sync
```

This creates `.venv/` containing the Anki and Qt packages. The type checker is configured
under `[tool.basedpyright]` in `pyproject.toml`. The dependencies in `.venv/` are only for
type checking. If dependencies not included in Anki are needed, they need to be vendored
into the `asbplayer-addon/` folder before zipping/publishing the add-on.

## To zip and publish the add-on:

1. Create ankiaddon file:

```sh
./package.sh
```

2. Create a release on GitHub: https://github.com/asbplayer/asbplayer/releases

3. Upload to AnkiWeb: https://ankiweb.net/shared/upload

(https://addon-docs.ankiweb.net/sharing.html)
