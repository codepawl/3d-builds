"""Trace the four 1957-59 USGS 1:48,000 quads into WGS84 GeoJSON layers for the dark county map.

Usage: uv run --project blender/tools python -I blender/tools/trace_map.py <tools dir> <quads dir> <out dir>

Layers written to <out dir>: roads, section_lines, water_areas, streams, blocks, buildings, places, extent.json,
and heightmap.png (illustrative relief, see ASSETS.md).
"""
import json
import math
import sys

import cv2
import numpy as np
from PIL import Image
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import linemerge, polygonize, unary_union
from skimage.morphology import skeletonize

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, sys.argv[1])
from quadgeo import QUADS, QuadGeo  # noqa: E402

QUADS_DIR = sys.argv[2]
OUT_DIR = sys.argv[3]
ZOOM = 3.0
METRES_PER_DEGREE_LAT = 111_132.0
METRES_PER_DEGREE_LON = 111_320.0 * math.cos(math.radians(44.25))
NEIGHBOUR_OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def colour_masks(image):
    red, green, blue = [image[..., channel].astype(np.int16) for channel in range(3)]
    highest = np.maximum(np.maximum(red, green), blue)
    lowest = np.minimum(np.minimum(red, green), blue)
    luminance = (red * 3 + green * 6 + blue) // 10
    dark = (luminance < 175) & (green - red < 25) & ~((blue - red > 45) & (blue > 110)) & ~((red > 160) & (green < 130))
    red_ink = (red > 160) & (green < 130) & (blue < 130)
    water = (blue > 110) & (blue - red > 45) & (blue > green - 15)
    return dark, red_ink, water


def map_area_mask(geo, shape, south, west, north, east):
    corners = [(west, south), (east, south), (east, north), (west, north)]
    points = [geo.lonlat_to_pixel(longitude, latitude) for longitude, latitude in corners]
    polygon = np.array([[int(x), int(y)] for x, y in points], dtype=np.int32)
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.fillPoly(mask, [polygon], 1)
    return cv2.erode(mask, np.ones((5, 5), np.uint8)).astype(bool)


def split_buildings(dark):
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(dark.astype(np.uint8), connectivity=8)
    width = stats[:, cv2.CC_STAT_WIDTH]
    height = stats[:, cv2.CC_STAT_HEIGHT]
    area = stats[:, cv2.CC_STAT_AREA]
    fill_ratio = area / np.maximum(width * height, 1)
    squareness = np.maximum(width, height) <= 2 * np.minimum(width, height)
    is_building = (area >= 12) & (area <= 110) & (width <= 13) & (height <= 13) & squareness & (fill_ratio >= 0.6)
    is_building[0] = False
    building_pixels = is_building[labels]
    return dark & ~building_pixels, centroids[is_building]


def road_band(dark_without_buildings, red_ink):
    """Rural roads are single solid lines, village streets double lines, highways red between casings.
    Keep long connected ink after a small closing; text, dashes and dots stay short and drop out."""
    ink = (dark_without_buildings | red_ink).astype(np.uint8)
    closed = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    skeleton = skeletonize(closed.astype(bool))
    skeleton_length = np.bincount(labels[skeleton], minlength=count)
    longest_side = np.maximum(stats[:, cv2.CC_STAT_WIDTH], stats[:, cv2.CC_STAT_HEIGHT])
    thickness = stats[:, cv2.CC_STAT_AREA] / np.maximum(skeleton_length, 1)
    keep = (longest_side >= 50) & (thickness < 9)
    keep[0] = False
    band = keep[labels]
    return band, skeleton & band


def dash_mask(ink):
    """Dashed section lines: short elongated ink pieces outside the road network."""
    count, labels, stats, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8), connectivity=8)
    width = stats[:, cv2.CC_STAT_WIDTH]
    height = stats[:, cv2.CC_STAT_HEIGHT]
    longest_side = np.maximum(width, height)
    shortest_side = np.maximum(np.minimum(width, height), 1)
    keep = (longest_side >= 8) & (longest_side <= 60) & (longest_side / shortest_side >= 3.5)
    keep[0] = False
    return keep[labels]


