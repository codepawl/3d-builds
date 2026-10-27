"""Palette and shared parts for the theme park asset pack (app space: x side, y up, z forward).

The look is the toy isometric one: a light cool world with one strong brand colour (coral) and a soft
accent per land. Material names are stable so the app can find and recolour them:
  brand, brand_dark   park colour on coaster track, ride vehicles, uniforms, canopies
  status              ride state lamp the app recolours (open, down, testing)
  glow_*              emissive lamps and marquees the app may bloom
  sign_blank          blank sign plates the app may draw labels on
"""
import json
import math

import bmesh
import bpy
from mathutils import Vector

from lib import _new_object, assign, bevel, box, cylinder, material, point

LAND_COLOURS = {
    "adventure": {"main": "#d9b77e", "accent": "#3f9a6b", "trim": "#8a5a3b"},
    "space": {"main": "#d7dcf0", "accent": "#7c6fe0", "trim": "#2f3658"},
    "fairytale": {"main": "#f6e9df", "accent": "#7aaee8", "trim": "#e98aa8"},
}


def palette():
    return {
        "brand": material("brand", "#f0545c", roughness=0.4, metallic=0.1),
        "brand_dark": material("brand_dark", "#b83a45", roughness=0.45),
        "steel": material("steel", "#b8c0cc", roughness=0.35, metallic=0.6),
        "steel_dark": material("steel_dark", "#6d7685", roughness=0.4, metallic=0.5),
        "support": material("support", "#e7ebf1", roughness=0.5, metallic=0.2),
        "chrome": material("chrome", "#e3e7ec", roughness=0.15, metallic=0.9),
        "brass": material("brass", "#d8b25a", roughness=0.25, metallic=0.85),
        "dark": material("dark", "#2b313b", roughness=0.55),
        "rubber": material("rubber", "#1f2329", roughness=0.85),
        "white": material("white_body", "#f4f6f9", roughness=0.45),
        "panel": material("panel", "#dfe4ec", roughness=0.6),
        "concrete": material("concrete", "#d6dae1", roughness=0.85),
        "paving": material("paving", "#e4e1da", roughness=0.9),
        "glass": material("glass", "#3d5874", roughness=0.08, metallic=0.3),
        "glass_light": material("glass_light", "#a9c4de", roughness=0.1, metallic=0.2),
        "seat": material("seat", "#2f3644", roughness=0.7),
        "wood": material("wood", "#a8774e", roughness=0.8),
        "wood_dark": material("wood_dark", "#6e4a31", roughness=0.85),
        "water": material("water", "#5fb6d9", roughness=0.05, metallic=0.1),
        "foliage": material("foliage", "#5daa6c", roughness=0.85),
        "foliage_dark": material("foliage_dark", "#3d8656", roughness=0.85),
        "stone": material("stone", "#cfc6b6", roughness=0.9),
        "roof_blue": material("roof_blue", "#6e9fe0", roughness=0.55),
        "roof_pink": material("roof_pink", "#ec8fae", roughness=0.55),
        "gold": material("gold", "#e3bd55", roughness=0.3, metallic=0.8),
        "status": material("status", "#36c27a", roughness=0.3, emission="#36c27a", strength=2.5),
        "glow_warm": material("glow_warm", "#ffe2a8", roughness=0.3, emission="#ffd58a", strength=3.0),
        "glow_cool": material("glow_cool", "#bfe6ff", roughness=0.3, emission="#9fd8ff", strength=3.0),
        "glow_violet": material("glow_violet", "#c9b8ff", roughness=0.3, emission="#9d84ff", strength=3.0),
        "glow_amber": material("glow_amber", "#ffb43a", roughness=0.3, emission="#ff9d1a", strength=4.0),
        "sign_blank": material("sign_blank", "#fbfcfe", roughness=0.5),
        "screen": material("screen", "#1c2a3a", roughness=0.2, emission="#5ec8ff", strength=1.2),
    }


# --- paths -----------------------------------------------------------------------------------

