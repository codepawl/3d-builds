"""Airport for the ATC world, two families, all original designs:

airport_buildings.glb   tower_main, tower_small, terminal_main, terminal_pier, hangar_a, hangar_b,
                        fire_station, radar_asr, radar_weather, fuel_farm
airport_props.glb       localizer, glideslope, approach_lights, papi, windsock, sign_runway,
                        sign_taxi, edge_light_blue, edge_light_white, follow_me, fire_truck, tug

Scale: metres, compressed like the aircraft (a 16 m airliner stands for a 38 m one), so buildings
are about half their real size and read next to the jets. Every model faces +z and sits on y = 0.
Moving parts are their own nodes, named after the asset: radar antennas spin about y, hangar and
fire-station doors slide or lift, the windsock swings about y and droops about x, the fire-truck
turret turns, wheels spin about x. Glowing parts use `glow_*` materials; `brand` is the app colour.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import (anchor, box, combine, cylinder, export, loft, material, point, reset_scene,
                 root, slab, sphere, turn, wheel)


def materials():
    return {
        "concrete": material("concrete", "#e9edf2", roughness=0.85),
        "wall": material("wall", "#f5f7fa", roughness=0.7),
        "panel": material("panel", "#d7dde6", roughness=0.6, metallic=0.1),
        "roof": material("roof", "#c4ccd8", roughness=0.75, metallic=0.2),
        "dark": material("dark_trim", "#3a4352", roughness=0.5, metallic=0.3),
        "brand": material("brand", "#ff6b3d", roughness=0.45),
        "glass": material("glass", "#1d2633", roughness=0.1, metallic=0.4),
        "tint": material("glass_tint", "#7fa6c9", roughness=0.08, metallic=0.3),
        "metal": material("metal", "#c9d0db", roughness=0.28, metallic=0.75),
        "steel": material("steel", "#8d97a6", roughness=0.4, metallic=0.7),
        "white_paint": material("paint_white", "#ffffff", roughness=0.5),
        "yellow": material("sign_yellow", "#ffd23f", roughness=0.5),
        "black": material("sign_black", "#20242c", roughness=0.6),
        "red_paint": material("paint_red", "#e8453c", roughness=0.45),
        "window": material("glow_window", "#ffe9b8", emission="#ffe2a0", strength=1.5),
        "red": material("glow_red", "#ff3b3b", emission="#ff3b3b", strength=4),
        "green": material("glow_green", "#3dff8a", emission="#3dff8a", strength=4),
        "white": material("glow_white", "#ffffff", emission="#ffffff", strength=4),
        "blue": material("glow_blue", "#4d8dff", emission="#4d8dff", strength=4),
        "amber": material("glow_amber", "#ffb547", emission="#ffb547", strength=4),
    }


def lamp(name, position, mat, parent, radius=0.18):
    """A glowing bulb as its own node so the app can blink or recolour it."""
    bulb = sphere(f"{name}_bulb", radius, position, mat, segments=10)
    return combine(name, [bulb], origin=position, parent=parent)


def around(count, radius, height, make, phase=0.0):
    """Call make(index, x, forward, angle) at `count` points on a circle."""
    parts = []
    for index in range(count):
        angle = phase + 2 * math.pi * index / count
        parts.append(make(index, radius * math.sin(angle), radius * math.cos(angle), angle))
    return parts


def rooftop_unit(name, center, mats):
    """An HVAC box with a fan grille and a vent hood."""
    x, up, forward = center
    return [
        box(f"{name}_case", (1.6, 0.8, 1.2), (x, up + 0.4, forward), mats["panel"], round_by=0.08),
        cylinder(f"{name}_grille", 0.42, 0.06, (x - 0.3, up + 0.83, forward), mats["dark"], sides=16),
        cylinder(f"{name}_hub", 0.1, 0.1, (x - 0.3, up + 0.86, forward), mats["metal"], sides=8),
        box(f"{name}_hood", (0.4, 0.3, 0.5), (x + 0.45, up + 0.95, forward), mats["metal"], round_by=0.05),
    ]


# --- buildings -----------------------------------------------------------------------------------

def control_tower(name, shaft_height, cab_radius, mats, base=True):
    group = root(name)
    parts = []
    if base:
        parts.append(box(f"{name}_base", (7.0, 3.2, 6.0), (0, 1.6, 0), mats["wall"], round_by=0.2))
        parts.append(box(f"{name}_base_glass", (5.6, 1.4, 0.08), (0, 1.8, 3.02), mats["tint"], round_by=0.03))
        parts.append(box(f"{name}_base_entry", (1.8, 2.2, 0.6), (0, 1.1, 3.2), mats["brand"], round_by=0.1))
        parts += rooftop_unit(f"{name}_unit", (-1.8, 3.2, -1.2), mats)
    shaft_bottom = 3.2 if base else 0.0
    parts.append(cylinder(f"{name}_shaft", 1.3 * cab_radius / 2.6, shaft_height, (0, shaft_bottom + shaft_height / 2, 0), mats["concrete"], sides=24, radius_end=1.05 * cab_radius / 2.6, round_by=0.05))
    # Panel lines: shallow collars every few metres, and a service door with vents at the foot.
    for level in range(1, int(shaft_height // 3)):
        up = shaft_bottom + level * 3
        fraction = (up - shaft_bottom) / shaft_height
        radius = (1.3 - 0.25 * fraction) * cab_radius / 2.6
        parts.append(cylinder(f"{name}_collar{level}", radius + 0.03, 0.12, (0, up, 0), mats["panel"], sides=24))
    parts.append(box(f"{name}_slit", (0.25, shaft_height * 0.7, 0.1), (0, shaft_bottom + shaft_height * 0.45, 1.18 * cab_radius / 2.6), mats["tint"], round_by=0.05))
    cab_floor = shaft_bottom + shaft_height
    parts.append(cylinder(f"{name}_underdeck", cab_radius * 0.55, 1.4, (0, cab_floor - 0.3, 0), mats["wall"], sides=8, radius_end=cab_radius * 1.02, round_by=0.12))
    parts.append(cylinder(f"{name}_catwalk", cab_radius * 1.18, 0.16, (0, cab_floor + 0.45, 0), mats["steel"], sides=8, round_by=0.04))
    parts += around(16, cab_radius * 1.14, 0, lambda index, x, forward, angle: cylinder(f"{name}_rail{index}", 0.035, 0.9, (x, cab_floor + 0.95, forward), mats["steel"], sides=6))
    parts.append(cylinder(f"{name}_handrail", cab_radius * 1.14, 0.06, (0, cab_floor + 1.38, 0), mats["steel"], sides=8))
    # Glass cab flaring outwards, eight slanted mullions and a lit interior band.
    cab_height = 2.6
    cab_middle = cab_floor + 0.55 + cab_height / 2
    parts.append(cylinder(f"{name}_cab", cab_radius * 0.92, cab_height, (0, cab_middle, 0), mats["glass"], sides=8, radius_end=cab_radius * 1.05, round_by=0.03))
    parts.append(cylinder(f"{name}_console", cab_radius * 0.9, 0.5, (0, cab_floor + 0.85, 0), mats["window"], sides=8))

    def mullion(index, x, forward, angle):
        post = box(f"{name}_mullion{index}", (0.12, cab_height + 0.1, 0.12), (x, cab_middle, forward), mats["dark"], round_by=0.03)
        turn(post, "up", angle)
        return turn(post, "x", -0.08)

    parts += around(8, cab_radius * 0.99, 0, mullion, phase=math.pi / 8)
    roof_up = cab_floor + 0.55 + cab_height
    parts.append(cylinder(f"{name}_roof", cab_radius * 1.15, 0.45, (0, roof_up + 0.2, 0), mats["wall"], sides=8, radius_end=cab_radius * 0.9, round_by=0.1))
    parts.append(cylinder(f"{name}_roof_band", cab_radius * 1.16, 0.14, (0, roof_up + 0.05, 0), mats["brand"], sides=8))
    parts.append(cylinder(f"{name}_mast", 0.07, 3.0, (0.6, roof_up + 1.9, 0.4), mats["steel"], sides=8))
    parts.append(sphere(f"{name}_radome", 0.55, (-0.7, roof_up + 0.95, -0.3), mats["white_paint"], segments=16))
    parts.append(cylinder(f"{name}_radome_base", 0.3, 0.4, (-0.7, roof_up + 0.55, -0.3), mats["panel"], sides=12))
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_beacon", (0.6, roof_up + 3.5, 0.4), mats["red"], group, radius=0.16)
    anchor(f"{name}_label", (0, roof_up + 5.0, 0), group)
    anchor(f"{name}_cab_view", (0, cab_middle, 0), group)
    return group


def terminal(name, length, depth, height, mats, pier=False):
    group = root(name)
    parts = [box(f"{name}_hall", (length, height, depth), (0, height / 2, 0), mats["wall"], round_by=0.25)]
    # Curtain wall on the airside face, with mullions and a brand band under the roof edge.
    parts.append(box(f"{name}_curtain", (length - 1.2, height - 1.2, 0.1), (0, height / 2 - 0.1, depth / 2 + 0.03), mats["tint"], round_by=0.03))
    mullions = int(length // 2.4)
    for index in range(mullions + 1):
        x = -length / 2 + 0.6 + index * (length - 1.2) / mullions
        parts.append(box(f"{name}_mullion{index}", (0.1, height - 1.2, 0.16), (x, height / 2 - 0.1, depth / 2 + 0.06), mats["dark"], round_by=0.02))
    parts.append(box(f"{name}_transom", (length - 1.2, 0.1, 0.16), (0, height * 0.5, depth / 2 + 0.06), mats["dark"], round_by=0.02))
    parts.append(slab(f"{name}_canopy", [(-length / 2 - 0.8, -depth / 2 - 0.4), (length / 2 + 0.8, -depth / 2 - 0.4), (length / 2 + 0.8, depth / 2 + 1.6), (-length / 2 - 0.8, depth / 2 + 1.6)], 0.45, mats["roof"], center=(0, height + 0.2, 0), round_by=0.12))
    parts.append(box(f"{name}_fascia", (length + 1.7, 0.3, 0.12), (0, height + 0.05, depth / 2 + 1.62), mats["brand"], round_by=0.04))
    for index in range(int(length // 9)):
        parts += rooftop_unit(f"{name}_unit{index}", (-length / 2 + 4 + index * 9, height + 0.42, -depth / 4), mats)
    # Landside windows: a lit row so the building reads at dusk.
    for index in range(int(length // 3)):
        parts.append(box(f"{name}_window{index}", (1.6, 1.0, 0.08), (-length / 2 + 2 + index * 3, height * 0.6, -depth / 2 - 0.02), mats["window"], round_by=0.03))
    if pier:
        pier_length = depth * 2.2
        parts.append(box(f"{name}_pier", (5.0, height * 0.7, pier_length), (length / 2 - 4, height * 0.35, depth / 2 + pier_length / 2), mats["wall"], round_by=0.2))
        parts.append(box(f"{name}_pier_glass", (5.1, height * 0.3, pier_length - 1.0), (length / 2 - 4, height * 0.4, depth / 2 + pier_length / 2), mats["tint"], round_by=0.05))
        parts.append(box(f"{name}_pier_roof", (5.6, 0.3, pier_length + 0.4), (length / 2 - 4, height * 0.7 + 0.1, depth / 2 + pier_length / 2), mats["roof"], round_by=0.1))
        for index in range(3):
            parts.append(box(f"{name}_gate{index}", (0.3, 2.2, 1.6), (length / 2 - 6.6, height * 0.35, depth / 2 + 3 + index * pier_length / 3), mats["brand"], round_by=0.08))
    combine(f"{name}_body", parts, parent=group)
    anchor(f"{name}_label", (0, height + 3, 0), group)
    return group


def hangar(name, width, length, wall_height, rise, mats, door_colour):
    """Arched-roof hangar with two sliding doors on the front (+z) face."""
    group = root(name)
    half = width / 2
    parts = [
        box(f"{name}_side_left", (0.4, wall_height, length), (half - 0.2, wall_height / 2, 0), mats["panel"], round_by=0.08),
        box(f"{name}_side_right", (0.4, wall_height, length), (-half + 0.2, wall_height / 2, 0), mats["panel"], round_by=0.08),
        box(f"{name}_back", (width, wall_height, 0.4), (0, wall_height / 2, -length / 2 + 0.2), mats["panel"], round_by=0.08),
    ]
    arch = [(half * math.cos(step * math.pi / 12), wall_height + rise * math.sin(step * math.pi / 12)) for step in range(13)]
    roof_rings = [(position, half + 0.25, rise + 0.25, wall_height) for position in (length / 2 + 0.3, -length / 2 - 0.3)]
    parts.append(loft(f"{name}_roof", roof_rings, mats["roof"], sides=48, keep_face=lambda x, up, forward: up > wall_height + 0.05))
    for label, forward in (("front", length / 2 - 0.2), ("rear", -length / 2 + 0.2)):
        parts.append(slab(f"{name}_gable_{label}", arch, 0.4, mats["panel"], plane="front", center=(0, 0, forward), round_by=0.06))
    # Corrugation ribs along the roof and the side walls.
    for index in range(1, int(length // 2.5)):
        forward = -length / 2 + index * 2.5
        parts.append(loft(f"{name}_rib{index}", [(forward + 0.08, half + 0.32, rise + 0.32, wall_height), (forward - 0.08, half + 0.32, rise + 0.32, wall_height)], mats["steel"], sides=48, keep_face=lambda x, up, f: up > wall_height + 0.05 and abs(f - forward) < 0.07))
    for side in (1, -1):
        for index in range(1, int(length // 4)):
            parts.append(box(f"{name}_pilaster{side}_{index}", (0.12, wall_height, 0.3), (side * (half + 0.02), wall_height / 2, -length / 2 + index * 4), mats["steel"], round_by=0.03))
    parts.append(box(f"{name}_door_header", (width, 0.8, 0.5), (0, wall_height - 0.4, length / 2), mats["brand"], round_by=0.08))
    parts.append(box(f"{name}_door_track", (width, 0.12, 0.6), (0, 0.06, length / 2 + 0.1), mats["steel"], round_by=0.03))
    parts += rooftop_unit(f"{name}_vent", (0, wall_height + rise - 0.1, -length / 4), mats)
    combine(f"{name}_body", parts, parent=group)
    # Doors pivot at their bottom centre and slide along x.
    door_height = wall_height - 0.8
    for label, side in (("left", 1), ("right", -1)):
        center = (side * width / 4, door_height / 2, length / 2 + 0.3)
        panels = [box(f"{name}_door_{label}_leaf", (width / 2 - 0.1, door_height, 0.25), center, door_colour, round_by=0.06)]
        for rib in range(1, 6):
            panels.append(box(f"{name}_door_{label}_rib{rib}", (width / 2 - 0.3, 0.08, 0.06), (center[0], rib * door_height / 6, length / 2 + 0.44), mats["steel"], round_by=0.02))
        panels.append(box(f"{name}_door_{label}_window", (width / 2 - 1.2, 0.5, 0.06), (center[0], door_height * 0.82, length / 2 + 0.45), mats["tint"], round_by=0.02))
        combine(f"{name}_door_{label}", panels, origin=(center[0], 0, center[2]), parent=group)
    lamp(f"{name}_lamp", (0, wall_height + 0.3, length / 2 + 0.45), mats["amber"], group, radius=0.15)
    anchor(f"{name}_label", (0, wall_height + rise + 2, 0), group)
    return group


def fire_station(name, mats):
    group = root(name)
    parts = [
        box(f"{name}_bays", (12.0, 4.4, 7.0), (0, 2.2, 0), mats["wall"], round_by=0.2),
        box(f"{name}_office", (5.0, 6.4, 6.0), (-8.2, 3.2, -0.5), mats["wall"], round_by=0.2),
        box(f"{name}_watch", (4.0, 1.8, 4.0), (-8.2, 7.3, -0.5), mats["glass"], round_by=0.1),
        box(f"{name}_watch_roof", (4.6, 0.3, 4.6), (-8.2, 8.35, -0.5), mats["roof"], round_by=0.08),
        box(f"{name}_stripe", (12.1, 0.4, 7.1), (0, 3.9, 0), mats["red_paint"], round_by=0.08),
        box(f"{name}_roof", (12.4, 0.3, 7.4), (0, 4.5, 0), mats["roof"], round_by=0.08),
    ]
    for index in range(3):
        parts.append(box(f"{name}_window{index}", (1.0, 1.0, 0.08), (-8.2 + (index - 1) * 1.4, 3.6, 2.52), mats["window"], round_by=0.03))
    parts += rooftop_unit(f"{name}_unit", (3, 4.65, -1.5), mats)
    combine(f"{name}_body", parts, parent=group)
    for index in range(3):
        x = -4 + index * 4
        parts = [box(f"{name}_door{index}_leaf", (3.2, 3.4, 0.15), (x, 1.7, 3.55), mats["panel"], round_by=0.04)]
        for slat in range(1, 8):
            parts.append(box(f"{name}_door{index}_slat{slat}", (3.1, 0.05, 0.06), (x, slat * 3.4 / 8, 3.65), mats["steel"], round_by=0.015))
        # Roll-up door: pivot at the top edge, the app shrinks or lifts it.
        combine(f"{name}_door{index}", parts, origin=(x, 3.4, 3.55), parent=group)
    lamp(f"{name}_beacon", (-8.2, 8.8, -0.5), mats["red"], group)
    anchor(f"{name}_label", (0, 10, 0), group)
    return group


def radar_asr(name, mats):
    """Surveillance radar: a lattice tower with a platform and a rotating curved reflector."""
    group = root(name)
    height = 12.0
    parts = []
    for side_x in (1, -1):
        for side_forward in (1, -1):
            leg = cylinder(f"{name}_leg{side_x}{side_forward}", 0.14, height, (side_x * 1.2, height / 2, side_forward * 1.2), mats["steel"], sides=8)
            parts.append(leg)
    for level in range(1, 5):
        up = level * height / 5
        for label, size in (("x", (2.4, 0.1, 0.1)), ("z", (0.1, 0.1, 2.4))):
            for side in (1, -1):
                offset = (0, up, side * 1.2) if label == "x" else (side * 1.2, up, 0)
                parts.append(box(f"{name}_brace{level}{label}{side}", size, offset, mats["steel"], round_by=0.02))
        for side in (1, -1):
            cross = box(f"{name}_cross{level}{side}", (0.07, 2.8, 0.07), (side * 1.2, up - height / 10, 0), mats["steel"], round_by=0.02)
            turn(cross, "x", 0.62 * (1 if level % 2 else -1))
            parts.append(cross)
    parts.append(box(f"{name}_platform", (3.8, 0.3, 3.8), (0, height + 0.15, 0), mats["panel"], round_by=0.08))
    parts.append(box(f"{name}_shelter", (2.2, 1.2, 1.6), (0, height + 0.9, -0.6), mats["wall"], round_by=0.1))
    parts.append(cylinder(f"{name}_pedestal", 0.45, 0.8, (0, height + 1.9, 0.5), mats["metal"], sides=16))
    parts.append(box(f"{name}_base_hut", (3.6, 2.4, 3.0), (3.2, 1.2, 0), mats["wall"], round_by=0.12))
    parts.append(box(f"{name}_hut_door", (0.9, 1.9, 0.08), (3.2, 0.95, 1.52), mats["brand"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    pivot = (0, height + 2.3, 0.5)
    reflector_outline = [(-3.2 + 6.4 * step / 10, 0.7 * (1 - ((step - 5) / 5) ** 2) * 0.5) for step in range(11)]
    reflector_outline += [(x, y + 1.6) for x, y in reversed(reflector_outline)]
    antenna = [
        slab(f"{name}_reflector", [(x, y) for x, y in reflector_outline], 0.12, mats["white_paint"], plane="front", center=(0, pivot[1] - 0.2, pivot[2] - 0.3), round_by=0.04),
        box(f"{name}_feed_arm", (0.12, 0.12, 1.6), (0, pivot[1] + 0.2, pivot[2] + 0.5), mats["steel"], round_by=0.03),
        box(f"{name}_feed_horn", (0.9, 0.4, 0.4), (0, pivot[1] + 0.25, pivot[2] + 1.3), mats["dark"], round_by=0.06),
        box(f"{name}_strip", (6.2, 0.12, 0.05), (0, pivot[1] + 1.15, pivot[2] - 0.22), mats["brand"], round_by=0.02),
        cylinder(f"{name}_turntable", 0.35, 0.3, (0, pivot[1] - 0.15, pivot[2]), mats["metal"], sides=16),
    ]
    combine(f"{name}_antenna", antenna, origin=pivot, parent=group)
    lamp(f"{name}_beacon", (0, pivot[1] + 2.2, pivot[2] - 0.3), mats["red"], group, radius=0.14)
    anchor(f"{name}_label", (0, height + 6, 0), group)
    return group


def radar_weather(name, mats):
    group = root(name)
    parts = [
        cylinder(f"{name}_tower", 1.4, 9.0, (0, 4.5, 0), mats["concrete"], sides=12, radius_end=1.1, round_by=0.05),
        cylinder(f"{name}_deck", 2.4, 0.4, (0, 9.2, 0), mats["panel"], sides=16, round_by=0.08),
        sphere(f"{name}_dome", 2.6, (0, 11.4, 0), mats["white_paint"], segments=24),
        cylinder(f"{name}_dome_ring", 2.35, 0.25, (0, 9.6, 0), mats["brand"], sides=24),
        box(f"{name}_door", (0.9, 2.0, 0.1), (0, 1.0, 1.42), mats["dark"], round_by=0.03),
        box(f"{name}_hut", (3.0, 2.2, 2.4), (3.0, 1.1, 0), mats["wall"], round_by=0.1),
    ]
    for level in range(1, 3):
        parts.append(cylinder(f"{name}_collar{level}", 1.4 - 0.1 * level + 0.03, 0.12, (0, level * 3, 0), mats["panel"], sides=12))
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_beacon", (0, 14.15, 0), mats["red"], group, radius=0.14)
    anchor(f"{name}_label", (0, 16, 0), group)
    return group


def fuel_farm(name, mats):
    group = root(name)
    parts = [box(f"{name}_bund", (16.0, 0.6, 9.0), (0, 0.3, 0), mats["concrete"], round_by=0.1)]
    for index, x in enumerate((-5.0, 0.0, 5.0)):
        parts.append(cylinder(f"{name}_tank{index}", 2.1, 4.0, (x, 2.6, 0), mats["wall"], sides=28, round_by=0.12))
        parts.append(cylinder(f"{name}_lid{index}", 2.0, 0.3, (x, 4.7, 0), mats["roof"], sides=28, radius_end=1.2, round_by=0.05))
        parts.append(cylinder(f"{name}_band{index}", 2.13, 0.35, (x, 3.6, 0), mats["brand"], sides=28))
        parts.append(box(f"{name}_ladder{index}", (0.4, 4.0, 0.08), (x + 1.2, 2.6, 1.85), mats["steel"], round_by=0.02))
        parts.append(cylinder(f"{name}_valve{index}", 0.25, 0.5, (x, 0.85, 2.6), mats["metal"], sides=10))
    parts.append(cylinder(f"{name}_pipe", 0.16, 14.0, (0, 0.9, 3.1), mats["metal"], axis="x", sides=10))
    combine(f"{name}_body", parts, parent=group)
    anchor(f"{name}_label", (0, 7, 0), group)
    return group


def build_buildings():
    reset_scene()
    mats = materials()
    control_tower("tower_main", shaft_height=18.0, cab_radius=2.6, mats=mats)
    control_tower("tower_small", shaft_height=9.0, cab_radius=2.0, mats=mats, base=False)
    terminal("terminal_main", length=40.0, depth=12.0, height=6.0, mats=mats)
    terminal("terminal_pier", length=24.0, depth=10.0, height=5.0, mats=mats, pier=True)
    hangar("hangar_a", width=22.0, length=20.0, wall_height=6.0, rise=4.0, mats=mats, door_colour=mats["wall"])
    hangar("hangar_b", width=16.0, length=14.0, wall_height=5.0, rise=3.0, mats=mats, door_colour=mats["brand"])
    fire_station("fire_station", mats)
    radar_asr("radar_asr", mats)
    radar_weather("radar_weather", mats)
    fuel_farm("fuel_farm", mats)
    export("airport_buildings.glb")


# --- props and vehicles -------------------------------------------------------------------------

def localizer(name, mats):
    group = root(name)
    parts = [box(f"{name}_rail", (14.0, 0.25, 0.3), (0, 1.2, 0), mats["steel"], round_by=0.05)]
    for index in range(12):
        x = -6.5 + index * (13 / 11)
        parts.append(cylinder(f"{name}_post{index}", 0.06, 1.2, (x, 0.6, 0), mats["steel"], sides=8))
        parts.append(box(f"{name}_element{index}", (0.12, 0.9, 0.7), (x, 1.75, 0.1), mats["red_paint" if index % 2 else "white_paint"], round_by=0.04))
    parts.append(box(f"{name}_shelter", (2.0, 1.8, 1.6), (0, 0.9, -3.0), mats["wall"], round_by=0.1))
    parts.append(box(f"{name}_shelter_door", (0.7, 1.4, 0.06), (0, 0.75, -2.18), mats["dark"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_lamp", (6.5, 2.4, 0.1), mats["red"], group, radius=0.12)
    return group


def glideslope(name, mats):
    group = root(name)
    parts = [cylinder(f"{name}_mast", 0.16, 9.0, (0, 4.5, 0), mats["red_paint"], sides=10)]
    for index, up in enumerate((3.0, 5.2, 7.4)):
        parts.append(box(f"{name}_antenna{index}", (1.4, 0.5, 0.25), (0, up, 0.35), mats["white_paint"], round_by=0.05))
        parts.append(box(f"{name}_arm{index}", (0.1, 0.1, 0.4), (0, up, 0.15), mats["steel"], round_by=0.02))
    for level in range(1, 4):
        parts.append(cylinder(f"{name}_band{level}", 0.17, 0.5, (0, level * 2.2, 0), mats["white_paint"], sides=10))
    parts.append(box(f"{name}_shelter", (2.0, 1.8, 1.6), (2.0, 0.9, 0), mats["wall"], round_by=0.1))
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_lamp", (0, 9.2, 0), mats["red"], group, radius=0.14)
    return group


def approach_lights(name, mats):
    """Five light bars on posts stepping away from the threshold along -z, one glow node each
    (named <name>_bar0 nearest) so the app can run the sequenced flash."""
    group = root(name)
    posts = []
    for station in range(5):
        forward = -station * 6.0
        height = 0.6 + station * 0.25
        posts.append(cylinder(f"{name}_post{station}", 0.08, height, (0, height / 2, forward), mats["steel"], sides=8))
        posts.append(box(f"{name}_crossbar{station}", (4.2, 0.12, 0.14), (0, height, forward), mats["steel"], round_by=0.03))
        bulbs = [sphere(f"{name}_bar{station}_lamp{lamp_index}", 0.16, (-1.8 + lamp_index * 0.9, height + 0.16, forward), mats["white"], segments=8) for lamp_index in range(5)]
        combine(f"{name}_bar{station}", bulbs, origin=(0, height, forward), parent=group)
    combine(f"{name}_body", posts, parent=group)
    return group


def papi(name, mats):
    """Four light units in a row along x; lenses <name>_lens0..3 are recoloured red or white."""
    group = root(name)
    parts = []
    for index in range(4):
        x = index * 1.6
        parts += [
            box(f"{name}_unit{index}", (1.0, 0.6, 0.9), (x, 0.5, 0), mats["panel"], round_by=0.08),
            cylinder(f"{name}_leg{index}", 0.05, 0.3, (x, 0.15, 0), mats["steel"], sides=6),
            box(f"{name}_hood{index}", (1.05, 0.08, 0.3), (x, 0.84, 0.4), mats["dark"], round_by=0.02),
        ]
        lens = cylinder(f"{name}_lens{index}_glass", 0.18, 0.1, (x, 0.55, 0.47), mats["white"], axis="forward", sides=12)
        combine(f"{name}_lens{index}", [lens], origin=(x, 0.55, 0.47), parent=group)
    combine(f"{name}_body", parts, parent=group)
    return group


def windsock(name, mats):
    group = root(name)
    height = 5.0
    parts = [
        box(f"{name}_pad", (1.6, 0.2, 1.6), (0, 0.1, 0), mats["concrete"], round_by=0.05),
        cylinder(f"{name}_mast", 0.08, height, (0, height / 2, 0), mats["steel"], sides=10),
        cylinder(f"{name}_lamp_cap", 0.12, 0.2, (0, height + 0.1, 0), mats["dark"], sides=10),
    ]
    combine(f"{name}_body", parts, parent=group)
    # The sock streams along +x from the mast; it swings about y and droops about z at the pivot.
    pivot = (0, height - 0.3, 0)

    sock = loft(f"{name}_cone", [(0.05 + step * 0.5, 0.42 - step * 0.06, 0.42 - step * 0.06, 0) for step in range(6)], [mats["brand"], mats["white_paint"]], sides=18, axis="up", material_for_face=lambda x, up, forward: int((up - 0.05) // 0.5) % 2)
    # The loft along `up` lies the cone on its side: rotate it so its axis runs along +x.
    turn(sock, "forward", -math.pi / 2)
    sock.location = sock.location + point(*pivot)
    ring = cylinder(f"{name}_ring", 0.45, 0.06, (0.05, pivot[1], 0), mats["steel"], axis="x", sides=16)
    combine(f"{name}_sock", [sock, ring], origin=pivot, parent=group)
    lamp(f"{name}_lamp", (0, height + 0.3, 0), mats["red"], group, radius=0.1)
    return group


def sign(name, plate_colour, mats, panels=3):
    """A taxiway-style sign: a plate on frangible legs with blank panels; text is drawn by the app
    at <name>_text."""
    group = root(name)
    width = panels * 1.0
    parts = [
        box(f"{name}_plate", (width, 0.8, 0.3), (0, 0.85, 0), mats["dark"], round_by=0.06),
        box(f"{name}_base", (width + 0.2, 0.12, 0.5), (0, 0.06, 0), mats["concrete"], round_by=0.03),
    ]
    for index in range(panels):
        parts.append(box(f"{name}_face{index}", (0.9, 0.62, 0.06), (-width / 2 + 0.5 + index, 0.85, 0.16), plate_colour if index != 1 else mats["black"], round_by=0.03))
    for side in (1, -1):
        parts.append(cylinder(f"{name}_leg{side}", 0.06, 0.45, (side * width * 0.35, 0.3, 0), mats["steel"], sides=8))
    combine(f"{name}_body", parts, parent=group)
    anchor(f"{name}_text", (0, 0.85, 0.2), group)
    return group


def edge_light(name, glow, mats):
    group = root(name)
    parts = [
        cylinder(f"{name}_base", 0.14, 0.08, (0, 0.04, 0), mats["dark"], sides=12),
        cylinder(f"{name}_stem", 0.04, 0.35, (0, 0.25, 0), mats["yellow"], sides=8),
    ]
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_lens", (0, 0.48, 0), glow, group, radius=0.1)
    return group


def vehicle_wheels(name, positions, radius, width, parent):
    for label, position in positions.items():
        wheel(f"{name}_wheel_{label}", radius, width, position, parent)


def follow_me(name, mats):
    group = root(name)
    body_colour = material("follow_me_yellow", "#ffc83a", roughness=0.4)
    parts = [
        box(f"{name}_chassis", (1.8, 0.7, 4.2), (0, 0.65, 0), body_colour, round_by=0.25),
        box(f"{name}_cabin", (1.6, 0.6, 2.0), (0, 1.25, -0.3), mats["glass"], round_by=0.22),
        box(f"{name}_roof", (1.55, 0.08, 1.8), (0, 1.56, -0.35), body_colour, round_by=0.04),
        box(f"{name}_check", (1.82, 0.22, 4.0), (0, 0.65, 0), mats["dark"], round_by=0.05),
        box(f"{name}_bumper", (1.7, 0.25, 0.2), (0, 0.45, 2.1), mats["dark"], round_by=0.06),
        box(f"{name}_sign", (1.2, 0.45, 0.2), (0, 1.86, -0.4), mats["dark"], round_by=0.06),
    ]
    for side in (1, -1):
        parts.append(box(f"{name}_headlight{side}", (0.3, 0.15, 0.05), (side * 0.6, 0.8, 2.1), mats["white"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_light_bar", (0, 1.86, -0.18), mats["amber"], group, radius=0.12)
    lamp(f"{name}_sign_face", (0, 1.86, -0.29), mats["amber"], group, radius=0.08)
    vehicle_wheels(name, {"fl": (0.85, 0.36, 1.3), "fr": (-0.85, 0.36, 1.3), "rl": (0.85, 0.36, -1.3), "rr": (-0.85, 0.36, -1.3)}, 0.36, 0.26, group)
    return group


def fire_truck(name, mats):
    group = root(name)
    red = mats["red_paint"]
    parts = [
        box(f"{name}_cab", (2.6, 2.0, 2.2), (0, 2.0, 3.2), red, round_by=0.3),
        box(f"{name}_windscreen", (2.3, 0.9, 0.1), (0, 2.45, 4.32), mats["glass"], round_by=0.06),
        box(f"{name}_tank", (2.6, 2.3, 5.6), (0, 2.15, -0.8), red, round_by=0.3),
        box(f"{name}_stripe", (2.62, 0.25, 7.9), (0, 1.6, 0.3), mats["white_paint"], round_by=0.06),
        box(f"{name}_skirt", (2.4, 0.5, 7.6), (0, 0.85, 0.3), mats["dark"], round_by=0.1),
    ]
    for index in range(4):
        parts.append(box(f"{name}_locker{index}", (0.06, 1.1, 1.2), (1.31, 2.2, 1.3 - index * 1.35), mats["panel"], round_by=0.03))
        parts.append(box(f"{name}_locker{index}_r", (0.06, 1.1, 1.2), (-1.31, 2.2, 1.3 - index * 1.35), mats["panel"], round_by=0.03))
    combine(f"{name}_body", parts, parent=group)
    turret_pivot = (0, 3.3, 2.0)
    turret = [
        cylinder(f"{name}_turret_base", 0.35, 0.3, (0, 3.45, 2.0), mats["metal"], sides=12),
        cylinder(f"{name}_turret_barrel", 0.12, 1.6, (0, 3.75, 2.7), mats["metal"], axis="forward", sides=10),
        cylinder(f"{name}_turret_nozzle", 0.16, 0.3, (0, 3.75, 3.55), mats["dark"], axis="forward", sides=10),
    ]
    combine(f"{name}_turret", turret, origin=turret_pivot, parent=group)
    for side, label in ((1, "l"), (-1, "r")):
        lamp(f"{name}_beacon_{label}", (side * 0.9, 3.1, 3.4), mats["red"] if side > 0 else mats["blue"], group, radius=0.14)
    vehicle_wheels(name, {f"{axle}{side_label}": (side * 1.2, 0.6, forward) for axle, forward in (("a", 3.0), ("b", -0.6), ("c", -2.4)) for side, side_label in ((1, "l"), (-1, "r"))}, 0.6, 0.42, group)
    return group


def tug(name, mats):
    group = root(name)
    colour = mats["brand"]
    parts = [
        box(f"{name}_chassis", (2.2, 0.8, 3.6), (0, 0.75, 0), colour, round_by=0.2),
        box(f"{name}_cab", (1.3, 1.0, 1.2), (0.3, 1.65, -0.9), mats["glass"], round_by=0.15),
        box(f"{name}_cab_roof", (1.4, 0.1, 1.3), (0.3, 2.2, -0.9), colour, round_by=0.05),
        box(f"{name}_bumper", (2.0, 0.35, 0.3), (0, 0.6, 1.85), mats["dark"], round_by=0.08),
        box(f"{name}_vent", (0.8, 0.06, 0.8), (-0.5, 1.17, 0.6), mats["dark"], round_by=0.02),
        cylinder(f"{name}_hitch", 0.12, 0.4, (0, 0.6, 2.1), mats["metal"], axis="forward", sides=8),
    ]
    combine(f"{name}_body", parts, parent=group)
    lamp(f"{name}_beacon", (0.3, 2.35, -0.9), mats["amber"], group, radius=0.12)
    vehicle_wheels(name, {"fl": (1.0, 0.42, 1.1), "fr": (-1.0, 0.42, 1.1), "rl": (1.0, 0.42, -1.1), "rr": (-1.0, 0.42, -1.1)}, 0.42, 0.34, group)
    return group


def build_props():
    reset_scene()
    mats = materials()
    localizer("localizer", mats)
    glideslope("glideslope", mats)
    approach_lights("approach_lights", mats)
    papi("papi", mats)
    windsock("windsock", mats)
    sign("sign_runway", mats["red_paint"], mats)
    sign("sign_taxi", mats["yellow"], mats, panels=2)
    edge_light("edge_light_blue", mats["blue"], mats)
    edge_light("edge_light_white", mats["white"], mats)
    # Vehicles are modelled at real size and shrunk to the compressed world scale of the aircraft.
    for vehicle in (follow_me("follow_me", mats), fire_truck("fire_truck", mats), tug("tug", mats)):
        vehicle.scale = (0.6, 0.6, 0.6)
    export("airport_props.glb")


build_buildings()
build_props()
