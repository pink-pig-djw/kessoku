#!/bin/bash
# usage: run.sh BATCH [BATCH...]   — builds prompts and runs the batches in parallel (refs from batches.js)
cd /c/Users/13857/Desktop/galgame/kessoku
node tools/build.js "$@" > /dev/null
for b in "$@"; do
  refs=$(node -e "const B=require('./tools/prompts/batches.js');console.log(((B['$b']||{}).refs||[]).map(r=>'C:/Users/13857/Desktop/galgame/kessoku/'+r).join(' '))")
  bash tools/gen.sh "$b" $refs &
  sleep 3
done
wait
echo "ALL DONE: $*"
