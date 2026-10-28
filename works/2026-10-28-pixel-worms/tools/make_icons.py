"""Draw the Pixel Worms icon as 16x16 pixel art and export it at the sizes the site needs."""
import sys
from pathlib import Path

from PIL import Image

OUTPUT_FOLDER = Path(sys.argv[1])

# One character per pixel: . background, o outline, r body, d shadow, h highlight, t tooth, m maw, b blood.
ICON_ROWS = [
    "................",
    "..ooooooo.......",
    ".orrrrrrroo.....",
    "orttttttrrro....",
    "ortmtmtmrrrro...",
    "ormmmmmmrrhro...",
    "ormtmtmtrrrro...",
    "orttttttrrrro...",
    ".orbrrbrrrrro...",
    "..ob..b..orrdo..",
    "...b..b.orrdo...",
    "...b...orrdo....",
    "......orrdo.....",
    ".....orrdo......",
    "....orrdo.......",
    "....oooo........",
]

COLOURS = {
    ".": (234, 217, 180, 255),
    "o": (42, 8, 12, 255),
    "r": (150, 24, 36, 255),
    "d": (100, 14, 24, 255),
    "h": (230, 110, 110, 255),
    "t": (250, 236, 210, 255),
    "m": (40, 6, 10, 255),
    "b": (225, 22, 34, 255),
}


def draw_base_icon():
    size = len(ICON_ROWS)
    image = Image.new("RGBA", (size, size))
    for row_index, row in enumerate(ICON_ROWS):
        for column_index, character in enumerate(row):
            image.putpixel((column_index, row_index), COLOURS[character])
    return image


def export_sizes(base_icon):
    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
    for size, name in [(16, "favicon-16.png"), (32, "favicon-32.png"), (180, "apple-touch-icon.png"),
                       (192, "icon-192.png"), (512, "icon-512.png")]:
        scaled = base_icon.resize((size, size), Image.NEAREST)
        scaled.save(OUTPUT_FOLDER / name)
    base_icon.resize((48, 48), Image.NEAREST).save(OUTPUT_FOLDER / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    export_sizes(draw_base_icon())
    print("icons written to", OUTPUT_FOLDER)
