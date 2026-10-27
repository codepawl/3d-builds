"""Overlay the fact-file points on the traced layers and on the scan; report residuals.

Usage: uv run --project blender/tools python -I verify_map.py <tools dir> <quads dir> <map dir> <out png> <out json>
"""
import json
import math
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import LineString, Point, shape
from shapely.strtree import STRtree

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, sys.argv[1])
from quadgeo import QUADS, QuadGeo  # noqa: E402

QUADS_DIR, MAP_DIR, OUT_PNG, OUT_JSON = sys.argv[2:6]
LON_M = 111_320.0 * math.cos(math.radians(44.25))
LAT_M = 111_132.0
HALF_METRES = 900
PANEL = 420


def load(name):
    with open(f"{MAP_DIR}/{name}.geojson", encoding="utf-8") as handle:
        return json.load(handle)["features"]


def quad_for(longitude, latitude):
    for name, (file_name, south, west, north, east) in QUADS.items():
        if south <= latitude < north and west <= longitude < east:
            return name
    return None


def metres_line(coordinates, origin):
    return LineString([((x - origin[0]) * LON_M, (y - origin[1]) * LAT_M) for x, y in coordinates])


roads = load("roads")
sections = load("section_lines")
water = load("water_areas")
streams = load("streams")
blocks = load("blocks")
buildings = load("buildings")
places = [place for place in load("places") if quad_for(*place["geometry"]["coordinates"])]
origin = (-89.5, 44.25)
road_lines = [metres_line(item["geometry"]["coordinates"], origin) for item in roads]
road_tree = STRtree(road_lines)
block_polygons = [shape(item["geometry"]) for item in blocks]
block_tree = STRtree(block_polygons)

geos = {}
renders = {}
rows = []
report = []
for place in places:
    longitude, latitude = place["geometry"]["coordinates"]
    name = quad_for(longitude, latitude)
    if name not in geos:
        file_name, south, west, north, east = QUADS[name]
        geos[name] = QuadGeo(f"{QUADS_DIR}/{file_name}", 3.0, south, west, north, east)
        renders[name] = geos[name].render()
    geo = geos[name]
    image = renders[name]
    center_x, center_y = (int(value) for value in geo.lonlat_to_pixel(longitude, latitude))
    half_pixels = int(HALF_METRES / 5.645)
    scan = image[max(center_y - half_pixels, 0):center_y + half_pixels, max(center_x - half_pixels, 0):center_x + half_pixels]
    scan_panel = Image.fromarray(scan).resize((PANEL, PANEL))

    trace_panel = Image.new("RGB", (PANEL, PANEL), (12, 12, 13))
    draw = ImageDraw.Draw(trace_panel)
    scale = PANEL / (2 * HALF_METRES)

    def to_panel(point_longitude, point_latitude):
        return ((point_longitude - longitude) * LON_M * scale + PANEL / 2, PANEL / 2 - (point_latitude - latitude) * LAT_M * scale)

    for collection, colour, width in ((sections, (70, 70, 74), 1), (streams, (70, 90, 110), 1), (roads, (175, 175, 180), 2)):
        for item in collection:
            coordinates = item["geometry"]["coordinates"]
            if min(abs(x - longitude) for x, y in coordinates[::max(len(coordinates) // 20, 1)] + [coordinates[-1]]) > 0.08:
                continue
            draw.line([to_panel(*point) for point in coordinates], fill=colour, width=width)
    for collection, colour in ((water, (40, 55, 70)), (blocks, (45, 45, 48))):
        for item in collection:
            ring = item["geometry"]["coordinates"][0]
            if abs(ring[0][0] - longitude) < 0.03 and abs(ring[0][1] - latitude) < 0.03:
                draw.polygon([to_panel(*point) for point in ring], outline=colour)
    for item in buildings:
        x, y = item["geometry"]["coordinates"]
        if abs(x - longitude) < 0.015 and abs(y - latitude) < 0.012:
            px, py = to_panel(x, y)
            draw.rectangle([px - 1, py - 1, px + 1, py + 1], fill=(120, 120, 124))
    for panel in (trace_panel, scan_panel):
        mark = ImageDraw.Draw(panel)
        mark.line([(PANEL / 2 - 9, PANEL / 2 - 9), (PANEL / 2 + 9, PANEL / 2 + 9)], fill=(224, 38, 43), width=3)
        mark.line([(PANEL / 2 - 9, PANEL / 2 + 9), (PANEL / 2 + 9, PANEL / 2 - 9)], fill=(224, 38, 43), width=3)
    label = ImageDraw.Draw(scan_panel)
    label.rectangle([0, 0, PANEL, 16], fill=(0, 0, 0))
    label.text((4, 2), place["properties"]["name"][:60], fill=(255, 255, 255))
    row = Image.new("RGB", (PANEL * 2, PANEL))
    row.paste(scan_panel, (0, 0))
    row.paste(trace_panel, (PANEL, 0))
    rows.append(row)

    point = Point((longitude - origin[0]) * LON_M, (latitude - origin[1]) * LAT_M)
    nearest_road = road_lines[road_tree.nearest(point)]
    nearest_block_distance = min((polygon.distance(Point(longitude, latitude)) for polygon in block_polygons if abs(polygon.centroid.x - longitude) < 0.05 and abs(polygon.centroid.y - latitude) < 0.05), default=None)
    report.append({
        "place": place["properties"]["name"],
        "quad": name,
        "nearest_traced_road_m": round(nearest_road.distance(point), 1),
        "nearest_block_m": None if nearest_block_distance is None else round(nearest_block_distance * LAT_M, 1),
    })

sheet = Image.new("RGB", (PANEL * 4, PANEL * math.ceil(len(rows) / 2)), (0, 0, 0))
for index, row in enumerate(rows):
    sheet.paste(row, ((index % 2) * PANEL * 2, (index // 2) * PANEL))
sheet.save(OUT_PNG)
with open(OUT_JSON, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=1)
for entry in report:
    print(entry)
