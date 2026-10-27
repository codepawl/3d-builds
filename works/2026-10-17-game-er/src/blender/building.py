"""ED building modules, helipad and site props: building.glb (refs/ed_building.md, refs/helipad.md).

Roots sit on y = 0, origin on the floor at the footprint centre, outside face to +forward. Module grid 4 m.
- wall_low (4.0 x 1.2 m cutaway wall with cap), wall_full (4.0 x 4.2 m with panel joints), wall_window (4.0 x 4.2 m,
  ribbon window), wall_corner (column 0.5 x 4.2 m), floor_tile (4 x 4 m vinyl with joints), floor_tile_alt.
- entrance_walkin: 6 m glass vestibule with curved canopy; <root>_door_l/_door_r slide along x (origin at the
  closed position).
- entrance_ambulance: 4 m bay entrance with <root>_door_l/_door_r and a red-lit hood.
- ambulance_canopy: 9 x 10 m drive-through canopy at 4.3 m clearance, downlights glow.
- helipad: 18 m ground pad with 12 m touchdown square, own red-cross-and-H marking, green edge lights (glow),
  floodlights; <root>_windsock turns about up at its mast.
- road_tile (8 x 8 m asphalt with lane marks), parking_mark, bollard, lamp_post, tree_a/b/c, shrub, bench.
"""
import math

from lib import box, combine, cylinder, export, material, reset_scene, root, slab, sphere
from parts import palette, vent

FLOOR_TO_FLOOR = 4.2


def wall_low(mats):
    group = root("wall_low")
    partition = material("wall_paint", "#eef2f7", roughness=0.6)
    parts = [box("wall_low_body", (4.0, 1.15, 0.2), (0, 0.575, 0), partition, 0.03),
             box("wall_low_cap", (4.04, 0.06, 0.26), (0, 1.18, 0), mats["brand"], 0.02),
             box("wall_low_skirting", (4.0, 0.1, 0.22), (0, 0.05, 0), mats["dark"], 0.01)]
    combine("wall_low_body", parts, parent=group)
    return group


def wall_full(mats, name, window):
    group = root(name)
    cladding = material("cladding", "#f1f4f8", roughness=0.5)
    parts = [
        box(f"{name}_base", (4.0, 0.5, 0.32), (0, 0.25, 0), mats["concrete"], 0.02),
        box(f"{name}_parapet", (4.04, 0.2, 0.36), (0, FLOOR_TO_FLOOR - 0.1, 0), mats["brand"], 0.02),
    ]
    if window:
        parts += [
            box(f"{name}_below", (4.0, 0.6, 0.3), (0, 0.8, 0), cladding, 0.02),
            box(f"{name}_above", (4.0, 1.4, 0.3), (0, 3.3, 0), cladding, 0.02),
            box(f"{name}_glass", (3.9, 1.5, 0.08), (0, 1.85, 0), mats["glass_light"], 0.01),
            box(f"{name}_sill", (4.0, 0.06, 0.4), (0, 1.1, 0.04), mats["grey"], 0.01),
        ]
        for index in range(5):
            parts.append(box(f"{name}_mullion{index}", (0.06, 1.5, 0.14), (-1.95 + index * 0.975, 1.85, 0.0), mats["grey"], 0.01))
    else:
        parts.append(box(f"{name}_panel", (4.0, FLOOR_TO_FLOOR - 0.7, 0.3), (0, 0.5 + (FLOOR_TO_FLOOR - 0.7) / 2, 0), cladding, 0.02))
        for index in range(1, 3):
            parts.append(box(f"{name}_joint_h{index}", (4.0, 0.015, 0.31), (0, 0.5 + index * 1.17, 0), mats["panel"], 0.0))
        parts.append(box(f"{name}_joint_v", (0.015, FLOOR_TO_FLOOR - 0.7, 0.31), (0, 0.5 + (FLOOR_TO_FLOOR - 0.7) / 2, 0), mats["panel"], 0.0))
        parts += vent(f"{name}_louvre", (1.3, 3.2, 0.16), (0.8, 0.5), mats, slats=6)
    combine(f"{name}_body", parts, parent=group)
    return group


def wall_corner(mats):
    group = root("wall_corner")
    parts = [box("wall_corner_column", (0.5, FLOOR_TO_FLOOR, 0.5), (0, FLOOR_TO_FLOOR / 2, 0), material("cladding", "#f1f4f8", roughness=0.5), 0.04),
             box("wall_corner_cap", (0.56, 0.2, 0.56), (0, FLOOR_TO_FLOOR - 0.1, 0), mats["brand"], 0.03)]
    combine("wall_corner_body", parts, parent=group)
    return group


