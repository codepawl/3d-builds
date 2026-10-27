"""Print ink colour clusters in a 1.6 km crop around a point: probe_colours.py <tools> <quads> <quad> <lon> <lat> <out png>"""
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, sys.argv[1])
from quadgeo import QUADS, QuadGeo
file_name, south, west, north, east = QUADS[sys.argv[3]]
geo = QuadGeo(sys.argv[2] + "/" + file_name, 3.0, south, west, north, east)
image = geo.render()
x, y = (int(value) for value in geo.lonlat_to_pixel(float(sys.argv[4]), float(sys.argv[5])))
crop = image[y - 140:y + 140, x - 140:x + 140].reshape(-1, 3).astype(int)
quantized = (crop // 24) * 24
values, counts = np.unique(quantized, axis=0, return_counts=True)
order = np.argsort(-counts)
for index in order[:18]:
    print(tuple(values[index]), counts[index])
Image.fromarray(image[y - 60:y + 60, x - 60:x + 60]).resize((480, 480), Image.NEAREST).save(sys.argv[6])