def skeleton_to_polylines(skeleton):
    rows, columns = np.nonzero(skeleton)
    pixels = set(zip(rows.tolist(), columns.tolist()))

    def neighbours(pixel):
        row, column = pixel
        return [(row + d_row, column + d_column) for d_row, d_column in NEIGHBOUR_OFFSETS if (row + d_row, column + d_column) in pixels]

    degree = {pixel: len(neighbours(pixel)) for pixel in pixels}
    visited = set()
    polylines = []
    for start in (pixel for pixel in pixels if degree[pixel] != 2):
        for first in neighbours(start):
            if (start, first) in visited:
                continue
            path = [start, first]
            visited.add((start, first))
            visited.add((first, start))
            previous, current = start, first
            while degree[current] == 2:
                following = [pixel for pixel in neighbours(current) if pixel != previous][0]
                visited.add((current, following))
                visited.add((following, current))
                path.append(following)
                previous, current = current, following
                if current == start:
                    break
            polylines.append(path)
    return polylines


def prune_and_merge(polylines, spur_length):
    lines = [LineString([(column, row) for row, column in path]) for path in polylines if len(path) >= 2]
    merged = linemerge(unary_union(lines))
    merged_lines = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    endpoint_counts = {}
    for line in merged_lines:
        for point in (line.coords[0], line.coords[-1]):
            key = (round(point[0]), round(point[1]))
            endpoint_counts[key] = endpoint_counts.get(key, 0) + 1
    kept = []
    for line in merged_lines:
        ends = [endpoint_counts[(round(point[0]), round(point[1]))] for point in (line.coords[0], line.coords[-1])]
        has_free_end = min(ends) == 1
        if has_free_end and line.length < spur_length:
            continue
        kept.append(line)
    merged = linemerge(kept)
    return list(merged.geoms) if hasattr(merged, "geoms") else [merged]


def to_lonlat_coords(geo, pixel_coords):
    array = np.asarray(pixel_coords, dtype=float)
    longitudes, latitudes = geo.pixel_to_lonlat(array[:, 0], array[:, 1])
    return [[round(float(longitude), 6), round(float(latitude), 6)] for longitude, latitude in zip(longitudes, latitudes)]


def hough_grid_lines(thin_mask):
    segments = cv2.HoughLinesP(thin_mask.astype(np.uint8) * 255, 1, np.pi / 720, threshold=120, minLineLength=220, maxLineGap=40)
    if segments is None:
        return []
    groups = {"horizontal": [], "vertical": []}
    for x1, y1, x2, y2 in segments.reshape(-1, 4):
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
        if angle < 4 or angle > 176:
            groups["horizontal"].append((x1, y1, x2, y2))
        elif 86 < angle < 94:
            groups["vertical"].append((x1, y1, x2, y2))
    merged = []
    for orientation, items in groups.items():
        clusters = []
        for x1, y1, x2, y2 in items:
            offset = (y1 + y2) / 2 if orientation == "horizontal" else (x1 + x2) / 2
            start, end = sorted((x1, x2)) if orientation == "horizontal" else sorted((y1, y2))
            for cluster in clusters:
                if abs(cluster["offset"] - offset) < 6 and start <= cluster["end"] + 60 and end >= cluster["start"] - 60:
                    cluster["start"] = min(cluster["start"], start)
                    cluster["end"] = max(cluster["end"], end)
                    cluster["segments"].append((x1, y1, x2, y2))
                    break
            else:
                clusters.append({"offset": offset, "start": start, "end": end, "segments": [(x1, y1, x2, y2)]})
        for cluster in clusters:
            points = np.array([point for x1, y1, x2, y2 in cluster["segments"] for point in ((x1, y1), (x2, y2))], dtype=float)
            if orientation == "horizontal":
                slope, intercept = np.polyfit(points[:, 0], points[:, 1], 1) if np.ptp(points[:, 0]) > 0 else (0, points[0, 1])
                merged.append([(cluster["start"], slope * cluster["start"] + intercept), (cluster["end"], slope * cluster["end"] + intercept)])
            else:
                slope, intercept = np.polyfit(points[:, 1], points[:, 0], 1) if np.ptp(points[:, 1]) > 0 else (0, points[0, 0])
                merged.append([(slope * cluster["start"] + intercept, cluster["start"]), (slope * cluster["end"] + intercept, cluster["end"])])
    return merged


