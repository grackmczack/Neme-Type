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
# Kanister: Schein per Flood-Fill von außen, Griff-Fenster (eingeschlossenes Grün) per globalem Key
convert "$RAW/bottle.png" -alpha set -fuzz 30% -fill none -draw "color 0,0 floodfill" -draw "color 1023,0 floodfill" -draw "color 0,1023 floodfill" -draw "color 1023,1023 floodfill" \
  -fuzz 25% -draw "color 610,585 floodfill" -trim +repage -resize 360x360 -quality 92 "$OUT/bottle.webp"
# Nemesis in 8 Bit: lokale Quelle (nicht im Repository). Der graue Kittel liegt farblich nah am Hintergrund,
# daher Komponenten-Analyse statt globalem Farb-Key (siehe scripts/key-sprite.py, braucht Python mit Pillow, numpy, scipy).
if [ -f assets/Nemesis-8bit.png ]; then
  python3 scripts/key-sprite.py assets/Nemesis-8bit.png "$OUT/nemesis8.webp" 93 78 131 24 0.5
  python3 scripts/split-arm.py "$OUT/nemesis8.webp" "$OUT/nemesis8-arm.webp"
fi
for n in 1 2 3 4; do
  convert "$RAW/bg$n.png" -resize 1280x640 -quality 85 "$OUT/bg$n.webp"
done
ls -la "$OUT"
