"""Compose blender/previews/<asset>-compare.png: reference photos on the left, the two renders on the right.
Usage: uv run --no-project --with pillow python blender/compose_compare.py"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = Path(__file__).resolve().parent
PREVIEWS = HERE / "previews"
REFS = HERE / "refs"
REFERENCE_FOLDERS = {}
TILE = (720, 480)

for render in sorted(PREVIEWS.glob("_compare_*_side.png")):
    asset = render.name[len("_compare_"):-len("_side.png")]
    folder = REFS / REFERENCE_FOLDERS.get(asset, asset)
    photos = sorted(folder.glob("*.jpg"))[:3]
    renders = [render, PREVIEWS / f"_compare_{asset}_three_quarter.png"]
    sheet = Image.new("RGB", (TILE[0] * 2, TILE[1] * max(3, len(photos))), "white")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(photos):
        image = Image.open(path).convert("RGB")
        image.thumbnail(TILE)
        sheet.paste(image, (0, index * TILE[1]))
        draw.text((6, index * TILE[1] + 6), f"ref {path.parent.name}/{path.name}", fill="red")
    for index, path in enumerate(renders):
        if path.exists():
            image = Image.open(path).convert("RGB")
            image.thumbnail((TILE[0], int(TILE[1] * 1.5)))
            sheet.paste(image, (TILE[0], index * int(TILE[1] * 1.5)))
    draw.text((TILE[0] + 6, 6), f"render {asset} (grey post = 1.75 m person)", fill="red")
    target = PREVIEWS / f"{asset}-compare.png"
    sheet.save(target)
    print(target)