def catmull_rom(control, closed=True, steps=24):
    """Dense Catmull-Rom polyline through app-space control points (x, up, forward)."""
    points = [Vector(p) for p in control]
    count = len(points)
    dense = []
    segments = count if closed else count - 1
    for index in range(segments):
        p0 = points[(index - 1) % count] if closed or index > 0 else points[0]
        p1 = points[index]
        p2 = points[(index + 1) % count]
        p3 = points[(index + 2) % count] if closed or index + 2 < count else points[-1]
        for step in range(steps):
            t = step / steps
            t2 = t * t
            t3 = t2 * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        dense.append(points[-1])
    return dense


def resample(dense, spacing, closed=True):
    """Points every `spacing` metres along a dense polyline."""
    chain = dense + ([dense[0]] if closed else [])
    lengths = [0.0]
    for first, second in zip(chain, chain[1:]):
        lengths.append(lengths[-1] + (second - first).length)
    total = lengths[-1]
    count = max(2, int(total / spacing))
    samples = []
    cursor = 0
    for index in range(count if closed else count + 1):
        target = total * index / count
        while cursor < len(lengths) - 2 and lengths[cursor + 1] < target:
            cursor += 1
        span = lengths[cursor + 1] - lengths[cursor] or 1.0
        fraction = (target - lengths[cursor]) / span
        samples.append(chain[cursor].lerp(chain[cursor + 1], fraction))
    return samples, total


def frames(samples, banks, closed=True):
    """Tangent, side and up vectors per sample; the side vector is rolled by the bank angle (radians)."""
    result = []
    count = len(samples)
    for index, here in enumerate(samples):
        ahead = samples[(index + 1) % count] if closed or index + 1 < count else here + (here - samples[index - 1])
        behind = samples[index - 1] if closed or index > 0 else here - (ahead - here)
        tangent = (ahead - behind).normalized()
        side = tangent.cross(Vector((0, 1, 0)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(tangent).normalized()
        bank = banks[index] if banks else 0.0
        rolled_side = side * math.cos(bank) + up * math.sin(bank)
        rolled_up = rolled_side.cross(tangent).normalized()
        result.append((tangent, rolled_side, rolled_up))
    return result


def sweep(name, samples, path_frames, profile, mat, closed=True):
    """Sweep a closed 2D profile [(side, up), ...] along the path; returns a mesh object."""
    bm = bmesh.new()
    rings = []
    for here, (tangent, side, up) in zip(samples, path_frames):
        rings.append([bm.verts.new(point(*(here + side * across + up * height))) for across, height in profile])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    sides = len(profile)
    for first, second in pairs:
        for index in range(sides):
            following = (index + 1) % sides
            bm.faces.new((first[index], first[following], second[following], second[index]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    return assign(obj, mat)


def circle_profile(center_side, center_up, radius, sides=8):
    return [(center_side + radius * math.cos(2 * math.pi * i / sides), center_up + radius * math.sin(2 * math.pi * i / sides))
            for i in range(sides)]


def write_path_json(file_name, samples, path_frames, extra):
    """Centreline the app moves vehicles along: points in app space with up vectors."""
    from lib import ASSETS
    data = dict(extra)
    data["points"] = [[round(p.x, 3), round(p.y, 3), round(p.z, 3)] for p in samples]
    data["up"] = [[round(f[2].x, 3), round(f[2].y, 3), round(f[2].z, 3)] for f in path_frames]
    (ASSETS / file_name).write_text(json.dumps(data))
    print(f"exported {file_name}: {len(samples)} points")


def beam_between(name, start, end, radius, mat, sides=10):
    """Cylinder from start to end (app coords)."""
    start = Vector(start)
    end = Vector(end)
    middle = (start + end) / 2
    length = (end - start).length
    obj = cylinder(name, radius, length, tuple(middle), mat, sides=sides)
    direction = point(*(end - start)).normalized()
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
    return obj


def bulbs(name, center, radius, count, height, mat, size=0.08, axis="up"):
    """A ring of small lamp bulbs (one mesh)."""
    from lib import combine, sphere
    parts = []
    for index in range(count):
        angle = 2 * math.pi * index / count
        if axis == "up":
            spot = (center[0] + radius * math.cos(angle), center[1] + height, center[2] + radius * math.sin(angle))
        else:
            spot = (center[0] + height, center[1] + radius * math.sin(angle), center[2] + radius * math.cos(angle))
        parts.append(sphere(f"{name}_{index}", size, spot, mat, segments=8))
    return combine(name, parts)
