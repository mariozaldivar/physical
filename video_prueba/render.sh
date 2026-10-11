#!/usr/bin/env bash
# Uso: render.sh <frame_index>  — renderiza un frame con fondo transparente
i=$1; t=$(awk "BEGIN{printf \"%.5f\", $i/24}")
cd "$(dirname "$0")"
google-chrome-stable --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --default-background-color=00000000 --window-size=1920,1080 \
  --force-device-scale-factor=1 --virtual-time-budget=1500 \
  --user-data-dir="$(mktemp -d -p "$PWD" .chrome.XXXX)" \
  --screenshot="frames/f$(printf %04d "$i").png" \
  "file://$PWD/scene.html?t=$t" >/dev/null 2>&1
