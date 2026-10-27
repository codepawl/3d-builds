"""Tile several preview PNGs into one review image (two columns).
Usage: uv run --no-project --with pillow python blender/grid.py <output.jpg> <image> [image ...]"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
TILE = 800
target = Path(sys.argv[1])
paths = [Path(argument) for argument in sys.argv[2:]]
rows = (len(paths) + 1) // 2
sheet = Image.new("RGB", (TILE * 2, TILE * rows), "white")
draw = ImageDraw.Draw(sheet)
for index, path in enumerate(paths):
    image = Image.open(path).convert("RGB")
    image.thumbnail((TILE - 4, TILE - 4))
    column, row = index % 2, index // 2
    sheet.paste(image, (column * TILE, row * TILE))
    draw.text((column * TILE + 6, row * TILE + TILE - 16), path.stem, fill="blue")
sheet.save(target, quality=85)
print(target)
