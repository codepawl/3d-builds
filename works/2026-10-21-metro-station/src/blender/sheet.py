"""Tile preview PNGs into one labelled contact sheet. Run: uv run --no-project --with pillow python sheet.py <out.png> <columns> <png> [png ...]"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

output_path = Path(sys.argv[1])
columns = int(sys.argv[2])
image_paths = [Path(argument) for argument in sys.argv[3:]]
tile_width, tile_height = 480, 300
rows = (len(image_paths) + columns - 1) // columns
sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "white")
draw = ImageDraw.Draw(sheet)
for index, image_path in enumerate(image_paths):
    tile = Image.open(image_path).convert("RGB").resize((tile_width, tile_height))
    left = (index % columns) * tile_width
    top = (index // columns) * tile_height
    sheet.paste(tile, (left, top))
    draw.text((left + 6, top + 4), image_path.stem, fill="black")
sheet.save(output_path)
print("SHEET", output_path)
