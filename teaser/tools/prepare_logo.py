"""Cut the POST251 logo painting into the layers the teaser animates.

Usage: python3 tools/prepare_logo.py <logo.(png|webp)>

Outputs (assets/):
  logo2x.png        the painting upscaled 2x (Lanczos + light unsharp) for macro shots
  logo_unlit.png    same, with the gold lettering dimmed to unlit bronze (back layer)
  letters.png       only the gold lettering, on transparency (for ignition/glow)
  layer_mid.png     gold strip + key slip  (middle, feathered top edge)
  layer_keys.png    keys                   (front, feathered top edge)
  glyphs.json       per-glyph boxes in 2x pixel space
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
S = 2  # upscale factor

im = Image.open(src).convert("RGB")
W, H = im.size
big = im.resize((W * S, H * S), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
big.save("assets/logo2x.png", optimize=True)

a = np.asarray(big).astype(np.float32) / 255.0
R, G, B = a[..., 0], a[..., 1], a[..., 2]


def ramp(x, lo, hi):
    return np.clip((x - lo) / (hi - lo), 0, 1)


# Lettering key: the wood is dark in green, the leaf (incl. its pale highlights) is not.
gold = ramp(G, 0.47, 0.60) * ramp(R, 0.58, 0.72)
band = np.zeros_like(gold)
band[290 * S:448 * S, 100 * S:910 * S] = 1.0  # lettering only; excludes the gold strip
alpha = gold * band
m = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
alpha = np.asarray(m).astype(np.float32) / 255.0

letters = np.dstack([a, alpha])
Image.fromarray((letters * 255).astype(np.uint8), "RGBA").save("assets/letters.png", optimize=True)

# Unlit: pull the lettering toward a dark lacquered bronze.
unlit_col = np.array([0.30, 0.13, 0.08], np.float32)
lum = (0.3 * R + 0.59 * G + 0.11 * B)[..., None]
dim = unlit_col * (0.55 + 0.9 * lum)
k = np.clip(alpha * 1.15, 0, 1)[..., None]
unlit = a * (1 - k) + dim * k
Image.fromarray((np.clip(unlit, 0, 1) * 255).astype(np.uint8)).save("assets/logo_unlit.png", optimize=True)


def slice_layer(y0, y1, feather, name):
    y0p, y1p = y0 * S, y1 * S
    crop = a[y0p:y1p]
    h = crop.shape[0]
    al = np.ones(h, np.float32)
    f = feather * S
    if f and y0 > 0:
        al[:f] = np.linspace(0, 1, f) ** 1.5
    if f and y1 < H:
        al[-f:] = np.linspace(1, 0, f) ** 1.5
    rgba = np.dstack([crop, np.broadcast_to(al[:, None], crop.shape[:2])])
    Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(f"assets/{name}.png", optimize=True)
    return {"y0": y0p, "y1": y1p}


layers = {
    "mid": slice_layer(500, 710, 26, "layer_mid"),
    "keys": slice_layer(672, 1000, 26, "layer_keys"),
}


# Glyph x-ranges measured from the lettering mask's column projection (1x space).
glyph_x = {"P": (112, 202), "O": (206, 354), "S": (368, 462), "T": (464, 566),
           "2": (602, 710), "5": (722, 826), "1": (856, 902)}
glyphs = {}
for g, (x0, x1) in glyph_x.items():
    sub = alpha[:, x0 * S:x1 * S]
    ys = np.nonzero(sub.max(1) > 0.3)[0]
    glyphs[g] = {"x0": x0 * S, "x1": x1 * S, "y0": int(ys.min()), "y1": int(ys.max())}

json.dump({"size": W * S, "glyphs": glyphs, "layers": layers}, open("assets/glyphs.json", "w"), indent=1)
print(json.dumps(glyphs))
