"""Compares the crops from scripts/swim.mjs: each moved crop against the still crop moved by exactly the
same motion (bilinear). The mean absolute residual, in 0..255 grey levels, is shimmer the motion does not
explain. Usage: uv run --no-project --with numpy --with pillow python scripts/swim.py <folder>"""
import sys
import numpy
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
folder = sys.argv[1]


def grey(name):
    return numpy.asarray(Image.open(f"{folder}/{name}.png").convert("L"), dtype=numpy.float64)


def moved(image, shift_x, shift_y):
    rows, columns = image.shape
    ys, xs = numpy.mgrid[0:rows, 0:columns]
    source_x = numpy.clip(xs - shift_x, 0, columns - 1)
    source_y = numpy.clip(ys - shift_y, 0, rows - 1)
    left = numpy.floor(source_x).astype(int)
    top = numpy.floor(source_y).astype(int)
    right = numpy.clip(left + 1, 0, columns - 1)
    bottom = numpy.clip(top + 1, 0, rows - 1)
    share_x = source_x - left
    share_y = source_y - top
    upper = image[top, left] * (1 - share_x) + image[top, right] * share_x
    lower = image[bottom, left] * (1 - share_x) + image[bottom, right] * share_x
    return upper * (1 - share_y) + lower * share_y


def turned(image, degrees, centre):
    return numpy.asarray(Image.fromarray(image.astype(numpy.uint8)).rotate(-degrees, resample=Image.BICUBIC, center=centre), dtype=numpy.float64)


crop_centre = (960 - 760, 540 - 140)
for style in ["dither-square", "dither", "line"]:
    still = grey(f"{style}-still")
    inked = still < 200
    shift = numpy.abs(grey(f"{style}-shift") - moved(still, 0.5, 0.25))[inked].mean()
    turn = numpy.abs(grey(f"{style}-turn") - turned(still, 0.4, crop_centre))[inked].mean()
    print(f"{style:14s} residual after half-pixel move {shift:5.2f} · after 0.4 degree turn {turn:5.2f} (grey levels, inked pixels)")