def local_metres(longitude, latitude, origin):
    return ((longitude - origin[0]) * METRES_PER_DEGREE_LON, (latitude - origin[1]) * METRES_PER_DEGREE_LAT)


def feature(geometry, properties):
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def trace_quad(name, layers):
    file_name, south, west, north, east = QUADS[name]
    geo = QuadGeo(f"{QUADS_DIR}/{file_name}", ZOOM, south, west, north, east)
    image = geo.render()
    inside = map_area_mask(geo, image.shape[:2], south, west, north, east)
    dark, red_ink, water = colour_masks(image)
    dark &= inside
    red_ink &= inside
    water &= inside
    source = f"USGS {file_name.split('_')[1]} {file_name.split('_')[3][:4]} 1:48,000"

    dark_without_buildings, building_centroids = split_buildings(dark)
    for x, y in building_centroids:
        longitude, latitude = geo.pixel_to_lonlat(x, y)
        layers["buildings"].append(feature({"type": "Point", "coordinates": [round(float(longitude), 6), round(float(latitude), 6)]}, {"quad": name}))

    band, road_skeleton = road_band(dark_without_buildings, red_ink)
    red_near = cv2.dilate(red_ink.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    road_lines = prune_and_merge(skeleton_to_polylines(road_skeleton), spur_length=22)
    quad_road_lines = []
    for line in road_lines:
        simplified = line.simplify(1.2)
        if simplified.length < 6:
            continue
        samples = [simplified.interpolate(fraction, normalized=True) for fraction in np.linspace(0, 1, 12)]
        red_fraction = np.mean([red_near[min(int(point.y), red_near.shape[0] - 1), min(int(point.x), red_near.shape[1] - 1)] for point in samples])
        road_class = "highway" if red_fraction > 0.5 else "road"
        coordinates = to_lonlat_coords(geo, simplified.coords)
        quad_road_lines.append(LineString(coordinates))
        layers["roads"].append(feature({"type": "LineString", "coordinates": coordinates}, {"class": road_class, "source": source}))

    band_wide = cv2.dilate(band.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    for ink_name, ink_mask in (("section", dash_mask(dark_without_buildings & ~band_wide)), ("township", red_ink & ~band_wide)):
        for start, end in hough_grid_lines(ink_mask):
            coordinates = to_lonlat_coords(geo, [start, end])
            layers["section_lines"].append(feature({"type": "LineString", "coordinates": coordinates}, {"class": ink_name, "source": source}))

    water_mask = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(water_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    area_mask = np.zeros_like(water_mask)
    for contour in contours:
        if cv2.contourArea(contour) < 500:
            continue
        x, y, width, height = cv2.boundingRect(contour)
        thickness = cv2.contourArea(contour) / max(cv2.arcLength(contour, True) / 2, 1)
        if thickness < 4:
            continue
        cv2.drawContours(area_mask, [contour], -1, 1, -1)
        approximate = cv2.approxPolyDP(contour, 1.5, True)[:, 0, :]
        if len(approximate) < 3:
            continue
        ring = to_lonlat_coords(geo, approximate)
        ring.append(ring[0])
        area_square_metres = cv2.contourArea(contour) * (16.9333 / ZOOM) ** 2
        layers["water_areas"].append(feature({"type": "Polygon", "coordinates": [ring]}, {"area_m2": round(area_square_metres), "source": source}))
    stream_mask = water.astype(bool) & ~cv2.dilate(area_mask, np.ones((7, 7), np.uint8)).astype(bool)
    stream_mask = cv2.morphologyEx(stream_mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)
    stream_lines = prune_and_merge(skeleton_to_polylines(skeletonize(stream_mask)), spur_length=12)
    for line in stream_lines:
        simplified = line.simplify(1.2)
        if simplified.length < 40:
            continue
        layers["streams"].append(feature({"type": "LineString", "coordinates": to_lonlat_coords(geo, simplified.coords)}, {"source": source}))

    origin = (west, south)
    metre_lines = [LineString([local_metres(longitude, latitude, origin) for longitude, latitude in line.coords]) for line in quad_road_lines]
    for face in polygonize(unary_union(metre_lines)):
        if 1_500 <= face.area <= 60_000 and face.length / math.sqrt(face.area) < 6:
            ring = [[round(x / METRES_PER_DEGREE_LON + origin[0], 6), round(y / METRES_PER_DEGREE_LAT + origin[1], 6)] for x, y in face.simplify(4).exterior.coords]
            layers["blocks"].append(feature({"type": "Polygon", "coordinates": [ring]}, {"area_m2": round(face.area), "source": source}))

    print(name, {key: len(value) for key, value in layers.items()}, flush=True)
    return geo, image, inside, area_mask


def write_heightmap(layers):
    """Illustrative low relief: no elevation exists on these planimetric quads and no DEM download was approved."""
    west, south, east, north = -89.75, 44.00, -89.25, 44.50
    width, height = 512, 704
    water_canvas = np.zeros((height, width), np.uint8)

    def to_canvas(longitude, latitude):
        return int((longitude - west) / (east - west) * (width - 1)), int((north - latitude) / (north - south) * (height - 1))

    for item in layers["water_areas"]:
        cv2.fillPoly(water_canvas, [np.array([to_canvas(*point) for point in item["geometry"]["coordinates"][0]], np.int32)], 255)
    for item in layers["streams"]:
        cv2.polylines(water_canvas, [np.array([to_canvas(*point) for point in item["geometry"]["coordinates"]], np.int32)], False, 255, 1)
    distance = cv2.distanceTransform((water_canvas == 0).astype(np.uint8), cv2.DIST_L2, 5)
    rng = np.random.default_rng(1957)
    noise = cv2.GaussianBlur(rng.standard_normal((height, width)).astype(np.float32), (0, 0), 18)
    noise /= np.abs(noise).max()
    relief = np.clip(distance / 40.0, 0, 1) ** 0.6 + 0.35 * noise
    relief = cv2.GaussianBlur(relief.astype(np.float32), (0, 0), 3)
    relief = (relief - relief.min()) / (relief.max() - relief.min())
    Image.fromarray((relief * 65535).astype(np.uint16)).save(f"{OUT_DIR}/heightmap.png")


def write_places(layers):
    places = [
        ("Worden Hardware", "store", -89.49233, 44.21349, "[2S]"),
        ("Gein farm (map point only)", "farm", -89.5828, 44.1851, "[2S]"),
        ("West Plainfield", "hamlet", -89.5527, 44.2141, "[2S]"),
        ("Town of Pine Grove (tavern area, lot unknown)", "area", -89.5473, 44.2915, "[2S+]"),
        ("Plainfield Cemetery", "cemetery", -89.5175, 44.2154, "[2S]"),
        ("Spiritland Cemetery", "cemetery", -89.4637, 44.2580, "[SEC]"),
        ("Hancock Cemetery", "cemetery", -89.5419, 44.1149, "[SEC]"),
        ("Waushara County Courthouse, Wautoma", "courthouse", -89.28990, 44.07371, "[2S]"),
        ("Central State Hospital, Waupun (off map)", "hospital", -88.7425, 43.6204, "[2S]"),
        ("Mendota Mental Health Institute, Madison (off map)", "hospital", -89.4010, 43.1300, "[2S]"),
    ]
    for name, kind, longitude, latitude, confidence in places:
        layers["places"].append(feature({"type": "Point", "coordinates": [longitude, latitude]}, {"name": name, "kind": kind, "confidence": confidence, "source": "ed-gein-facts.md section 1 (OSM)"}))


def main():
    layers = {key: [] for key in ("roads", "section_lines", "water_areas", "streams", "blocks", "buildings", "places")}
    for name in QUADS:
        trace_quad(name, layers)
    write_places(layers)
    for key, features in layers.items():
        with open(f"{OUT_DIR}/{key}.geojson", "w", encoding="utf-8") as handle:
            json.dump({"type": "FeatureCollection", "name": key, "crs_note": "WGS84 lon/lat (traced from NAD27 quads; datum shift inside residual)", "features": features}, handle, separators=(",", ":"))
    with open(f"{OUT_DIR}/extent.json", "w", encoding="utf-8") as handle:
        json.dump({"west": -89.75, "south": 44.00, "east": -89.25, "north": 44.50, "crs": "EPSG:4326", "heightmap": "heightmap.png", "heightmap_note": "illustrative relief, not measured"}, handle, indent=1)
    write_heightmap(layers)


if __name__ == "__main__":
    main()
