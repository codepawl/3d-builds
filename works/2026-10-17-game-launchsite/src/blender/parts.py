"""Launch-site parts on top of lib.py: the clay palette, rings, trusses, ladders, railings and lamps.

Coordinates are app space (x, up, forward) like lib.py. The point-cloud look wants matte white clay models
with real detail, so the palette is white and greys; only lamps glow.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from lib import _new_object, assign, bevel, box, combine, cylinder, material, point, rod, sphere, torus


def palette():
    """The shared materials; names starting with glow_ are lamps."""
    return {
        "clay": material("clay", "#eeece8", roughness=0.88),
        "steel": material("steel_clay", "#e4e4e2", roughness=0.5, metallic=0.35),
        "frame": material("frame_clay", "#d2d0cb", roughness=0.8),
        "dark": material("dark_clay", "#8c8b88", roughness=0.85),
        "tile": material("tile_clay", "#9b9a97", roughness=0.9),
        "concrete": material("concrete_clay", "#dcdad4", roughness=0.95),
        "glass": material("glass_clay", "#7f8a93", roughness=0.15, metallic=0.1),
        "rubber": material("rubber_clay", "#6f6f6e", roughness=0.9),
        "glow_white": material("glow_white", "#ffffff", roughness=0.4, emission="#fff3dc", strength=4.0),
        "glow_red": material("glow_red", "#ff6a5a", roughness=0.4, emission="#ff3b2f", strength=5.0),
        "glow_amber": material("glow_amber", "#ffd38a", roughness=0.4, emission="#ffb347", strength=4.0),
    }


def vector(values):
    return Vector(values)


def annulus(name, inner, outer, bottom, top, center, mat, sides=48):
    """A flat ring (thick washer) around the up axis between heights bottom and top."""
    bm = bmesh.new()
    x, _, forward = center
    rings = []
    for height in (bottom, top):
        for radius in (inner, outer):
            rings.append([
                bm.verts.new(point(x + radius * math.sin(2 * math.pi * index / sides), height,
                                   forward + radius * math.cos(2 * math.pi * index / sides)))
                for index in range(sides)
            ])
    bottom_inner, bottom_outer, top_inner, top_outer = rings
    for index in range(sides):
        following = (index + 1) % sides
        for first, second in ((bottom_outer, top_outer), (top_outer, top_inner), (top_inner, bottom_inner), (bottom_inner, bottom_outer)):
            bm.faces.new((first[index], first[following], second[following], second[index]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _new_object(name, mesh)
    assign(obj, mat)
    return bevel(obj, min(0.08, (top - bottom) * 0.3), 2)


def frame_axes(start, end):
    """Two unit vectors across the line start->end, for laying out chords around it."""
    direction = (vector(end) - vector(start)).normalized()
    reference = Vector((0, 1, 0)) if abs(direction.y) < 0.9 else Vector((1, 0, 0))
    side = direction.cross(reference).normalized()
    other = side.cross(direction).normalized()
    return direction, side, other


def truss_beam(name, start, end, width, depth, mat, panels=8, chord=0.25, web=0.12):
    """A four-chord lattice beam from start to end with zigzag webs on every face."""
    start = vector(start)
    end = vector(end)
    _, side, other = frame_axes(start, end)
    offsets = [side * sx * width / 2 + other * so * depth / 2 for sx, so in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    parts = []
    for index, offset in enumerate(offsets):
        parts.append(rod(f"{name}_chord{index}", tuple(start + offset), tuple(end + offset), chord, mat, sides=6))
    for panel in range(panels):
        low = start.lerp(end, panel / panels)
        high = start.lerp(end, (panel + 1) / panels)
        for face in range(4):
            first = offsets[face]
            second = offsets[(face + 1) % 4]
            if panel % 2:
                first, second = second, first
            parts.append(rod(f"{name}_web{panel}_{face}", tuple(low + first), tuple(high + second), web, mat, sides=4))
    return parts


def lattice_tower(name, center, width, bottom, top, modules, mat, column=1.0, brace=0.28):
    """A square lattice tower: corner columns, a ring beam at every module joint, X braces on each face."""
    cx, _, cz = center
    half = width / 2
    corners = [(cx - half, cz - half), (cx + half, cz - half), (cx + half, cz + half), (cx - half, cz + half)]
    height = top - bottom
    parts = [box(f"{name}_col{index}", (column, height, column), (x, bottom + height / 2, z), mat, round_by=0.12)
             for index, (x, z) in enumerate(corners)]
    module_height = height / modules
    for module in range(modules + 1):
        level = bottom + module * module_height
        parts.append(box(f"{name}_beam{module}a", (width, column * 0.7, column * 0.7), (cx, level, cz - half), mat, round_by=0.08))
        parts.append(box(f"{name}_beam{module}b", (width, column * 0.7, column * 0.7), (cx, level, cz + half), mat, round_by=0.08))
        parts.append(box(f"{name}_beam{module}c", (column * 0.7, column * 0.7, width), (cx - half, level, cz), mat, round_by=0.08))
        parts.append(box(f"{name}_beam{module}d", (column * 0.7, column * 0.7, width), (cx + half, level, cz), mat, round_by=0.08))
        if module == modules:
            continue
        upper = level + module_height
        for face in range(4):
            (x0, z0), (x1, z1) = corners[face], corners[(face + 1) % 4]
            parts.append(rod(f"{name}_x{module}_{face}a", (x0, level, z0), (x1, upper, z1), brace, mat, sides=6))
            parts.append(rod(f"{name}_x{module}_{face}b", (x1, level, z1), (x0, upper, z0), brace, mat, sides=6))
    return parts


def ladder(name, base, height, mat, facing="forward", cage=True):
    """A caged ladder: two rails, rungs every 0.3 m and hoops every 1 m (scaled to a 1.8 m person)."""
    x, up, forward = base
    across = (0.22, 0, 0) if facing == "forward" else (0, 0, 0.22)
    out = (0, 0, 0.35) if facing == "forward" else (0.35, 0, 0)
    parts = []
    for sign in (-1, 1):
        start = (x + sign * across[0], up, forward + sign * across[2])
        parts.append(rod(f"{name}_rail{sign}", start, (start[0], up + height, start[2]), 0.03, mat, sides=4))
    parts.append(box(f"{name}_rungs", (0.42 if facing == "forward" else 0.04, height, 0.04 if facing == "forward" else 0.42),
                     (x, up + height / 2, forward), mat, round_by=0.0))
    if cage:
        for level in range(2, int(height)):
            parts.append(torus(f"{name}_hoop{level}", 0.38, 0.02, (x + out[0], up + level, forward + out[2]), mat, segments=12, sides=3))
    return parts


def railing(name, points, height, mat, post_spacing=1.8):
    """Posts and two rails along a polyline at a given base height (1.1 m guard rails)."""
    parts = []
    for index, (start, end) in enumerate(zip(points, points[1:])):
        start = vector(start)
        end = vector(end)
        lift = Vector((0, height, 0))
        parts.append(rod(f"{name}_top{index}", tuple(start + lift), tuple(end + lift), 0.03, mat))
        parts.append(rod(f"{name}_mid{index}", tuple(start + lift * 0.5), tuple(end + lift * 0.5), 0.025, mat))
        count = max(1, int((end - start).length / post_spacing))
        for post in range(count + 1):
            foot = start.lerp(end, post / count)
            parts.append(rod(f"{name}_post{index}_{post}", tuple(foot), tuple(foot + lift), 0.03, mat))
    return parts


def lamp(name, center, mat, radius=0.25):
    return sphere(name, radius, center, mat, segments=10)


def ring_lines(name, radius, bottom, top, spacing, mat, minor=0.035):
    """Weld ring lines around a vertical barrel every `spacing` metres."""
    parts = []
    level = bottom + spacing
    index = 0
    while level < top - 0.2:
        parts.append(torus(f"{name}{index}", radius, minor, (0, level, 0), mat, segments=64, sides=4))
        level += spacing
        index += 1
    return parts


def around(radius, angle, up):
    """A point on a circle around the up axis; angle 0 faces +forward, 90 degrees faces +x."""
    return (radius * math.sin(angle), up, radius * math.cos(angle))


def make_node(name, parts, origin=(0, 0, 0), parent=None):
    return combine(name, parts, origin=origin, parent=parent)
