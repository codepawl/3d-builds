"""Reads root footprints and anchor positions from the GLB pack into src/geometry.json.

The simulation needs where load ports and stocker roof ports sit without loading three.js,
so this walks each GLB's node tree with plain json/struct and composes node transforms.
Run: uv run --no-project python scripts/extract_geometry.py
"""
import json
import struct
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
APP = Path(__file__).resolve().parent.parent
FILES = ["tools", "stocker", "oht", "cleanroom", "subfab", "campus", "trucks", "people"]


def read_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + json_length])


def quaternion_rotate(quaternion, vector):
    qx, qy, qz, qw = quaternion
    vx, vy, vz = vector
    # v' = v + 2w(q x v) + 2 q x (q x v)
    cx = qy * vz - qz * vy
    cy = qz * vx - qx * vz
    cz = qx * vy - qy * vx
    ccx = qy * cz - qz * cy
    ccy = qz * cx - qx * cz
    ccz = qx * cy - qy * cx
    return (vx + 2 * (qw * cx + ccx), vy + 2 * (qw * cy + ccy), vz + 2 * (qw * cz + ccz))


def apply(node, point):
    scale = node.get("scale", [1, 1, 1])
    scaled = (point[0] * scale[0], point[1] * scale[1], point[2] * scale[2])
    rotated = quaternion_rotate(node.get("rotation", [0, 0, 0, 1]), scaled)
    translation = node.get("translation", [0, 0, 0])
    return tuple(rotated[index] + translation[index] for index in range(3))


def walk(gltf, index, chain, out_anchors, out_points):
    node = gltf["nodes"][index]
    chain = [node] + chain

    def to_root(point):
        for ancestor in chain[:-1]:
            point = apply(ancestor, point)
        return point

    out_anchors[node.get("name", "")] = [round(value, 3) for value in to_root((0, 0, 0))]
    if "mesh" in node:
        for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
            accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
            low, high = accessor["min"], accessor["max"]
            for x in (low[0], high[0]):
                for y in (low[1], high[1]):
                    for z in (low[2], high[2]):
                        out_points.append(to_root((x, y, z)))
    for child in node.get("children", []):
        walk(gltf, child, chain, out_anchors, out_points)


result = {}
for name in FILES:
    gltf = read_glb(APP / "public" / "assets" / f"{name}.glb")
    for root_index in gltf["scenes"][0]["nodes"]:
        root = gltf["nodes"][root_index]
        anchors = {}
        points = []
        walk(gltf, root_index, [], anchors, points)
        root_name = root["name"]
        entry = {"anchors": {key[len(root_name) + 1:]: value for key, value in anchors.items() if key != root_name}}
        if points:
            entry["min"] = [round(min(point[axis] for point in points), 3) for axis in range(3)]
            entry["max"] = [round(max(point[axis] for point in points), 3) for axis in range(3)]
        result[root_name] = entry

(APP / "src" / "geometry.json").write_text(json.dumps(result, indent=1))
for key in ["tool_litho_b", "tool_etch_a", "stocker_a", "oht_a", "sign_bay"]:
    print(key, json.dumps(result[key])[:400])
