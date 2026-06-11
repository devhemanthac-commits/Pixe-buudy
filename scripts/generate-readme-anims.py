#!/usr/bin/env python3
"""Render an animated GIF per animation state from the bundled sprite sheet.

Used for the README gallery. Re-run after replacing assets/sprites/cat.png:

    python3 scripts/generate-readme-anims.py

Frame counts, row order, and durations mirror src/cat/sprites.js (STATE_ROWS).
Output: docs/anims/<state>.gif
"""

import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, "assets", "sprites", "cat.png")
SPRITES_JS = os.path.join(ROOT, "src", "cat", "sprites.js")
OUT_DIR = os.path.join(ROOT, "docs", "anims")

FRAME = 32
SCALE = 4  # 32px frames -> 128px GIFs


def load_state_rows():
    """Parse STATE_ROWS from sprites.js — single source of truth, no drift."""
    with open(SPRITES_JS, encoding="utf-8") as f:
        js = f.read()
    block = re.search(r"export const STATE_ROWS = \[(.*?)\n\]", js, re.S)
    if not block:
        sys.exit(f"STATE_ROWS not found in {SPRITES_JS}")
    rows = re.findall(r"\['(\w+)',\s*(\d+),\s*(\d+)\]", block.group(1))
    if not rows:
        sys.exit(f"could not parse any rows from STATE_ROWS in {SPRITES_JS}")
    return [(name, int(count), int(duration)) for name, count, duration in rows]


STATE_ROWS = load_state_rows()

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
