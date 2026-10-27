import sys
from PIL import Image
sys.path.insert(0, sys.argv[1])
from quadgeo import QuadGeo, QUADS
root = sys.argv[2]
name, lon, lat, half, out = sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
file, south, west, north, east = QUADS[name]
geo = QuadGeo(root + "/" + file, 3.0, south, west, north, east)
print("fit err deg", geo.fit_error_degrees)
image = geo.render()
px, py = geo.lonlat_to_pixel(lon, lat)
px, py = int(px), int(py)
print("image", image.shape, "point px", px, py)
crop = image[py - half:py + half, px - half:px + half].copy()
crop[half - 2:half + 2, half - 12:half + 12] = (255, 0, 255)
crop[half - 12:half + 12, half - 2:half + 2] = (255, 0, 255)
Image.fromarray(crop).save(out)
Image.fromarray(image[::8, ::8]).save(out.replace(".png", "_whole.png"))