def floor_tile(mats, name, colour):
    group = root(name)
    vinyl = material(f"vinyl_{colour.lstrip('#')}", colour, roughness=0.55)
    parts = [box(f"{name}_slab", (4.0, 0.1, 4.0), (0, -0.05, 0), vinyl, 0.01)]
    for index in range(1, 4):
        parts += [box(f"{name}_joint_x{index}", (4.0, 0.004, 0.012), (0, 0.001, -2 + index), mats["panel"], 0.0),
                  box(f"{name}_joint_z{index}", (0.012, 0.004, 4.0), (-2 + index, 0.001, 0), mats["panel"], 0.0)]
    combine(f"{name}_body", parts, parent=group)
    return group


def sliding_doors(name, group, mats, width, height, forward):
    for side, suffix in ((1, "l"), (-1, "r")):
        leaf_x = side * width / 4
        leaf = [
            box(f"{name}_leaf{suffix}", (width / 2 - 0.04, height - 0.05, 0.04), (leaf_x, height / 2, forward), mats["glass_light"], 0.01),
            box(f"{name}_leaf_frame{suffix}", (width / 2 - 0.02, 0.06, 0.06), (leaf_x, 0.03, forward), mats["grey"], 0.01),
            box(f"{name}_leaf_rail{suffix}", (0.04, height - 0.05, 0.06), (side * 0.02, height / 2, forward), mats["grey"], 0.01),
            box(f"{name}_leaf_band{suffix}", (width / 2 - 0.06, 0.06, 0.045), (leaf_x, 1.3, forward), mats["white"], 0.0),
        ]
        combine(f"{name}_door_{suffix}", leaf, origin=(leaf_x, 0, forward), parent=group)


def entrance_walkin(mats):
    name = "entrance_walkin"
    group = root(name)
    width = 6.0
    parts = [
        box(f"{name}_threshold", (width, 0.04, 2.4), (0, 0.02, 0), mats["dark"], 0.01),
        box(f"{name}_mat", (2.6, 0.012, 1.4), (0, 0.045, 0.3), mats["black"], 0.004),
        box(f"{name}_header", (width, 0.6, 0.3), (0, 3.0, 1.0), mats["white"], 0.03),
        box(f"{name}_header_band", (width + 0.02, 0.12, 0.32), (0, 2.78, 1.0), mats["brand"], 0.01),
        box(f"{name}_door_box", (2.9, 0.18, 0.24), (0, 2.6, 1.0), mats["grey"], 0.02),
        box(f"{name}_sensor", (0.2, 0.06, 0.08), (0, 2.48, 1.12), mats["light_green"], 0.01),
    ]
    for side in (1, -1):
        parts += [
            box(f"{name}_side_glass{side}", (1.5, 2.5, 0.06), (side * 2.25, 1.25, 1.0), mats["glass_light"], 0.01),
            box(f"{name}_side_frame{side}", (0.1, 3.3, 0.24), (side * 2.95, 1.65, 1.0), mats["grey"], 0.02),
            box(f"{name}_return_glass{side}", (0.06, 2.5, 2.2), (side * 2.95, 1.25, -0.1), mats["glass_light"], 0.01),
            box(f"{name}_canopy_post{side}", (0.16, 3.6, 0.16), (side * 2.6, 1.8, 4.0), mats["grey"], 0.03),
            box(f"{name}_bollard_strip{side}", (0.3, 0.9, 0.3), (side * 1.9, 0.45, 3.2), mats["concrete"], 0.08),
        ]
    # Curved canopy: a shallow arched slab over the drop-off.
    canopy_outline = [(-0.2, 3.55), (4.6, 3.35), (4.6, 3.5), (2.2, 3.82), (-0.2, 3.72)]
    parts.append(slab(f"{name}_canopy", canopy_outline, 7.0, mats["white"], plane="side", round_by=0.04))
    parts.append(slab(f"{name}_canopy_edge", [(4.55, 3.33), (4.65, 3.33), (4.65, 3.48), (4.55, 3.48)], 7.02, mats["brand"], plane="side", round_by=0.01))
    for index in range(4):
        parts.append(cylinder(f"{name}_downlight{index}", 0.12, 0.02, (-2.25 + index * 1.5, 3.47, 2.4), mats["light_white"], sides=14))
    combine(f"{name}_body", parts, parent=group)
    sliding_doors(name, group, mats, 2.8, 2.45, 1.0)
    return group


