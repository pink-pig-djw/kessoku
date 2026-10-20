#!/bin/bash
# usage: restyle.sh [-j N] name1 name2 ...  — 用旧背景做参考，重画成动漫画风（并行 N 个，默认 6）
cd /c/Users/13857/Desktop/galgame/kessoku
J=6; if [ "$1" = "-j" ]; then J=$2; shift 2; fi
node tools/restyle.js "$@"
printf '%s\n' "$@" | xargs -P "$J" -I{} bash tools/gen.sh "R_{}" "C:/Users/13857/Desktop/galgame/kessoku/assets/_bg_photo_backup/{}.png"
echo "RESTYLE DONE: $*"
