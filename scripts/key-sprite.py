#!/usr/bin/env python3
"""Stellt eine Figur mit einfarbigem Hintergrund frei: entfernt alle zusammenhängenden Flächen in Hintergrundfarbe
(auch eingeschlossene Lücken und den Bodenschatten), ohne farblich ähnliche Figurenteile (grauer Kittel) anzutasten.
Aufruf: key-sprite.py EIN.png AUS.webp R G B [Toleranz] [Skalierung]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
bg = np.array([int(v) for v in sys.argv[3:6]], dtype=float)
tol = float(sys.argv[6]) if len(sys.argv) > 6 else 24
scale = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5

img = Image.open(src).convert('RGBA')
px = np.array(img).astype(float)
dist = np.sqrt(((px[..., :3] - bg) ** 2).sum(axis=2))
near = dist < tol
labels, count = ndimage.label(near)
sizes = ndimage.sum(near, labels, index=np.arange(1, count + 1))
remove = np.zeros_like(near)
for i, size in enumerate(sizes, start=1):
    if size >= 150:  # große Flächen: Hintergrund, Lücken, Schatten; Kleinkram gehört zur Figur
        remove |= labels == i
# Bodenschatten: dunklerer Ton derselben Farbfamilie, zusammenhängend mit dem Hintergrund
shadow = (dist < tol * 3.2) & ~near & (np.abs(px[..., 0] - px[..., 2] * 0.72) < 24) & (px[..., 2] > px[..., 0] + 12) & (px[..., 1] < px[..., 2] - 12)
slabels, scount = ndimage.label(shadow)
ssizes = ndimage.sum(shadow, slabels, index=np.arange(1, scount + 1))
for i, size in enumerate(ssizes, start=1):
    if size >= 400:
        remove |= slabels == i
remove = ndimage.binary_dilation(remove, iterations=1) & (dist < tol * 3.2)
px[remove, 3] = 0
out = Image.fromarray(px.astype(np.uint8), 'RGBA')
out = out.crop(out.getbbox())
out = out.resize((round(out.width * scale), round(out.height * scale)), Image.NEAREST)
out.save(dst, 'WEBP', lossless=True)
print(dst, out.size)