def entrance_ambulance(mats):
    name = "entrance_ambulance"
    group = root(name)
    parts = [
        box(f"{name}_hood", (4.4, 0.7, 0.8), (0, 3.15, 0.3), mats["white"], 0.04),
        box(f"{name}_hood_lamp", (3.6, 0.1, 0.05), (0, 2.85, 0.72), mats["light_red"], 0.02),
        box(f"{name}_jamb_l", (0.3, 3.5, 0.4), (2.05, 1.75, 0), mats["grey"], 0.03),
        box(f"{name}_jamb_r", (0.3, 3.5, 0.4), (-2.05, 1.75, 0), mats["grey"], 0.03),
        box(f"{name}_ramp", (4.0, 0.15, 1.6), (0, 0.075, 0.9), mats["concrete"], 0.02),
        box(f"{name}_bumper_rail", (4.0, 0.12, 0.08), (0, 0.6, 0.25), mats["light_amber"], 0.02),
    ]
    combine(f"{name}_body", parts, parent=group)
    sliding_doors(name, group, mats, 3.8, 2.7, 0.0)
    return group


def ambulance_canopy(mats):
    name = "ambulance_canopy"
    group = root(name)
    clearance = 4.3
    width, depth = 9.0, 10.0
    parts = [
        box(f"{name}_roof", (width, 0.5, depth), (0, clearance + 0.25, 0), mats["white"], 0.06),
        box(f"{name}_fascia", (width + 0.04, 0.3, depth + 0.04), (0, clearance + 0.2, 0), mats["brand"], 0.03),
        box(f"{name}_soffit", (width - 0.4, 0.02, depth - 0.4), (0, clearance - 0.005, 0), mats["panel"], 0.0),
        box(f"{name}_clearance_bar", (width - 1.0, 0.12, 0.12), (0, clearance - 0.25, depth / 2 + 0.5), mats["light_amber"], 0.03),
    ]
    for side in (1, -1):
        parts += [
            box(f"{name}_column_front{side}", (0.4, clearance, 0.4), (side * (width / 2 - 0.3), clearance / 2, depth / 2 - 0.3), mats["grey"], 0.05),
            box(f"{name}_column_back{side}", (0.4, clearance, 0.4), (side * (width / 2 - 0.3), clearance / 2, -depth / 2 + 0.3), mats["grey"], 0.05),
            box(f"{name}_guard{side}", (0.6, 0.9, 0.6), (side * (width / 2 - 0.3), 0.45, depth / 2 - 0.3), mats["light_amber"], 0.08),
            cylinder(f"{name}_bar_post{side}", 0.06, clearance - 0.2, (side * ((width - 1.0) / 2), (clearance - 0.2) / 2, depth / 2 + 0.5), mats["grey"], sides=10),
        ]
    for row in range(3):
        for column in range(2):
            parts.append(box(f"{name}_downlight{row}_{column}", (1.2, 0.04, 0.3), (-2 + column * 4, clearance - 0.03, -3 + row * 3), mats["light_white"], 0.01))
    combine(f"{name}_body", parts, parent=group)
    return group


