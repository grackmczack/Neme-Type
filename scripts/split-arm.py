#!/usr/bin/env python3
"""Löst den linken Unterarm (Betrachter-Sicht) aus gen/nemesis8.webp als eigenes Bild gleicher Größe, damit das Intro ihn
zur Flasche ausstrecken kann. Aufruf: split-arm.py assets/gen/nemesis8.webp assets/gen/nemesis8-arm.webp"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGBA')
px = np.array(img).astype(int)
r, g, b, a = px[..., 0], px[..., 1], px[..., 2], px[..., 3]
skin = (a > 0) & (r > 140) & (g > 80) & (r - b > 45)
region = np.zeros(skin.shape, bool)
region[296:432, 0:112] = True
skin &= region
dark = (a > 0) & (np.maximum(np.maximum(r, g), b) < 75) & region
grown = ndimage.binary_dilation(skin, iterations=2)
# Außenkontur des Arms (links von x=56) komplett mitnehmen, die Körperkante am Rumpf (x>=56) bleibt stehen
outer = dark & (np.arange(skin.shape[1])[None, :] < 56)
mask = skin | (dark & grown) | outer
out = np.zeros_like(px)
out[mask] = px[mask]
Image.fromarray(out.astype(np.uint8), 'RGBA').save(dst, 'WEBP', lossless=True)
print(dst, int(mask.sum()), 'px')
