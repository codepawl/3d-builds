"""Tile every reference image in blender/refs/<asset>/ into one labelled sheet for review.
Usage: uv run --no-project --with pillow python blender/montage.py"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REFS = Path(__file__).resolve().parent / "refs"
TILE = 360
files = sorted(REFS.glob("*/*.jpg"))
columns = 6
rows = (len(files) + columns - 1) // columns
sheet = Image.new("RGB", (columns * TILE, rows * TILE), "white")
draw = ImageDraw.Draw(sheet)
for index, path in enumerate(files):
    image = Image.open(path).convert("RGB")
    image.thumbnail((TILE - 6, TILE - 26))
    column, row = index % columns, index // columns
    sheet.paste(image, (column * TILE + 3, row * TILE + 22))
    draw.text((column * TILE + 4, row * TILE + 4), f"{path.parent.name}/{path.name}", fill="black")
target = REFS.parent / "previews" / "refs-montage.jpg"
sheet.save(target, quality=82)
print(target, len(files))
