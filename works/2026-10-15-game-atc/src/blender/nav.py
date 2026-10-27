"""Navigation aids for the ATC map, exported to app/public/assets/nav.glb. Original designs.

fix_pylon        a waypoint: a three-sided pylon on a pad, brand-coloured cap, glowing ring
fix_pylon_tall   a compulsory reporting fix: taller, filled cap, two rings
holding_marker   a holding fix: low pylon with an oval racetrack plate (the app draws the pattern)
vor_station      a VOR-style beacon: round counterpoise on legs, central dome, ring of antennas
ndb_station      a radio beacon: two masts with a wire between them and a hut

Map scale: these stand on the terrain at about 6-12 m, like the airport buildings. Each has a
<name>_label empty where the app pins the fix name, and a <name>_ring glow node it can pulse or
recolour when a flight is cleared to it. The VOR's <name>_sweep spins about y.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import anchor, box, combine, cylinder, export, material, reset_scene, rod, root, slab, sphere, torus


def materials():
    return {
        "concrete": material("concrete", "#e9edf2", roughness=0.85),
        "wall": material("wall", "#f5f7fa", roughness=0.7),
        "panel": material("panel", "#d7dde6", roughness=0.6, metallic=0.1),
        "dark": material("dark_trim", "#3a4352", roughness=0.5, metallic=0.3),
        "brand": material("brand", "#ff6b3d", roughness=0.45),
        "steel": material("steel", "#8d97a6", roughness=0.4, metallic=0.7),
        "metal": material("metal", "#c9d0db", roughness=0.28, metallic=0.75),
        "ring": material("glow_fix", "#7fd3ff", emission="#7fd3ff", strength=3),
        "red": material("glow_red", "#ff3b3b", emission="#ff3b3b", strength=4),
    }


def triangle(radius):
    return [(radius * math.sin(2 * math.pi * index / 3), radius * math.cos(2 * math.pi * index / 3)) for index in range(3)]


def glow_ring(name, radius, up, mats, parent):
    ring = torus(f"{name}_tube", radius, 0.07, (0, up, 0), mats["ring"], segments=max(32, int(radius * 12)))
    return combine(name, [ring], origin=(0, up, 0), parent=parent)


def pylon(name, height, mats, rings=1, filled=False):
    group = root(name)
    parts = [
        cylinder(f"{name}_pad", 1.6, 0.3, (0, 0.15, 0), mats["concrete"], sides=24, round_by=0.08),
        cylinder(f"{name}_plinth", 0.9, 0.5, (0, 0.55, 0), mats["panel"], sides=3, round_by=0.08),
    ]
    # Shaft with raised panel bands and bolts at the foot.
    body = slab(f"{name}_shaft", triangle(0.7), height, mats["wall"], center=(0, 0.8 + height / 2, 0), round_by=0.1)
    parts.append(body)
    for level in range(1, int(height // 1.5) + 1):
        parts.append(slab(f"{name}_band{level}", triangle(0.74), 0.08, mats["panel"], center=(0, 0.8 + level * 1.5 - 0.4, 0), round_by=0.02))
    for index, (x, forward) in enumerate(triangle(0.82)):
        parts.append(cylinder(f"{name}_bolt{index}", 0.06, 0.12, (x, 0.85, forward), mats["metal"], sides=6))
    cap_up = 0.8 + height
    cap = slab(f"{name}_cap", triangle(0.95 if filled else 0.85), 0.5, mats["brand"], center=(0, cap_up + 0.25, 0), round_by=0.12)
    parts.append(cap)
    parts.append(cylinder(f"{name}_whip", 0.035, 1.2, (0, cap_up + 1.1, 0), mats["steel"], sides=6))
    plate = box(f"{name}_plate", (0.6, 0.35, 0.05), (0, 1.3, 0.37), mats["dark"], round_by=0.03)
    parts.append(plate)
    combine(f"{name}_body", parts, parent=group)
    for index in range(rings):
        glow_ring(f"{name}_ring" if index == 0 else f"{name}_ring{index}", 1.25 + index * 0.45, 0.45 + index * 0.08, mats, group)
    combine(f"{name}_tip", [sphere(f"{name}_tip_bulb", 0.09, (0, cap_up + 1.75, 0), mats["red"], segments=8)], origin=(0, cap_up + 1.75, 0), parent=group)
    anchor(f"{name}_label", (0, cap_up + 2.4, 0), group)
    return group


def holding_marker(name, mats):
    group = root(name)
    parts = [
        cylinder(f"{name}_pad", 1.4, 0.3, (0, 0.15, 0), mats["concrete"], sides=24, round_by=0.08),
        slab(f"{name}_shaft", triangle(0.55), 2.6, mats["wall"], center=(0, 1.6, 0), round_by=0.08),
        slab(f"{name}_cap", triangle(0.7), 0.35, mats["brand"], center=(0, 3.1, 0), round_by=0.1),
    ]
    # Racetrack plate: a stadium outline, tilted so it reads from the map camera.
    track = [(1.0 * math.cos(angle) + (0.9 if math.cos(angle) > 0 else -0.9), 0.75 * math.sin(angle)) for angle in [2 * math.pi * step / 32 for step in range(32)]]
    parts.append(slab(f"{name}_plate", track, 0.12, mats["dark"], center=(0, 3.5, 0), round_by=0.04))
    inner = [(x * 0.8, forward * 0.7) for x, forward in track]
    parts.append(slab(f"{name}_plate_inlay", inner, 0.14, mats["panel"], center=(0, 3.52, 0), round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    glow_ring(f"{name}_ring", 1.1, 0.42, mats, group)
    anchor(f"{name}_label", (0, 4.6, 0), group)
    return group


def vor_station(name, mats):
    group = root(name)
    counterpoise_up = 3.0
    parts = [cylinder(f"{name}_pad", 6.2, 0.2, (0, 0.1, 0), mats["concrete"], sides=40, round_by=0.05)]
    for index in range(10):
        angle = 2 * math.pi * index / 10
        parts.append(cylinder(f"{name}_leg{index}", 0.1, counterpoise_up, (4.4 * math.sin(angle), counterpoise_up / 2, 4.4 * math.cos(angle)), mats["steel"], sides=8))
    parts.append(cylinder(f"{name}_counterpoise", 5.4, 0.2, (0, counterpoise_up + 0.1, 0), mats["panel"], sides=40, round_by=0.06))
    parts.append(cylinder(f"{name}_rim", 5.45, 0.12, (0, counterpoise_up + 0.1, 0), mats["brand"], sides=40))
    parts.append(cylinder(f"{name}_house", 1.4, 2.2, (0, counterpoise_up + 1.2, 0), mats["wall"], sides=24, round_by=0.1))
    parts.append(sphere(f"{name}_dome", 1.45, (0, counterpoise_up + 2.3, 0), mats["wall"], scale=(1, 0.55, 1), segments=24))
    for index in range(12):
        angle = 2 * math.pi * index / 12
        parts.append(box(f"{name}_antenna{index}", (0.12, 0.9, 0.12), (3.1 * math.sin(angle), counterpoise_up + 0.65, 3.1 * math.cos(angle)), mats["metal"], round_by=0.03))
    parts.append(box(f"{name}_hut", (2.4, 2.0, 2.0), (0, 1.0, 0), mats["wall"], round_by=0.12))
    parts.append(box(f"{name}_hut_door", (0.8, 1.6, 0.06), (0, 0.8, 1.02), mats["dark"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    sweep_up = counterpoise_up + 3.15
    sweep = [
        cylinder(f"{name}_sweep_hub", 0.25, 0.25, (0, sweep_up, 0), mats["metal"], sides=12),
        box(f"{name}_sweep_arm", (0.12, 0.12, 1.6), (0, sweep_up, 0.8), mats["brand"], round_by=0.04),
    ]
    combine(f"{name}_sweep", sweep, origin=(0, sweep_up, 0), parent=group)
    glow_ring(f"{name}_ring", 5.7, counterpoise_up + 0.24, mats, group)
    anchor(f"{name}_label", (0, counterpoise_up + 5, 0), group)
    return group


def ndb_station(name, mats):
    group = root(name)
    parts = [box(f"{name}_pad", (14.0, 0.2, 3.0), (0, 0.1, 0), mats["concrete"], round_by=0.05)]
    for side in (1, -1):
        x = side * 6.0
        parts.append(cylinder(f"{name}_mast{side}", 0.15, 10.0, (x, 5.0, 0), mats["steel"], sides=10))
        for level in range(1, 4):
            parts.append(cylinder(f"{name}_band{side}_{level}", 0.17, 0.8, (x, level * 2.6, 0), mats["brand"], sides=10))
        for guy in (1, -1):
            parts.append(rod(f"{name}_stay{side}{guy}", (x, 7.0, 0), (x + side * 3.0, 0.2, guy * 2.4), 0.03, mats["dark"]))
    parts.append(cylinder(f"{name}_wire", 0.03, 12.0, (0, 9.8, 0), mats["dark"], axis="x", sides=4))
    parts.append(cylinder(f"{name}_lead", 0.03, 7.0, (0, 6.3, 0), mats["dark"], sides=4))
    parts.append(box(f"{name}_hut", (2.6, 2.2, 2.2), (0, 1.3, 0), mats["wall"], round_by=0.12))
    parts.append(box(f"{name}_hut_roof", (2.9, 0.2, 2.5), (0, 2.5, 0), mats["brand"], round_by=0.06))
    parts.append(box(f"{name}_insulator", (0.3, 0.4, 0.3), (0, 2.8, 0), mats["dark"], round_by=0.08))
    combine(f"{name}_body", parts, parent=group)
    for side in (1, -1):
        combine(f"{name}_tip{'_left' if side > 0 else '_right'}", [sphere(f"{name}_tip{side}_bulb", 0.14, (side * 6.0, 10.1, 0), mats["red"], segments=8)], origin=(side * 6.0, 10.1, 0), parent=group)
    glow_ring(f"{name}_ring", 1.8, 0.28, mats, group)
    anchor(f"{name}_label", (0, 11.5, 0), group)
    return group


def main():
    reset_scene()
    mats = materials()
    pylon("fix_pylon", 4.0, mats)
    pylon("fix_pylon_tall", 6.5, mats, rings=2, filled=True)
    holding_marker("holding_marker", mats)
    vor_station("vor_station", mats)
    ndb_station("ndb_station", mats)
    export("nav.glb")


main()