def helipad(mats):
    name = "helipad"
    group = root(name)
    size, touchdown = 18.0, 12.0
    deck = material("helipad_deck", "#8f98a6", roughness=0.8)
    parts = [
        box(f"{name}_deck", (size, 0.4, size), (0, 0.2, 0), deck, 0.08),
        box(f"{name}_touchdown", (touchdown, 0.01, touchdown), (0, 0.405, 0), material("helipad_tlof", "#a4adba", roughness=0.75), 0.0),
    ]
    for index in range(4):
        angle = index * math.pi / 2
        edge_x, edge_forward = math.sin(angle) * touchdown / 2, math.cos(angle) * touchdown / 2
        long_x = touchdown if index % 2 == 0 else 0.3
        long_forward = 0.3 if index % 2 == 0 else touchdown
        parts.append(box(f"{name}_tlof_line{index}", (long_x, 0.012, long_forward), (edge_x, 0.41, edge_forward), mats["paint_white"], 0.0))
    # Own marking: white disc, red cross, white H inside it.
    parts += [
        cylinder(f"{name}_disc", 4.6, 0.012, (0, 0.415, 0), mats["paint_white"], sides=48),
        box(f"{name}_cross_a", (6.6, 0.014, 2.2), (0, 0.42, 0), mats["paint_red"], 0.0),
        box(f"{name}_cross_b", (2.2, 0.014, 6.6), (0, 0.42, 0), mats["paint_red"], 0.0),
        box(f"{name}_h_left", (0.35, 0.016, 1.8), (-0.55, 0.425, 0), mats["paint_white"], 0.0),
        box(f"{name}_h_right", (0.35, 0.016, 1.8), (0.55, 0.425, 0), mats["paint_white"], 0.0),
        box(f"{name}_h_bar", (1.1, 0.016, 0.3), (0, 0.425, 0), mats["paint_white"], 0.0),
    ]
    lights_per_side = 6
    for side_index in range(4):
        for index in range(lights_per_side):
            along = -touchdown / 2 + touchdown * index / lights_per_side
            if side_index == 0:
                position = (along, touchdown / 2 + 0.4)
            elif side_index == 1:
                position = (touchdown / 2 + 0.4, -along)
            elif side_index == 2:
                position = (-along, -touchdown / 2 - 0.4)
            else:
                position = (-touchdown / 2 - 0.4, along)
            parts.append(cylinder(f"{name}_edge_light{side_index}_{index}", 0.09, 0.12, (position[0], 0.46, position[1]), mats["light_green"], sides=10))
    for corner_x, corner_forward in ((1, 1), (-1, -1)):
        x, forward = corner_x * (size / 2 - 0.6), corner_forward * (size / 2 - 0.6)
        parts += [box(f"{name}_flood_base{corner_x}", (0.3, 0.5, 0.3), (x, 0.65, forward), mats["grey"], 0.04),
                  box(f"{name}_flood_head{corner_x}", (0.4, 0.25, 0.2), (x, 0.95, forward), mats["light_white"], 0.04)]
    for side in (1, -1):
        parts.append(box(f"{name}_net{side}", (size, 0.3, 0.05), (0, 0.55, side * (size / 2 + 0.05)), mats["grey"], 0.01))
    mast = (size / 2 - 1.0, 0.4, -size / 2 + 1.0)
    parts += [cylinder(f"{name}_mast", 0.06, 3.6, (mast[0], 2.2, mast[2]), mats["steel"], sides=10),
              sphere(f"{name}_mast_light", 0.1, (mast[0], 4.05, mast[2]), mats["light_red"], segments=10)]
    combine(f"{name}_body", parts, parent=group)
    cone = cylinder(f"{name}_cone", 0.3, 2.4, (mast[0] + 1.25, 3.8, mast[2]), mats["accent"], axis="x", sides=16, radius_end=0.14)
    stripes = []
    for index, distance in enumerate((0.8, 1.6)):
        # The cone narrows from 0.30 m to 0.14 m over 2.4 m; each white band sits just outside it.
        radius = 0.3 - 0.16 * distance / 2.4 + 0.012
        stripes.append(cylinder(f"{name}_cone_stripe{index}", radius, 0.3, (mast[0] + 0.05 + distance, 3.8, mast[2]), mats["paint_white"], axis="x", sides=16))
    ring_part = cylinder(f"{name}_cone_ring", 0.32, 0.06, (mast[0] + 0.05, 3.8, mast[2]), mats["steel"], axis="x", sides=16)
    combine(f"{name}_windsock", [cone, ring_part] + stripes, origin=(mast[0], 3.8, mast[2]), parent=group)
    return group


def road_tile(mats):
    group = root("road_tile")
    parts = [box("road_tile_asphalt", (8.0, 0.08, 8.0), (0, -0.04, 0), mats["asphalt"], 0.0)]
    for index in range(3):
        parts.append(box(f"road_tile_dash{index}", (0.15, 0.006, 1.6), (0, 0.003, -2.67 + index * 2.67), mats["paint_white"], 0.0))
    for side in (1, -1):
        parts.append(box(f"road_tile_kerb{side}", (0.25, 0.15, 8.0), (side * 3.875, 0.075, 0), mats["concrete"], 0.03))
    combine("road_tile_body", parts, parent=group)
    return group


def parking_mark(mats):
    group = root("parking_mark")
    parts = [box("parking_mark_side_l", (0.12, 0.006, 7.5), (1.6, 0.003, 0), mats["paint_white"], 0.0),
             box("parking_mark_side_r", (0.12, 0.006, 7.5), (-1.6, 0.003, 0), mats["paint_white"], 0.0),
             box("parking_mark_end", (3.32, 0.006, 0.12), (0, 0.003, -3.75), mats["paint_white"], 0.0),
             box("parking_mark_hatch", (2.6, 0.006, 0.4), (0, 0.003, 3.2), mats["light_amber"], 0.0)]
    combine("parking_mark_body", parts, parent=group)
    return group


