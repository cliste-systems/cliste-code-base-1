#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public"
SRC="${1:-$PUBLIC/s1c8e5t0.jpg}"

# Opaque output names — keep in sync with src/lib/public-assets.ts
SOURCE_OUT="$PUBLIC/s1c8e5t0.jpg"
OUT_2X_JPG="$PUBLIC/k3w9r1t5.jpg"
OUT_2X_WEBP="$PUBLIC/k3w9r1t5.webp"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source: $SRC"
  echo ""
  echo "Add your 3840×2160 export, then run:"
  echo "  npm run onboarding:background"
  echo ""
  echo "Or pass a path:"
  echo "  npm run onboarding:background -- ~/Downloads/coastal-4k.jpg"
  exit 1
fi

WIDTH=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/{print $2}')
HEIGHT=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/{print $2}')

echo "Source: ${WIDTH}×${HEIGHT}"
echo "  $SRC"

if [[ "$WIDTH" -lt 3840 ]]; then
  echo ""
  echo "Warning: width is ${WIDTH}px (need 3840×2160 native for a sharp full-screen background)."
  echo "Continuing anyway — output will be upscaled."
  echo ""
fi

cp "$SRC" "$SOURCE_OUT"

TMP_2X="$(mktemp /tmp/onboarding-2x.XXXXXX.jpg)"

# 2x — 3840px wide (retina / 4K)
sips --resampleWidth 3840 "$SOURCE_OUT" --out "$TMP_2X" >/dev/null
sips -s format jpeg -s formatOptions 90 "$TMP_2X" --out "$OUT_2X_JPG" >/dev/null

npx --yes sharp-cli -i "$OUT_2X_JPG" -o "$OUT_2X_WEBP" -f webp -q 92

rm -f "$TMP_2X"

echo ""
echo "Exported:"
for f in "$OUT_2X_JPG" "$OUT_2X_WEBP"
do
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
  size=$(ls -lh "$f" | awk '{print $5}')
  printf "  %s  %s×%s  %s\n" "$size" "$w" "$h" "$(basename "$f")"
done

echo ""
echo "Paths are defined in src/lib/public-assets.ts"
echo "Hard-refresh /onboarding to see the new background."
