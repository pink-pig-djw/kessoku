#!/bin/bash
# usage: gen.sh <batch_name> [ref images...]
# runs codex (gpt-6-sol, medium) on tools/prompts/<batch>.txt -> tools/out/<batch>.json (last message) + .log, then collects images
cd /c/Users/13857/Desktop/galgame/kessoku
B="$1"; shift
IMGARGS=()
for f in "$@"; do IMGARGS+=(-i "$f"); done
start=$(date +%s)
codex exec --skip-git-repo-check -s read-only -m gpt-6-sol -c model_reasoning_effort='"medium"' "${IMGARGS[@]}" -C "C:/Users/13857/Desktop/galgame/kessoku" -o "tools/out/$B.json" - < "tools/prompts/$B.txt" > "tools/out/$B.log" 2>&1
echo "[$B] exit $? in $(( $(date +%s) - start ))s"
node tools/collect.js "$B"
