"""Terrain dressing for the ATC map, three families, all original designs:

town.glb      house_a, house_b, house_c, apartment_a, apartment_b, church, factory, warehouse,
              water_tower
nature.glb    tree_conifer_a, tree_conifer_b, tree_round_a, tree_round_b, bush, rock_a, rock_b,
              lighthouse, boat_fishing, boat_sail
weather.glb   storm_cell_a, storm_cell_b, cloud_a, cloud_b, cloud_c

Town and nature are at the same compressed scale as the airport (houses about 5 m). Weather is
modelled at a nominal size (a storm cell about 60 m across) and scaled by the app to its radius;
<name>_lightning nodes are glow bolts the app flashes, <name>_core is the dark rain shaft.
Moving parts: lighthouse_lamp spins about y, boats bob (whole node), water_tower has none.
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (anchor, assign, box, combine, cylinder, export, loft, material, point, reset_scene, rod,
                 root, slab, sphere)


def materials():
    return {
        "wall": material("wall", "#f5f7fa", roughness=0.7),
        "wall_warm": material("wall_warm", "#f3ece2", roughness=0.75),
        "wall_cool": material("wall_cool", "#e2ebf2", roughness=0.75),
        "panel": material("panel", "#d7dde6", roughness=0.6, metallic=0.1),
        "roof_clay": material("roof_clay", "#e0866a", roughness=0.7),
        "roof_slate": material("roof_slate", "#6d7f99", roughness=0.65),
        "roof_sage": material("roof_sage", "#8fb3a0", roughness=0.7),
        "roof_flat": material("roof_flat", "#c4ccd8", roughness=0.75, metallic=0.2),
        "dark": material("dark_trim", "#3a4352", roughness=0.5, metallic=0.3),
        "brand": material("brand", "#ff6b3d", roughness=0.45),
        "glass": material("glass", "#5c7896", roughness=0.1, metallic=0.3),
        "window": material("glow_window", "#ffe9b8", emission="#ffe2a0", strength=1.5),
        "steel": material("steel", "#8d97a6", roughness=0.4, metallic=0.7),
        "wood": material("wood", "#9c7a5b", roughness=0.8),
        "leaf": material("leaf", "#7fbf8e", roughness=0.8),
        "leaf_dark": material("leaf_dark", "#4f9a77", roughness=0.8),
        "rock": material("rock", "#aab4c0", roughness=0.9),
        "hull": material("hull", "#f5f7fa", roughness=0.5),
        "sail": material("sail", "#fbfcfe", roughness=0.7),
        "cloud": material("cloud", "#ffffff", roughness=1.0),
        "cloud_shade": material("cloud_shade", "#c9d3e0", roughness=1.0),
        "storm": material("storm", "#7d8aa0", roughness=1.0),
        "storm_dark": material("storm_dark", "#56627a", roughness=1.0),
        "bolt": material("glow_bolt", "#e9f2ff", emission="#cfe3ff", strength=8),
        "white": material("glow_white", "#ffffff", emission="#ffffff", strength=4),
        "red": material("glow_red", "#ff3b3b", emission="#ff3b3b", strength=4),
    }


def blob(name, radius, center, mat, seed, roughness=0.18, scale=(1, 1, 1), subdivisions=2):
    """A lumpy icosphere for rocks, foliage and cloud puffs; `seed` keeps it repeatable."""
    generator = random.Random(seed)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    for vertex in bm.verts:
        vertex.co *= 1 + generator.uniform(-roughness, roughness)
    scale_x, scale_up, scale_forward = scale
    bmesh.ops.scale(bm, vec=(scale_x, scale_forward, scale_up), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = point(*center)
    return assign(obj, mat)


def windows_on_face(prefix, count, width, height, up, face_forward, x_span, mat, depth=0.06):
    """A row of windows on the +z (or -z) face of a building."""
    parts = []
    for index in range(count):
        x = -x_span / 2 + (index + 0.5) * x_span / count
        parts.append(box(f"{prefix}{index}", (width, height, depth), (x, up, face_forward), mat, round_by=0.03, segments=2))
    return parts


# --- town -----------------------------------------------------------------------------------------

def house(name, width, depth, height, roof_mat, wall_mat, mats, chimney=True, dormer=False):
    group = root(name)
    parts = [box(f"{name}_walls", (width, height, depth), (0, height / 2, 0), wall_mat, round_by=0.08)]
    rise = width * 0.42
    roof = [(-width / 2 - 0.35, height - 0.1), (width / 2 + 0.35, height - 0.1), (0, height + rise)]
    parts.append(slab(f"{name}_roof", roof, depth + 0.6, roof_mat, plane="front", center=(0, 0, 0), round_by=0.06))
    parts.append(box(f"{name}_plinth", (width + 0.1, 0.3, depth + 0.1), (0, 0.15, 0), mats["panel"], round_by=0.04))
    parts.append(box(f"{name}_door", (0.8, 1.6, 0.08), (width * 0.2, 0.85, depth / 2 + 0.02), mats["dark"], round_by=0.03))
    parts.append(box(f"{name}_step", (1.1, 0.15, 0.5), (width * 0.2, 0.08, depth / 2 + 0.25), mats["panel"], round_by=0.03))
    for face in (1, -1):
        parts += windows_on_face(f"{name}_win{face}_", 2, 0.7, 0.8, height * 0.6, face * (depth / 2 + 0.02), width * 0.8, mats["glass"])
    if chimney:
        parts.append(box(f"{name}_chimney", (0.5, 1.4, 0.5), (-width * 0.25, height + rise * 0.6, -depth * 0.2), mats["panel"], round_by=0.05))
        parts.append(box(f"{name}_chimney_cap", (0.65, 0.12, 0.65), (-width * 0.25, height + rise * 0.6 + 0.75, -depth * 0.2), mats["dark"], round_by=0.03))
    if dormer:
        parts.append(box(f"{name}_dormer", (1.2, 1.0, 1.2), (width * 0.15, height + rise * 0.35, depth * 0.25), wall_mat, round_by=0.06))
        parts.append(box(f"{name}_dormer_glass", (0.7, 0.5, 0.06), (width * 0.15, height + rise * 0.35, depth * 0.25 + 0.62), mats["glass"], round_by=0.02))
    combine(f"{name}_body", parts, parent=group)
    return group


def apartment(name, width, depth, floors, wall_mat, mats, balconies=True):
    group = root(name)
    floor_height = 1.6
    height = floors * floor_height + 0.4
    parts = [box(f"{name}_block", (width, height, depth), (0, height / 2, 0), wall_mat, round_by=0.12)]
    parts.append(box(f"{name}_parapet", (width + 0.2, 0.3, depth + 0.2), (0, height + 0.1, 0), mats["roof_flat"], round_by=0.05))
    parts.append(box(f"{name}_roof_box", (2.0, 1.0, 1.6), (width * 0.2, height + 0.6, 0), mats["panel"], round_by=0.08))
    for floor in range(floors):
        up = 0.4 + floor * floor_height + floor_height * 0.55
        lit = mats["window"] if (floor * 7 + len(name)) % 3 == 0 else mats["glass"]
        for face in (1, -1):
            parts += windows_on_face(f"{name}_f{floor}_{face}_", int(width // 1.6), 0.8, 0.8, up, face * (depth / 2 + 0.02), width * 0.9, lit if face > 0 else mats["glass"])
        if balconies and floor > 0:
            parts.append(box(f"{name}_balcony{floor}", (width * 0.85, 0.12, 0.7), (0, up - 0.55, depth / 2 + 0.35), mats["panel"], round_by=0.03))
            parts.append(box(f"{name}_rail{floor}", (width * 0.85, 0.45, 0.05), (0, up - 0.3, depth / 2 + 0.7), mats["glass"], round_by=0.02))
    parts.append(box(f"{name}_entrance", (1.8, 0.2, 1.2), (0, 2.0, depth / 2 + 0.6), mats["brand"], round_by=0.05))
    combine(f"{name}_body", parts, parent=group)
    return group


def church(name, mats):
    group = root(name)
    parts = [box(f"{name}_nave", (5.0, 4.0, 9.0), (0, 2.0, -1.0), mats["wall_warm"], round_by=0.1)]
    parts.append(slab(f"{name}_roof", [(-2.9, 3.9), (2.9, 3.9), (0, 6.6)], 9.6, mats["roof_slate"], plane="front", center=(0, 0, -1.0), round_by=0.06))
    parts.append(box(f"{name}_tower", (2.6, 9.0, 2.6), (0, 4.5, 4.4), mats["wall_warm"], round_by=0.1))
    parts.append(cylinder(f"{name}_spire", 1.9, 4.5, (0, 11.25, 4.4), mats["roof_slate"], sides=4, radius_end=0.05))
    parts.append(cylinder(f"{name}_clock", 0.6, 0.1, (0, 7.2, 5.72), mats["wall"], axis="forward", sides=20))
    parts.append(box(f"{name}_belfry", (1.0, 1.4, 0.1), (0, 8.0, 5.72), mats["dark"], round_by=0.04))
    parts.append(box(f"{name}_door", (1.0, 2.0, 0.1), (0, 1.0, 5.72), mats["wood"], round_by=0.05))
    for side in (1, -1):
        for index in range(3):
            parts.append(box(f"{name}_window{side}{index}", (0.08, 1.6, 0.8), (side * 2.52, 2.2, -4.0 + index * 2.6), mats["glass"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    combine(f"{name}_light", [sphere(f"{name}_light_bulb", 0.12, (0, 13.6, 4.4), mats["red"], segments=8)], origin=(0, 13.6, 4.4), parent=group)
    return group


def factory(name, mats):
    group = root(name)
    parts = [box(f"{name}_hall", (14.0, 5.0, 9.0), (0, 2.5, 0), mats["wall_cool"], round_by=0.12)]
    # Sawtooth roof: four north-light teeth with glazing on their steep faces.
    for index in range(4):
        x = -5.25 + index * 3.5
        parts.append(slab(f"{name}_tooth{index}", [(-1.75, 0.0), (1.75, 0.0), (1.75, 1.6)], 9.0, mats["roof_flat"], plane="front", center=(x, 5.0, 0), round_by=0.04))
        parts.append(box(f"{name}_glazing{index}", (0.06, 1.4, 8.6), (x + 1.8, 5.75, 0), mats["glass"], round_by=0.02))
    parts.append(cylinder(f"{name}_chimney", 0.7, 12.0, (5.0, 6.0, -5.5), mats["wall_warm"], sides=16, radius_end=0.5))
    for level in (4.0, 9.0, 11.6):
        parts.append(cylinder(f"{name}_chimney_band{level}", 0.62, 0.35, (5.0, level, -5.5), mats["brand"], sides=16))
    parts.append(box(f"{name}_dock", (4.0, 3.2, 0.1), (-3.0, 1.6, 4.52), mats["panel"], round_by=0.04))
    parts += windows_on_face(f"{name}_win", 5, 1.4, 1.0, 3.2, 4.52, 12.0, mats["window"])
    for index in range(2):
        parts.append(cylinder(f"{name}_silo{index}", 1.3, 6.0, (-8.6, 3.0, -2.5 + index * 3.0), mats["panel"], sides=20, round_by=0.1))
    combine(f"{name}_body", parts, parent=group)
    anchor(f"{name}_smoke", (5.0, 12.2, -5.5), group)
    return group


def warehouse(name, mats):
    group = root(name)
    parts = [box(f"{name}_shed", (12.0, 4.5, 8.0), (0, 2.25, 0), mats["panel"], round_by=0.1)]
    parts.append(slab(f"{name}_roof", [(-6.3, 4.4), (6.3, 4.4), (0, 5.6)], 8.4, mats["roof_flat"], plane="front", center=(0, 0, 0), round_by=0.05))
    for index in range(3):
        parts.append(box(f"{name}_dock{index}", (2.6, 3.0, 0.1), (-4 + index * 4, 1.5, 4.02), mats["wall"], round_by=0.04))
        parts.append(box(f"{name}_canopy{index}", (3.0, 0.12, 1.0), (-4 + index * 4, 3.3, 4.5), mats["brand"], round_by=0.03))
    for index in range(1, 6):
        parts.append(box(f"{name}_rib{index}", (0.1, 4.4, 8.1), (-6 + index * 2, 2.2, 0), mats["steel"], round_by=0.02))
    combine(f"{name}_body", parts, parent=group)
    return group


def water_tower(name, mats):
    group = root(name)
    parts = []
    for index in range(4):
        angle = math.pi / 4 + index * math.pi / 2
        parts.append(cylinder(f"{name}_leg{index}", 0.15, 8.0, (1.4 * math.sin(angle), 4.0, 1.4 * math.cos(angle)), mats["steel"], sides=8))
    parts.append(cylinder(f"{name}_riser", 0.3, 8.0, (0, 4.0, 0), mats["steel"], sides=10))
    parts.append(sphere(f"{name}_tank", 2.4, (0, 9.6, 0), mats["wall"], scale=(1, 0.75, 1), segments=24))
    parts.append(cylinder(f"{name}_band", 2.42, 0.5, (0, 9.6, 0), mats["brand"], sides=24))
    parts.append(cylinder(f"{name}_cap", 0.4, 0.4, (0, 11.4, 0), mats["panel"], sides=12))
    combine(f"{name}_body", parts, parent=group)
    combine(f"{name}_light", [sphere(f"{name}_light_bulb", 0.12, (0, 11.75, 0), mats["red"], segments=8)], origin=(0, 11.75, 0), parent=group)
    return group


def build_town():
    reset_scene()
    mats = materials()
    house("house_a", 4.0, 5.0, 2.8, mats["roof_clay"], mats["wall_warm"], mats)
    house("house_b", 5.0, 6.0, 3.0, mats["roof_slate"], mats["wall"], mats, dormer=True)
    house("house_c", 3.6, 4.4, 2.6, mats["roof_sage"], mats["wall_cool"], mats, chimney=False)
    apartment("apartment_a", 8.0, 6.0, 5, mats["wall"], mats)
    apartment("apartment_b", 6.0, 6.0, 8, mats["wall_cool"], mats, balconies=False)
    church("church", mats)
    factory("factory", mats)
    warehouse("warehouse", mats)
    water_tower("water_tower", mats)
    export("town.glb")


# --- nature ---------------------------------------------------------------------------------------

def conifer(name, height, mats, seed):
    group = root(name)
    parts = [cylinder(f"{name}_trunk", 0.2, height * 0.3, (0, height * 0.15, 0), mats["wood"], sides=8)]
    tiers = 3 if height < 6 else 4
    for tier in range(tiers):
        base = height * 0.18 + tier * height * 0.2
        radius = height * 0.28 * (1 - tier * 0.2)
        parts.append(cylinder(f"{name}_tier{tier}", radius, height * 0.34, (0, base + height * 0.17, 0), mats["leaf_dark"], sides=9, radius_end=radius * 0.15, round_by=0.08))
    combine(f"{name}_body", parts, parent=group)
    return group


def round_tree(name, height, mats, seed):
    group = root(name)
    generator = random.Random(seed)
    parts = [cylinder(f"{name}_trunk", 0.22, height * 0.5, (0, height * 0.25, 0), mats["wood"], sides=8)]
    crown = height * 0.32
    parts.append(blob(f"{name}_crown", crown, (0, height - crown, 0), mats["leaf"], seed, roughness=0.12))
    for index in range(3):
        angle = generator.uniform(0, 2 * math.pi)
        offset = crown * 0.6
        parts.append(blob(f"{name}_puff{index}", crown * 0.62, (offset * math.cos(angle), height - crown * 1.15, offset * math.sin(angle)), mats["leaf"], seed + index + 1, roughness=0.12))
    combine(f"{name}_body", parts, parent=group)
    return group


def rock(name, size, mats, seed):
    group = root(name)
    parts = [blob(f"{name}_stone", size, (0, size * 0.45, 0), mats["rock"], seed, roughness=0.22, scale=(1.2, 0.7, 1.0), subdivisions=1)]
    parts.append(blob(f"{name}_pebble", size * 0.45, (size * 0.9, size * 0.2, size * 0.3), mats["rock"], seed + 7, roughness=0.25, subdivisions=1))
    combine(f"{name}_body", parts, parent=group)
    return group


def lighthouse(name, mats):
    group = root(name)
    parts = [
        cylinder(f"{name}_rocks", 3.2, 1.0, (0, 0.5, 0), mats["rock"], sides=10, radius_end=2.6, round_by=0.2),
        cylinder(f"{name}_tower", 1.5, 10.0, (0, 6.0, 0), mats["wall"], sides=20, radius_end=1.0, round_by=0.05),
        cylinder(f"{name}_gallery", 1.6, 0.25, (0, 11.1, 0), mats["dark"], sides=20, round_by=0.05),
        cylinder(f"{name}_lantern", 0.85, 1.4, (0, 11.9, 0), mats["glass"], sides=12),
        cylinder(f"{name}_dome", 1.0, 0.9, (0, 13.05, 0), mats["brand"], sides=20, radius_end=0.15, round_by=0.05),
        box(f"{name}_keeper", (3.0, 2.2, 2.4), (2.6, 2.1, 0), mats["wall"], round_by=0.12),
        slab(f"{name}_keeper_roof", [(1.0, 3.1), (4.2, 3.1), (2.6, 4.2)], 2.8, mats["roof_clay"], plane="front", center=(0, 0, 0), round_by=0.04),
    ]
    for band in (3.0, 6.0, 9.0):
        radius = 1.5 - 0.5 * (band - 1.0) / 10
        parts.append(cylinder(f"{name}_stripe{band}", radius + 0.02, 1.2, (0, band, 0), mats["brand"], sides=20))
    parts.append(box(f"{name}_door", (0.8, 1.6, 0.1), (0, 1.8, 1.45), mats["dark"], round_by=0.04))
    for index in range(16):
        angle = 2 * math.pi * index / 16
        parts.append(cylinder(f"{name}_rail{index}", 0.03, 0.6, (1.5 * math.sin(angle), 11.5, 1.5 * math.cos(angle)), mats["steel"], sides=6))
    combine(f"{name}_body", parts, parent=group)
    lamp = [
        sphere(f"{name}_lamp_core", 0.35, (0, 11.9, 0), mats["white"], segments=12),
        box(f"{name}_lamp_lens", (0.2, 0.6, 1.4), (0, 11.9, 0.5), mats["white"], round_by=0.08),
    ]
    combine(f"{name}_lamp", lamp, origin=(0, 11.9, 0), parent=group)
    return group


def boat_hull(name, length, beam, mats, colour):
    """A rounded hull: a loft from a pointed bow to a flat transom, with a coloured sheer band."""
    sections = [
        (length / 2, 0, 0, 0.55),
        (length * 0.38, beam * 0.3, 0.45, 0.45),
        (length * 0.1, beam * 0.5, 0.55, 0.4),
        (-length * 0.3, beam * 0.5, 0.55, 0.4),
        (-length / 2, beam * 0.42, 0.5, 0.42),
    ]
    return loft(f"{name}_hull", sections, [mats["hull"], colour], sides=20, material_for_face=lambda x, up, forward: 1 if up > 0.55 else 0)


def boat(name, mats, sail):
    group = root(name)
    colour = mats["brand"] if sail else mats["roof_slate"]
    length = 6.0 if sail else 7.0
    parts = [boat_hull(name, length, 2.2, mats, colour)]
    parts.append(box(f"{name}_deck", (1.8, 0.1, length * 0.7), (0, 0.9, -0.2), mats["wood"], round_by=0.04))
    if sail:
        parts.append(cylinder(f"{name}_mast", 0.07, 6.0, (0, 3.9, 0.6), mats["steel"], sides=8))
        parts.append(slab(f"{name}_main", [(0.5, 1.4), (0.5, 6.6), (-2.2, 1.4)], 0.05, mats["sail"], plane="side", round_by=0.0))
        parts.append(slab(f"{name}_jib", [(0.7, 1.4), (0.7, 6.2), (2.8, 1.2)], 0.05, mats["sail"], plane="side", round_by=0.0))
    else:
        parts.append(box(f"{name}_wheelhouse", (1.5, 1.4, 1.8), (0, 1.6, -0.8), mats["wall"], round_by=0.12))
        parts.append(box(f"{name}_wheelhouse_glass", (1.52, 0.5, 1.2), (0, 2.0, -0.6), mats["glass"], round_by=0.05))
        parts.append(cylinder(f"{name}_derrick", 0.08, 3.0, (0, 2.4, 1.6), mats["steel"], sides=8))
        parts.append(box(f"{name}_net_drum", (1.2, 0.5, 0.5), (0, 1.2, -2.6), mats["dark"], round_by=0.1))
    combine(f"{name}_body", parts, parent=group)
    return group


def build_nature():
    reset_scene()
    mats = materials()
    conifer("tree_conifer_a", 6.0, mats, 1)
    conifer("tree_conifer_b", 8.5, mats, 2)
    round_tree("tree_round_a", 5.0, mats, 3)
    round_tree("tree_round_b", 6.5, mats, 4)
    group = root("bush")
    combine("bush_body", [blob("bush_a", 0.9, (0, 0.6, 0), mats["leaf"], 5), blob("bush_b", 0.7, (0.8, 0.5, 0.3), mats["leaf_dark"], 6)], parent=group)
    rock("rock_a", 1.4, mats, 7)
    rock("rock_b", 2.4, mats, 8)
    lighthouse("lighthouse", mats)
    boat("boat_fishing", mats, sail=False)
    boat("boat_sail", mats, sail=True)
    export("nature.glb")


# --- weather --------------------------------------------------------------------------------------

def cloud(name, width, mats, seed, puffs=6):
    group = root(name)
    generator = random.Random(seed)
    parts = []
    for index in range(puffs):
        x = generator.uniform(-width * 0.35, width * 0.35)
        forward = generator.uniform(-width * 0.2, width * 0.2)
        radius = width * generator.uniform(0.16, 0.26)
        parts.append(blob(f"{name}_puff{index}", radius, (x, radius * 0.9, forward), mats["cloud"], seed * 10 + index, roughness=0.08, subdivisions=3))
    parts.append(blob(f"{name}_base", width * 0.45, (0, width * 0.08, 0), mats["cloud_shade"], seed * 10 + 99, roughness=0.05, scale=(1, 0.25, 0.6)))
    combine(f"{name}_body", parts, parent=group)
    return group


def bolt_path(seed, top, bottom, x):
    generator = random.Random(seed)
    points = [(x, top, 0)]
    steps = 6
    for step in range(1, steps + 1):
        up = top + (bottom - top) * step / steps
        points.append((x + generator.uniform(-3, 3), up, generator.uniform(-2, 2)))
    return points


def storm_cell(name, width, mats, seed):
    """A cumulonimbus: a dark rain base, a towering body and an anvil, plus lightning."""
    group = root(name)
    generator = random.Random(seed)
    height = width * 0.9
    parts = [blob(f"{name}_base", width * 0.5, (0, width * 0.3, 0), mats["storm_dark"], seed, roughness=0.06, scale=(1, 0.3, 0.85))]
    for index in range(9):
        up = width * 0.33 + index * height * 0.07
        radius = width * (0.3 - index * 0.012)
        parts.append(blob(f"{name}_tower{index}", radius, (generator.uniform(-2, 2), up, generator.uniform(-2, 2)), mats["storm"] if index < 4 else mats["cloud"], seed + index, roughness=0.1, subdivisions=3))
    # The anvil: flattened puffs spreading downwind (+x) from the top of the tower.
    for index in range(8):
        angle = generator.uniform(-1.2, 1.2)
        reach = width * generator.uniform(0.1, 0.42)
        center = (reach * math.cos(angle), height * 0.82 + width * 0.13 + generator.uniform(-1.5, 1.5), reach * math.sin(angle) * 0.8)
        parts.append(blob(f"{name}_anvil{index}", width * 0.2, center, mats["cloud"], seed + 50 + index, roughness=0.1, scale=(1.3, 0.42, 1.1), subdivisions=3))
    combine(f"{name}_body", parts, parent=group)
    core = [cylinder(f"{name}_shaft", width * 0.26, width * 0.18, (0, width * 0.09, 0), mats["storm_dark"], sides=16, radius_end=width * 0.34)]
    combine(f"{name}_core", core, origin=(0, 0, 0), parent=group)
    for bolt_index in range(2):
        path = bolt_path(seed + bolt_index * 31, width * 0.17, 0.2, (-1 + 2 * bolt_index) * width * 0.38)
        segments = []
        for index, (start, end) in enumerate(zip(path, path[1:])):
            segments.append(rod(f"{name}_bolt{bolt_index}_{index}", start, end, 0.25, mats["bolt"], sides=5))
        combine(f"{name}_lightning{bolt_index}", segments, origin=path[0], parent=group)
    anchor(f"{name}_label", (0, height + width * 0.13 + 6, 0), group)
    return group


def build_weather():
    reset_scene()
    mats = materials()
    storm_cell("storm_cell_a", 60.0, mats, 11)
    storm_cell("storm_cell_b", 44.0, mats, 23)
    cloud("cloud_a", 30.0, mats, 3)
    cloud("cloud_b", 20.0, mats, 5, puffs=5)
    cloud("cloud_c", 40.0, mats, 9, puffs=8)
    export("weather.glb")


build_town()
build_nature()
build_weather()
