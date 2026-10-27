"""Tile every blender/previews/*-compare.png into _compare_overview_<n>.png (6 per image) for review.
Usage: uv run --no-project --with pillow python blender/compare_overview.py"""
import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
PREVIEWS = Path(__file__).resolve().parent / "previews"
sheets = sorted(PREVIEWS.glob("*-compare.png"))
TILE = (800, 800)
for start in range(0, len(sheets), 7):
    chunk = sheets[start:start + 7]
    overview = Image.new("RGB", (TILE[0] * 4, TILE[1] * 2), "white")
    for index, path in enumerate(chunk):
        image = Image.open(path).convert("RGB")
        image.thumbnail(TILE)
        overview.paste(image, ((index % 4) * TILE[0], (index // 4) * TILE[1]))
    target = PREVIEWS / f"_compare_overview_{start // 7}.png"
    overview.save(target)
    print(target)
