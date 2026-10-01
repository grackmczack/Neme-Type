#!/usr/bin/env bash
# Macht aus den Rohbildern (assets/gen/raw oder $RAW_DIR) spielfertige Assets in assets/gen/.
# Grüne Hintergründe werden per Flood-Fill freigestellt, Hintergründe verkleinert.
set -euo pipefail
RAW="${RAW_DIR:-assets/gen/raw}"
OUT="${OUT_DIR:-assets/gen}"
mkdir -p "$OUT"

key() { # name size fuzz [extra seed points "x,y x,y"]
  local name="$1" size="$2" fuzz="$3"; shift 3
  local w h; read -r w h <<<"$(identify -format "%w %h" "$RAW/$name.png")"
  local args=(-fuzz "$fuzz" -fill none)
  for p in "0,0" "$((w-1)),0" "0,$((h-1))" "$((w-1)),$((h-1))" "$@"; do args+=(-draw "color $p floodfill"); done
  convert "$RAW/$name.png" -alpha set "${args[@]}" -channel A -morphology Erode Disk:1 +channel \
    -trim +repage -resize "$size" -define webp:lossless=false -quality 92 "$OUT/$name.webp"
}
gkey() { # name size color fuzz: alle Pixel nahe der Hintergrundfarbe (auch eingeschlossene) werden transparent
  local name="$1" size="$2" color="$3" fuzz="$4"
  convert "$RAW/$name.png" -alpha set -fuzz "$fuzz" -transparent "$color" \
    -trim +repage -resize "$size" -quality 92 "$OUT/$name.webp"
}
key logo 900x "16%"
gkey boss1 420x420 "rgb(5,228,4)" "9%"
gkey boss2 420x420 "rgb(8,247,1)" "9%"
gkey boss3 420x420 "rgb(3,245,1)" "9%"
gkey boss4 420x420 "rgb(9,244,1)" "9%"
key panda 360x360 "20%"
key bottle 360x360 "20%"
for n in 1 2 3 4; do
  convert "$RAW/bg$n.png" -resize 1280x640 -quality 85 "$OUT/bg$n.webp"
done
ls -la "$OUT"