def bollard(mats):
    group = root("bollard")
    parts = [cylinder("bollard_post", 0.1, 0.9, (0, 0.45, 0), mats["grey"], sides=16, round_by=0.03),
             cylinder("bollard_band", 0.102, 0.08, (0, 0.75, 0), mats["reflective"], sides=16),
             cylinder("bollard_light", 0.07, 0.03, (0, 0.91, 0), mats["light_white"], sides=12)]
    combine("bollard_body", parts, parent=group)
    return group


def lamp_post(mats):
    group = root("lamp_post")
    parts = [cylinder("lamp_post_pole", 0.07, 6.0, (0, 3.0, 0), mats["grey"], sides=12),
             cylinder("lamp_post_base", 0.16, 0.5, (0, 0.25, 0), mats["dark"], sides=12, round_by=0.03),
             box("lamp_post_arm", (0.08, 0.08, 1.0), (0, 5.95, 0.45), mats["grey"], 0.02),
             box("lamp_post_head", (0.3, 0.12, 0.6), (0, 5.9, 0.9), mats["dark"], 0.04),
             box("lamp_post_lens", (0.24, 0.01, 0.5), (0, 5.835, 0.9), mats["light_white"], 0.0)]
    combine("lamp_post_body", parts, parent=group)
    return group


def tree(mats, name, height, crown_radius, crowns):
    group = root(name)
    parts = [cylinder(f"{name}_trunk", 0.12, height * 0.55, (0, height * 0.275, 0), mats["bark"], sides=10, radius_end=0.08)]
    for index, (x, up, forward, scale) in enumerate(crowns):
        parts.append(sphere(f"{name}_crown{index}", crown_radius * scale, (x, height * up, forward), mats["green"], segments=14))
    parts.append(cylinder(f"{name}_grate", 0.6, 0.04, (0, 0.02, 0), mats["dark"], sides=16))
    combine(f"{name}_body", parts, parent=group)
    return group


def shrub(mats):
    group = root("shrub")
    leaf = material("shrub_green", "#6ab57b", roughness=0.85)
    parts = [box("shrub_planter", (1.6, 0.45, 0.7), (0, 0.225, 0), mats["concrete"], 0.05)]
    for index in range(4):
        parts.append(sphere(f"shrub_ball{index}", 0.32, (-0.6 + index * 0.4, 0.62, 0.0), leaf, segments=12))
    combine("shrub_body", parts, parent=group)
    return group


def bench(mats):
    group = root("bench")
    parts = [box("bench_seat", (1.8, 0.06, 0.45), (0, 0.45, 0), mats["wood"], 0.02),
             box("bench_back", (1.8, 0.35, 0.05), (0, 0.72, -0.2), mats["wood"], 0.02)]
    for side in (1, -1):
        parts.append(box(f"bench_leg{side}", (0.06, 0.45, 0.45), (side * 0.75, 0.225, 0), mats["dark"], 0.015))
    combine("bench_body", parts, parent=group)
    return group


def build():
    reset_scene()
    mats = palette()
    groups = [
        wall_low(mats), wall_full(mats, "wall_full", window=False), wall_full(mats, "wall_window", window=True),
        wall_corner(mats), floor_tile(mats, "floor_tile", "#e4e9f0"), floor_tile(mats, "floor_tile_alt", "#d6e4f2"),
        entrance_walkin(mats), entrance_ambulance(mats), ambulance_canopy(mats), helipad(mats), road_tile(mats),
        parking_mark(mats), bollard(mats), lamp_post(mats),
        tree(mats, "tree_a", 5.0, 1.4, [(0, 0.8, 0, 1.0), (0.5, 0.7, 0.3, 0.7), (-0.4, 0.95, -0.2, 0.7)]),
        tree(mats, "tree_b", 4.0, 1.1, [(0, 0.85, 0, 1.0), (0, 1.1, 0, 0.7)]),
        tree(mats, "tree_c", 6.5, 1.0, [(0, 0.6, 0, 1.0), (0, 0.8, 0, 0.85), (0, 0.98, 0, 0.6)]),
        shrub(mats), bench(mats),
    ]
    for index, group in enumerate(groups):
        group.location.x = (index % 5) * 20.0
        group.location.y = -(index // 5) * 20.0
    export("building.glb")


if __name__ == "__main__":
    build()
