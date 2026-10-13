#!/usr/bin/env bash
# Split remaining food multi-branch parents one at a time (resilient to DB drops).
# Usage: bash scripts/run-food-split-loop.sh [max_parents]
set -uo pipefail
cd "$(dirname "$0")/.."
MAX="${1:-50}"
DONE=0
FAILS=0
while (( DONE < MAX )); do
  echo ""
  echo "======== food split iteration $((DONE+1))/$MAX ========"
  if ! npx tsx scripts/split-multi-branch-listings.ts --food --limit=1 --apply; then
    FAILS=$((FAILS + 1))
    echo "FAILED (streak=$FAILS) — sleeping 10s and retrying"
    sleep 10
    if (( FAILS >= 5 )); then
      echo "Too many consecutive failures — stopping."
      exit 1
    fi
    continue
  fi
  FAILS=0
  DONE=$((DONE + 1))
  sleep 3

  REMAINING=$(npx tsx scripts/count-food-multi-branch.ts 2>/dev/null || echo "?")
  echo "Remaining food multi-branch: $REMAINING"
  if [[ "$REMAINING" == "0" ]]; then
    echo "Queue empty."
    break
  fi
done
echo "Done $DONE parents this run."
