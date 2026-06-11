#!/usr/bin/env python3
"""Render an animated GIF per animation state from the bundled sprite sheet.

Used for the README gallery. Re-run after replacing assets/sprites/cat.png:

    python3 scripts/generate-readme-anims.py

Frame counts, row order, and durations mirror src/cat/sprites.js (STATE_ROWS).
Output: docs/anims/<state>.gif
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, "assets", "sprites", "cat.png")
OUT_DIR = os.path.join(ROOT, "docs", "anims")

FRAME = 32
SCALE = 4  # 32px frames -> 128px GIFs

# Keep in sync with STATE_ROWS in src/cat/sprites.js
STATE_ROWS = [
    ("idle",     4, 200),
    ("walk",     6, 100),
    ("knead",    4, 150),
    ("overheat", 4, 80),
    ("sleep",    3, 400),
    ("wake",     5, 120),
    ("pet",      3, 200),
    ("hunt",     4, 80),
    ("drag",     3, 100),
    ("scroll",   3, 100),
    ("yawn",     5, 150),
    ("stretch",  6, 140),
    ("sit",      4, 250),
    ("dance",    6, 110),
    ("play",     5, 100),
]

TRANSPARENT_INDEX = 255


def to_palette(frame_rgba):
    """Quantize an RGBA frame to P mode with a binary-transparency index."""
    alpha = frame_rgba.split()[3]
    p = frame_rgba.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=255)
    mask = Image.eval(alpha, lambda a: 255 if a <= 128 else 0)
    p.paste(TRANSPARENT_INDEX, mask)
    return p


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    os.makedirs(OUT_DIR, exist_ok=True)

    for row, (name, count, duration) in enumerate(STATE_ROWS):
        frames = []
        for col in range(count):
            box = (col * FRAME, row * FRAME, (col + 1) * FRAME, (row + 1) * FRAME)
            crop = sheet.crop(box).resize((FRAME * SCALE, FRAME * SCALE), Image.NEAREST)
            frames.append(to_palette(crop))

        out = os.path.join(OUT_DIR, f"{name}.gif")
        frames[0].save(
            out,
            save_all=True,
            append_images=frames[1:],
            duration=duration,
            loop=0,
            disposal=2,  # restore to background between frames (transparency)
            transparency=TRANSPARENT_INDEX,
            optimize=False,
        )
        print(f"  {name}.gif  ({count} frames @ {duration}ms)")

    print(f"\nWrote {len(STATE_ROWS)} GIFs to {os.path.relpath(OUT_DIR, ROOT)}/")


if __name__ == "__main__":
    main()
