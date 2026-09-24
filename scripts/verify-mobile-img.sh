#!/usr/bin/env bash
# Post-deploy / TestFlight battery check for GET /api/mobile/v1/img
# Run after the nextjs /img route is live. Does not push or deploy.
set -euo pipefail

API="${API_BASE:-https://www.insidekarachi.com/api/mobile/v1}"
SAMPLE="${SAMPLE_SPACES_URL:-https://insidekhi.sgp1.cdn.digitaloceanspaces.com/peekaboo/83555/c97ca91cb5769096a5bdb21732c25992.jpeg}"
W="${W:-400}"
ENC_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$SAMPLE")
PROXY="$API/img?url=$ENC_URL&w=$W"

echo "== 1) Proxy must return 200 image/jpeg (not 403/404/415) =="
HDR=$(mktemp)
BODY=$(mktemp)
CODE=$(curl -sS -D "$HDR" -o "$BODY" -w '%{http_code}' "$PROXY")
CTYPE=$(awk -F': ' 'tolower($1)=="content-type" {print $2}' "$HDR" | tr -d '\r' | head -1)
SIZE=$(wc -c < "$BODY" | tr -d ' ')
echo "status=$CODE content-type=$CTYPE bytes=$SIZE"
test "$CODE" = "200"
echo "$CTYPE" | grep -qi 'image/jpeg'
# Sized feed JPEGs should be well under 500KB; originals are often multi-MB.
test "$SIZE" -lt 500000

echo "== 2) CDN cache headers present =="
grep -qiE '^(CDN-Cache-Control|Vercel-CDN-Cache-Control|Cache-Control):' "$HDR"

echo "== 3) Second fetch should be a CDN HIT (or at least 200 + small) =="
HDR2=$(mktemp)
CODE2=$(curl -sS -D "$HDR2" -o /dev/null -w '%{http_code}' "$PROXY")
test "$CODE2" = "200"
# Vercel may expose x-vercel-cache: HIT
if grep -qiE '^x-vercel-cache:[[:space:]]*HIT' "$HDR2"; then
  echo "x-vercel-cache: HIT"
else
  echo "(no x-vercel-cache HIT yet — cold or non-Vercel edge; body still OK)"
  cat "$HDR2" | tr -d '\r' | grep -iE 'cache|age|x-vercel' || true
fi

echo "== 4) Proxyman / TestFlight checklist =="
cat <<'EOF'
On a Release/TestFlight build after /img is live:
  - Scroll Home ~15 minutes
  - Proxyman: feed photos should be GET .../api/mobile/v1/img?w=...
  - Bodies small (~tens of KB); no multi-MB digitaloceanspaces.com GETs for rails
  - Failures show blank/initials — never a second request to the Spaces original
EOF

rm -f "$HDR" "$BODY" "$HDR2"
echo OK
