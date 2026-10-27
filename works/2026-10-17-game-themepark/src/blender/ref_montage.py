"""Tile every reference image into blender/refs/_montage_<n>.png (18 per sheet) for a quick look.
Usage: uv run --no-project --with pillow python blender/ref_montage.py"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REFS = Path(__file__).resolve().parent / "refs"
TILE = (420, 300)
images = sorted(REFS.glob("*/*.jpg"))
for sheet_index in range(0, len(images), 18):
    chunk = images[sheet_index:sheet_index + 18]
    sheet = Image.new("RGB", (TILE[0] * 6, TILE[1] * 3), "white")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(chunk):
        image = Image.open(path).convert("RGB")
        image.thumbnail(TILE)
        x, y = (index % 6) * TILE[0], (index // 6) * TILE[1]
        sheet.paste(image, (x, y))
        draw.rectangle((x, y, x + 200, y + 16), fill="black")
        draw.text((x + 4, y + 2), f"{path.parent.name}/{path.name}", fill="yellow")
    target = REFS / f"_montage_{sheet_index // 18}.png"
    sheet.save(target)
    print(target)
