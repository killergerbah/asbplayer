#!/bin/sh
set -eu

cd "$(dirname "$0")/asbplayer-addon"
zip -r ../asbplayer-addon.ankiaddon * -x '*__pycache__*'
