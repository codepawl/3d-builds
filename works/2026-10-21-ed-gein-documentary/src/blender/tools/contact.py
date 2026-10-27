"""Tile images into a contact sheet: contact.py <out> <cell width> <columns> <images...>"""
import sys
from PIL import Image, ImageDraw
out, cell_width, columns = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
images = [Image.open(path).convert("RGB") for path in sys.argv[4:]]
cell_height = int(cell_width * 0.68)
sheet = Image.new("RGB", (cell_width * columns, cell_height * ((len(images) + columns - 1) // columns)), (20, 20, 20))
for index, (image, path) in enumerate(zip(images, sys.argv[4:])):
    image.thumbnail((cell_width, cell_height))
    x, y = (index % columns) * cell_width, (index // columns) * cell_height
    sheet.paste(image, (x, y))
    ImageDraw.Draw(sheet).text((x + 4, y + 4), path.replace("\\", "/").split("/")[-1], fill=(255, 60, 60))
sheet.save(out)
