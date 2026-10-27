"""Build the Plainfield 1957 asset pack, one GLB per family.

Run: blender --background --factory-startup --python blender/build_assets.py -- <project root> [family ...]
Units are metres, Blender Z up, +X east, +Y north (glTF: +Y up, -Z north). Dimensions and their
sources are in blender/refs/*.md; ASSETS.md lists every node.
"""
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geometry import (  # noqa: E402
    Part, body_ring, box, centered_box, clear_scene, cylinder, empty, export_glb, finish, frustum, loft,
    prism_xz, rotation_z, seeded, sphere, translation,
)

ARGUMENTS = sys.argv[sys.argv.index("--") + 1:]
ROOT = ARGUMENTS[0]
ASSETS = os.path.join(ROOT, "app", "public", "assets")
FOOT = 0.3048
INCH = 0.0254
MANIFEST = {}


# ---------------------------------------------------------------- buildings

def window_material(random_source, warm_share):
    return "window_warm" if random_source.random() < warm_share else "glass_dark"


def facade_windows(width, z_bottom, height, count, front_y, random_source, warm_share, window_width=0.95):
    parts = []
    spacing = width / count
    for index in range(count):
        center_x = -width / 2 + spacing * (index + 0.5)
        parts.append(centered_box((center_x, front_y - 0.04, z_bottom + height / 2), (window_width, 0.08, height), window_material(random_source, warm_share)))
        parts.append(centered_box((center_x, front_y - 0.06, z_bottom - 0.06), (window_width + 0.2, 0.14, 0.1), "trim_dark"))
    return parts


def side_windows(depth, z_bottom, height, count, side_x, random_source, warm_share):
    parts = []
    for index in range(count):
        center_y = depth * (index + 0.7) / (count + 0.4)
        offset = 0.04 if side_x > 0 else -0.04
        parts.append(centered_box((side_x + offset, center_y, z_bottom + height / 2), (0.08, 0.9, height), window_material(random_source, warm_share)))
    return parts


def brick_commercial(name, width, depth, storeys, warm_share=0.45, material_name="brick_dark", door_offset=None):
    """Two-part commercial block front: flat roof, parapet, cornice, storefront. Origin at front centre, front faces -Y."""
    random_source = seeded(name)
    height = 4.3 + 3.7 * (storeys - 1)
    parts = [
        box(-width / 2, 0, 0, width / 2, depth, height, material_name),
        box(-width / 2, -0.05, height, width / 2, 0.35, height + 0.9, material_name),
        box(-width / 2 - 0.12, -0.25, height + 0.55, width / 2 + 0.12, 0.25, height + 0.8, "trim_dark"),
        box(-width / 2 - 0.1, -0.2, 3.55, width / 2 + 0.1, 0.1, 3.8, "trim_dark"),
        box(-width / 2 + 0.25, depth - 0.3, height, width / 2 - 0.25, depth, height + 0.35, material_name),
    ]
    door_x = door_offset if door_offset is not None else 0.0
    parts.append(centered_box((door_x, -0.03, 1.15), (1.1, 0.08, 2.3), "glass_dark"))
    for side in (-1, 1):
        pane_center = door_x + side * (0.55 + (width / 2 - 0.4 - 0.55) / 2) if door_offset is None else door_x + side * 2.2
        pane_width = max(min(width / 2 - 1.0, 4.5), 1.2)
        parts.append(centered_box((pane_center, -0.04, 1.95), (pane_width, 0.08, 2.1), window_material(random_source, warm_share + 0.15)))
        parts.append(centered_box((pane_center, -0.12, 0.42), (pane_width + 0.15, 0.24, 0.84), "trim_dark"))
    parts.append(centered_box((0, -0.04, 3.25), (width - 0.6, 0.06, 0.45), "glass_dark"))
    if storeys > 1:
        window_count = max(2, int(width / 2.3))
        parts += facade_windows(width - 0.8, 5.0, 1.7, window_count, 0.0, random_source, warm_share * 0.6)
    parts += side_windows(depth, 1.2 if storeys == 1 else 5.0, 1.4, max(1, int(depth / 8)), width / 2, random_source, warm_share * 0.4)
    return parts, height


def frame_false_front(name, width, depth, storeys=1, warm_share=0.4):
    """Frame store with a gable roof hidden behind a square false front."""
    random_source = seeded(name)
    eave = 3.4 + 3.0 * (storeys - 1)
    ridge = eave + width * 0.38
    parts = [
        prism_xz([(-width / 2, 0), (width / 2, 0), (width / 2, eave), (0, ridge), (-width / 2, eave)], 0.2, depth, "frame_dark"),
        prism_xz([(-width / 2 - 0.25, eave - 0.1), (width / 2 + 0.25, eave - 0.1), (0, ridge + 0.12)], 0.1, depth + 0.3, "roof_dark"),
        box(-width / 2 - 0.1, 0, 0, width / 2 + 0.1, 0.2, ridge + 0.6, "frame_dark"),
        box(-width / 2 - 0.2, -0.12, ridge + 0.45, width / 2 + 0.2, 0.22, ridge + 0.65, "trim_dark"),
        centered_box((0, -0.03, 1.1), (1.0, 0.08, 2.2), "glass_dark"),
    ]
    for side in (-1, 1):
        parts.append(centered_box((side * width * 0.28, -0.04, 1.6), (width * 0.3, 0.08, 1.8), window_material(random_source, warm_share)))
    if storeys > 1:
        parts += facade_windows(width - 1.0, eave - 2.2, 1.4, 2, -0.0, random_source, warm_share * 0.5)
    parts += side_windows(depth, 1.0, 1.3, max(1, int(depth / 7)), width / 2, random_source, warm_share * 0.4)
    return parts, ridge + 0.65


def gable_house(name, width, depth, eave, pitch=0.75, warm_share=0.5, wing=None, porch=True, chimney=True):
    """Gable-front frame house (optionally upright-and-wing). Origin at front centre, front faces -Y."""
    random_source = seeded(name)
    ridge = eave + width / 2 * pitch
    parts = [
        prism_xz([(-width / 2, 0), (width / 2, 0), (width / 2, eave), (0, ridge), (-width / 2, eave)], 0, depth, "frame_dark"),
        prism_xz([(-width / 2 - 0.35, eave - 0.18), (width / 2 + 0.35, eave - 0.18), (0, ridge + 0.15)], -0.3, depth + 0.3, "roof_dark"),
        box(-width / 2 - 0.05, -0.05, 0, width / 2 + 0.05, depth + 0.05, 0.5, "stone_dark"),
        centered_box((-width * 0.22, -0.03, 1.55), (0.95, 0.08, 2.1), "glass_dark"),
    ]
    floors = [1.0] if eave < 4.5 else [1.0, eave - 2.2]
    for floor_index, z_bottom in enumerate(floors):
        positions = [width * 0.22] if floor_index == 0 else [-width * 0.22, width * 0.22]
        for center_x in positions:
            parts.append(centered_box((center_x, -0.04, z_bottom + 0.75), (0.85, 0.08, 1.5), window_material(random_source, warm_share)))
    parts.append(centered_box((0, -0.04, eave + (ridge - eave) * 0.35), (0.6, 0.08, 0.9), window_material(random_source, warm_share * 0.5)))
    for side in (-1, 1):
        parts += side_windows(depth, 1.0, 1.4, max(1, int(depth / 4)), side * width / 2, random_source, warm_share * 0.6)
    if chimney:
        parts.append(box(-0.3, depth * 0.55, ridge - 1.0, 0.3, depth * 0.55 + 0.55, ridge + 0.9, "brick_dark"))
    if porch:
        porch_width = width * 0.9
        parts.append(box(-porch_width / 2, -2.0, 0, porch_width / 2, 0, 0.45, "wood_dark"))
        parts.append(prism_xz([(-porch_width / 2 - 0.2, 2.6), (porch_width / 2 + 0.2, 2.6), (porch_width / 2 + 0.2, 2.75), (-porch_width / 2 - 0.2, 2.75)], -2.2, 0, "roof_dark"))
        for post_x in (-porch_width / 2 + 0.15, porch_width / 2 - 0.15):
            parts.append(box(post_x - 0.07, -1.95, 0.45, post_x + 0.07, -1.81, 2.6, "trim_dark"))
    if wing:
        wing_width, wing_depth, wing_eave = wing
        wing_ridge = wing_eave + wing_depth / 2 * pitch
        x0 = width / 2
        parts.append(prism_xz([(0, 0), (wing_depth, 0), (wing_depth, wing_eave), (wing_depth / 2, wing_ridge), (0, wing_eave)], 0, wing_width, "frame_dark").transformed(translation((x0 + wing_width, depth * 0.35, 0)) @ rotation_z(90)))
        parts.append(prism_xz([(-0.3, wing_eave - 0.15), (wing_depth + 0.3, wing_eave - 0.15), (wing_depth / 2, wing_ridge + 0.12)], -0.3, wing_width + 0.1, "roof_dark").transformed(translation((x0 + wing_width + 0.05, depth * 0.35, 0)) @ rotation_z(90)))
        for index in range(2):
            parts.append(centered_box((x0 + 1.2 + index * (wing_width - 2.4), depth * 0.35 - 0.04, 1.75), (0.85, 0.08, 1.5), window_material(random_source, warm_share)))
    return parts, ridge


def outline_edges(width, depth, height, thickness=0.12):
    """Red glowing outline along the footprint and roof edge of a box from (-w/2,0) to (w/2,d)."""
    parts = []
    for z in (0.06, height):
        parts.append(box(-width / 2 - thickness, -thickness, z - thickness / 2, width / 2 + thickness, 0, z + thickness / 2, "red_glow"))
        parts.append(box(-width / 2 - thickness, depth, z - thickness / 2, width / 2 + thickness, depth + thickness, z + thickness / 2, "red_glow"))
        parts.append(box(-width / 2 - thickness, 0, z - thickness / 2, -width / 2, depth, z + thickness / 2, "red_glow"))
        parts.append(box(width / 2, 0, z - thickness / 2, width / 2 + thickness, depth, z + thickness / 2, "red_glow"))
    for x in (-width / 2 - thickness / 2, width / 2 + thickness / 2):
        for y in (-thickness / 2, depth + thickness / 2):
            parts.append(centered_box((x, y, height / 2), (thickness, thickness, height), "red_glow"))
    return parts


def disc(center, radius, sides, material_name, thickness=0.02):
    return cylinder((center[0], center[1], center[2] + thickness / 2), radius, thickness, sides, "z", material_name)


FACING = {"S": 0.0, "N": 180.0, "E": 90.0, "W": -90.0}


def place(name, parts, front_point, facing, parent):
    return finish(name, parts, location=front_point, rotation_degrees=FACING[facing], parent=parent, bevel=0.03)


def build_main_street():
    """Main St (N-S, 100 ft) and North St (E-W, 66 ft, WI 73) junction, 1908 Sanborn sheets 1 and 3."""
    root = empty("main_street")
    half_main = 50 * FOOT
    half_north = 33 * FOOT
    nodes = []

    # Ground, streets and sidewalks.
    ground_parts = [box(-130, -150, -0.2, 130, 95, -0.02, "ground_dark")]
    ground_parts.append(box(-half_main, -150, -0.02, half_main, 95, 0.0, "road_dark"))
    ground_parts.append(box(-130, -half_north, -0.02, 130, half_north, 0.0, "road_dark"))
    clark_center = -half_north - 405 * FOOT - 30 * FOOT
    ground_parts.append(box(-130, clark_center - 30 * FOOT, -0.02, 130, clark_center + 30 * FOOT, 0.0, "road_dark"))
    for sign in (-1, 1):
        ground_parts.append(box(min(sign * half_main, sign * (half_main - 3.0)), -150, 0, max(sign * half_main, sign * (half_main - 3.0)), 95, 0.15, "sidewalk"))
        ground_parts.append(box(-130, min(sign * half_north, sign * (half_north - 3.0)), 0, 130, max(sign * half_north, sign * (half_north - 3.0)), 0.15, "sidewalk"))
    nodes.append(finish("street_ground", ground_parts, parent=root))

    def east_side(lot_name, north_edge, south_edge, depth, builder, *options):
        width = north_edge - south_edge
        parts, _ = builder(lot_name, width, depth, *options)
        nodes.append(place(lot_name, parts, (half_main, (north_edge + south_edge) / 2, 0), "W", root))

    def west_side(lot_name, north_edge, south_edge, depth, builder, *options):
        width = north_edge - south_edge
        parts, _ = builder(lot_name, width, depth, *options)
        nodes.append(place(lot_name, parts, (-half_main, (north_edge + south_edge) / 2, 0), "E", root))

    def north_side(lot_name, west_edge, east_edge, depth, builder, *options):
        width = east_edge - west_edge
        parts, _ = builder(lot_name, width, depth, *options)
        nodes.append(place(lot_name, parts, ((west_edge + east_edge) / 2, half_north, 0), "S", root))

    def sheet3_y(pixel_y):
        """Sheet 3 (Aug 1908) at 1.53 px per foot in the 1686 px view; North St south line at y=125."""
        return -half_north - (pixel_y - 125) / 1.53 * FOOT

    # East side of S Main, block C (sheet 3, lots 633-628).
    east_side("sm_lot633_saloon", sheet3_y(125), sheet3_y(162), 25.0, brick_commercial, 2)
    east_side("sm_lot632_furniture", sheet3_y(164), sheet3_y(206), 24.0, brick_commercial, 2)
    east_side("sm_lot631_shop", sheet3_y(209), sheet3_y(247), 12.0, brick_commercial, 1)
    east_side("sm_lot629_bottling", sheet3_y(332), sheet3_y(372), 17.0, frame_false_front, 1)
    east_side("sm_lot628_village_hall", sheet3_y(383), sheet3_y(432), 18.0, brick_commercial, 2)
    for index, (top, bottom) in enumerate(((455, 520), (545, 610), (620, 700))):
        parts, _ = gable_house(f"sm_east_house_{index}", 7.3, 9.0, 4.2 if index != 1 else 5.6)
        nodes.append(place(f"sm_east_house_{index}", parts, (half_main + 6.0, (sheet3_y(top) + sheet3_y(bottom)) / 2, 0), "W", root))

    # West side of S Main, block D: corner bank (1923 photo) and the rest of the Stark Block, opera house, livery.
    nodes.append(build_bank(root, half_main, half_north))
    west_side("sm_stark_block", sheet3_y(180), sheet3_y(212), 34.0, brick_commercial, 2)
    west_side("sm_lot611_shop", sheet3_y(335), sheet3_y(362), 13.0, brick_commercial, 1)
    west_side("sm_lot609_opera_house", sheet3_y(370), sheet3_y(442), 27.0, brick_commercial, 2)
    west_side("sm_lot605_livery", sheet3_y(610), sheet3_y(690), 15.0, frame_false_front, 1)
    west_side("sm_lot604_shed", sheet3_y(700), sheet3_y(745), 12.0, frame_false_front, 1)

    # North side of North St between West St and Main (sheet 1, lots 117-105), from Main going west.
    cursor = -half_main
    for lot_name, width, depth, builder, storeys in (
        ("nn_walker_block", 16.2, 31.0, brick_commercial, 2), ("nn_lot115_shop", 6.0, 12.0, frame_false_front, 1),
        ("nn_lot114_saloon", 7.3, 21.0, brick_commercial, 2), ("nn_lot113_drugs", 7.6, 24.0, brick_commercial, 2),
        ("nn_lot112_barber", 5.0, 12.0, frame_false_front, 1), ("nn_lot109_meat", 7.0, 18.0, frame_false_front, 2),
        ("nn_lot108_saloon", 7.3, 20.0, brick_commercial, 2), ("nn_lot107_shoes", 7.3, 20.0, brick_commercial, 2),
        ("nn_lot106_post_office", 7.3, 18.0, brick_commercial, 2), ("nn_lot105_general", 9.0, 22.0, brick_commercial, 2),
    ):
        if lot_name == "nn_lot109_meat":
            cursor -= 10.0
        north_side(lot_name, cursor - width, cursor, depth, builder, storeys)
        cursor -= width + 0.3

    # North side east of Main (sheet 1, lots 118-123): tin shop, implements, houses.
    north_side("ne_lot118_tin_shop", half_main, half_main + 6.1, 18.0, frame_false_front, 2)
    north_side("ne_lot119_implements", half_main + 6.6, half_main + 19.0, 12.0, frame_false_front, 1)
    for index in range(3):
        parts, _ = gable_house(f"ne_house_{index}", 7.0, 8.5, 4.2 + 1.4 * (index % 2))
        nodes.append(place(f"ne_house_{index}", parts, (half_main + 30.0 + index * 15.0, half_north + 6.0, 0), "S", root))

    nodes.append(build_hardware_store(root, half_main, sheet3_y(262), sheet3_y(330)))
    return root


def build_bank(root, half_main, half_north):
    """Stone two-storey bank after the 1923 photo: 2 bays on Main, 5 bays along North St, raised basement, cornice."""
    random_source = seeded("bank")
    front_width, depth, height = 9.4, 18.0, 9.6
    parts = [
        box(-front_width / 2, 0, 0, front_width / 2, depth, height, "stone_dark"),
        box(-front_width / 2 - 0.15, -0.15, 0, front_width / 2 + 0.15, depth + 0.15, 1.2, "stone_dark"),
        box(-front_width / 2 - 0.35, -0.35, height - 0.2, front_width / 2 + 0.35, depth + 0.35, height + 0.25, "trim_dark"),
        box(-front_width / 2, 0, height + 0.25, front_width / 2, depth, height + 1.0, "stone_dark"),
        box(-front_width / 2 - 0.12, -0.12, 4.9, front_width / 2 + 0.12, depth + 0.12, 5.15, "trim_dark"),
    ]
    for index in range(int(depth / 3.6) + 1):
        pier_y = index * depth / int(depth / 3.6)
        parts.append(centered_box((front_width / 2 + 0.1, pier_y, height + 1.15), (0.5, 0.8, 0.3), "stone_dark"))
        parts.append(centered_box((front_width / 2 + 0.08, pier_y, height / 2), (0.25, 0.7, height), "stone_dark"))
    for floor_z in (2.0, 6.0):
        for index in range(5):
            center_y = depth * (index + 0.5) / 5
            parts.append(centered_box((front_width / 2 + 0.05, center_y, floor_z + 1.0), (0.08, 1.5, 2.0), window_material(random_source, 0.3 if floor_z < 3 else 0.15)))
        for center_x in (-front_width * 0.2, front_width * 0.25):
            parts.append(centered_box((center_x, -0.05, floor_z + 1.0), (1.5, 0.08, 2.0), window_material(random_source, 0.3)))
    parts.append(centered_box((-front_width * 0.32, -0.08, 2.3), (1.3, 0.1, 2.6), "glass_dark"))
    for step in range(4):
        parts.append(box(-front_width * 0.32 - 0.9, -0.9 + step * 0.22, 0, -front_width * 0.32 + 0.9, -0.0, 0.22 * (4 - step), "stone_dark"))
    return finish("bank_1923", parts, location=(-half_main, -half_north - 0.0 - front_width / 2, 0), rotation_degrees=FACING["E"], parent=root, bevel=0.03)


def build_hardware_store(root, half_main, north_edge, south_edge):
    """Building of interest: 1908 lot 630 'Hardware, tin shop 2nd', east side of S Main. Front faces west."""
    width = north_edge - south_edge
    depth = 15.9
    store = empty("hardware_store", location=(half_main, (north_edge + south_edge) / 2, 0), parent=root, rotation_degrees=FACING["W"])
    parts, height = brick_commercial("hardware_store_body", width, depth, 2, warm_share=0.7, door_offset=0.0)
    parts = [part for part in parts if not (part.material_name == "glass_dark" and abs(part.vertices[0].z) < 0.01 and abs(part.vertices[6].z - 2.3) < 0.01)]
    parts.append(box(-0.6, -0.02, 0, 0.6, 0.15, 2.35, "glass_dark"))
    parts.append(box(-1.0, depth - 0.02, 0, 1.0, depth + 0.02, 2.4, "glass_dark"))
    finish("hardware_store_body", parts, parent=store, bevel=0.03)
    finish("hardware_store_door", [box(0, -0.06, 0.02, 1.1, -0.01, 2.3, "wood_dark"), box(0.15, -0.08, 1.1, 0.95, -0.06, 2.1, "window_warm")], location=(-0.55, 0, 0), parent=store)
    finish("hardware_store_rear_door", [box(0, depth + 0.01, 0.02, 1.9, depth + 0.07, 2.35, "wood_dark")], location=(-0.95, 0, 0), parent=store)
    finish("hardware_store_outline", outline_edges(width, depth, height + 0.9), parent=store)
    finish("hardware_store_light_pool", [disc((0, 0, 0.03), 2.6, 24, "red_glow")], location=(0.8, depth * 0.45, 0), parent=store)
    empty("hardware_store_label_anchor", location=(0, depth / 2, height + 3.0), parent=store)
    empty("hardware_store_rear_lot", location=(0, depth + 6.0, 0), parent=store)
    return store


# ---------------------------------------------------------------- farm and rural buildings

def build_farm():
    """Exterior-only farmstead. Origin at the house's front centre; house front faces south (-Y)."""
    root = empty("farm")
    house = empty("farmhouse", parent=root)
    parts, _ = gable_house("farmhouse_body", 7.3, 9.8, 6.0, pitch=0.85, warm_share=0.0, wing=(6.4, 7.0, 3.9), porch=True)
    finish("farmhouse_body", parts, parent=house, bevel=0.03)
    summer_kitchen = gable_house("summer_kitchen", 3.7, 4.9, 2.4, pitch=0.8, warm_share=0.0, porch=False, chimney=False)[0]
    summer_kitchen.append(box(-0.12, -0.3, 2.6, 0.12, -0.05, 3.9, "metal_dark"))
    finish("summer_kitchen_shed", summer_kitchen, location=(-2.0, 16.5, 0), rotation_degrees=90, parent=root, bevel=0.025)
    finish("summer_kitchen_door", [box(0, -0.06, 0.02, 0.85, -0.01, 2.0, "wood_dark")], location=(-2.0 + 0.42, 16.5 - 0.0, 0), rotation_degrees=90, parent=root)
    barn_parts = barn(9.1, 12.2, 4.9)
    finish("barn", barn_parts, location=(14.0, 26.0, 0), rotation_degrees=180, parent=root, bevel=0.03)
    finish("machine_shed", lean_to(6.0, 9.0, 3.2, 2.4), location=(-14.0, 24.0, 0), rotation_degrees=90, parent=root, bevel=0.025)
    finish("woodshed", lean_to(3.0, 4.0, 2.4, 1.9), location=(6.0, 14.0, 0), rotation_degrees=180, parent=root, bevel=0.02)
    finish("privy", gable_house("privy", 1.2, 1.3, 2.0, pitch=0.8, warm_share=0.0, porch=False, chimney=False)[0], location=(-6.0, 30.0, 0), parent=root, bevel=0.015)
    finish("pump", [cylinder((0, 0, 0.6), 0.08, 1.2, 8, "z", "metal_dark"), frustum((0, 0, 1.0), (0.35, 0, 0.95), 0.03, 0.025, 6, "metal_dark"), frustum((0, 0, 1.15), (-0.4, 0, 1.4), 0.025, 0.02, 6, "metal_dark"), box(-0.5, -0.5, 0, 0.5, 0.5, 0.12, "stone_dark")], location=(3.0, 12.0, 0), parent=root)
    empty("farm_label_anchor", location=(0, 5.0, 14.0), parent=root)
    return root


def barn(width, depth, eave):
    """Gambrel-roof barn on a fieldstone base; front (gable) faces -Y."""
    lower = width / 2 + 0.3
    knee_height = eave + 2.6
    ridge = eave + 4.3
    profile = [(-width / 2, 0), (width / 2, 0), (width / 2, eave), (width * 0.3, knee_height), (0, ridge), (-width * 0.3, knee_height), (-width / 2, eave)]
    parts = [
        prism_xz(profile, 0, depth, "frame_dark"),
        prism_xz([(-lower, eave - 0.15), (-width * 0.3 - 0.2, knee_height + 0.05), (-width * 0.3, knee_height - 0.15), (-width / 2, eave - 0.3)], -0.35, depth + 0.35, "roof_dark"),
        prism_xz([(width * 0.3, knee_height - 0.15), (width * 0.3 + 0.2, knee_height + 0.05), (lower, eave - 0.15), (width / 2, eave - 0.3)], -0.35, depth + 0.35, "roof_dark"),
        prism_xz([(-width * 0.3 - 0.2, knee_height + 0.05), (0, ridge + 0.2), (width * 0.3 + 0.2, knee_height + 0.05), (width * 0.3, knee_height - 0.15), (0, ridge - 0.05), (-width * 0.3, knee_height - 0.15)], -0.35, depth + 0.35, "roof_dark"),
        box(-width / 2 - 0.1, -0.1, 0, width / 2 + 0.1, depth + 0.1, 1.2, "stone_dark"),
        box(-1.8, -0.05, 0, 1.8, 0.0, 3.8, "wood_dark"),
        box(-0.6, -0.05, eave + 0.6, 0.6, 0.0, eave + 1.8, "wood_dark"),
        cylinder((0, depth * 0.5, ridge + 0.5), 0.35, 0.9, 8, "z", "metal_dark"),
    ]
    return parts


def lean_to(width, depth, high, low):
    parts = [
        prism_xz([(-width / 2, 0), (width / 2, 0), (width / 2, low), (-width / 2, high)], 0, depth, "frame_dark"),
        prism_xz([(-width / 2 - 0.3, high + 0.05), (width / 2 + 0.3, low - 0.1), (width / 2 + 0.3, low + 0.02), (-width / 2 - 0.3, high + 0.17)], -0.3, depth + 0.3, "roof_dark"),
        box(-width * 0.3, -0.04, 0, width * 0.3, 0.0, min(high, low) - 0.3, "glass_dark"),
    ]
    return parts


def build_tavern():
    """Generic 1950s rural tavern: one-and-a-half storey frame, gable front, side shed. Front faces -Y."""
    root = empty("tavern_generic")
    parts, _ = gable_house("tavern_body", 7.3, 12.2, 3.7, pitch=0.7, warm_share=0.8, porch=False, chimney=True)
    parts.append(box(-1.2, -1.2, 0, 1.2, 0, 0.35, "wood_dark"))
    parts.append(prism_xz([(-1.4, 2.6), (1.4, 2.6), (0, 3.2)], -1.3, 0.1, "roof_dark"))
    finish("tavern_body", parts, parent=root, bevel=0.03)
    finish("tavern_rear_shed", lean_to(4.5, 4.0, 3.0, 2.3), location=(0, 12.2, 0), parent=root, bevel=0.02)
    finish("tavern_door", [box(0, -0.06, 0.02, 0.95, -0.01, 2.1, "wood_dark")], location=(-0.48 - 7.3 * 0.22 + 0.48, 0, 0), parent=root)
    finish("tavern_light_pool", [disc((0, 0, 0.03), 2.2, 24, "red_glow")], location=(0.5, 4.5, 0), parent=root)
    empty("tavern_label_anchor", location=(0, 6.0, 9.0), parent=root)
    return root


def build_grocery():
    """Generic small country grocery: one-storey false front with a porch roof across the front. Front faces -Y."""
    root = empty("grocery_generic")
    parts, height = frame_false_front("grocery_body", 7.3, 12.2, 1, warm_share=0.9)
    parts.append(box(-4.0, -2.4, 0, 4.0, 0, 0.3, "wood_dark"))
    parts.append(box(-4.1, -2.6, 3.0, 4.1, 0.1, 3.15, "roof_dark"))
    for post_x in (-3.8, -1.3, 1.3, 3.8):
        parts.append(box(post_x - 0.07, -2.35, 0.3, post_x + 0.07, -2.21, 3.0, "trim_dark"))
    finish("grocery_body", parts, parent=root, bevel=0.03)
    finish("grocery_side_shed", lean_to(3.5, 6.0, 3.0, 2.2), location=(5.4, 4.0, 0), rotation_degrees=90, parent=root, bevel=0.02)
    finish("grocery_door", [box(0, -0.06, 0.02, 1.0, -0.01, 2.2, "wood_dark"), box(0.15, -0.08, 1.0, 0.85, -0.06, 2.0, "window_warm")], location=(-0.5, 0, 0), parent=root)
    empty("grocery_label_anchor", location=(0, 6.0, height + 3.0), parent=root)
    return root


# ---------------------------------------------------------------- cemetery

def build_cemetery():
    root = empty("cemetery_props")
    fence = []
    for index in range(21):
        x = -1.2 + index * 0.12
        fence.append(box(x - 0.012, -0.012, 0, x + 0.012, 0.012, 1.05, "metal_dark"))
        fence.append(frustum((x, 0, 1.05), (x, 0, 1.17), 0.022, 0.002, 4, "metal_dark"))
    for z in (0.18, 0.95):
        fence.append(box(-1.2, -0.02, z - 0.02, 1.2, 0.02, z + 0.02, "metal_dark"))
    fence.append(box(-1.25, -0.06, 0, -1.15, 0.06, 1.3, "metal_dark"))
    finish("cemetery_fence_segment", fence, location=(0, 0, 0), parent=root)

    gate = empty("cemetery_gate", location=(0, -4.0, 0), parent=root)
    for side in (-1, 1):
        finish(f"cemetery_gate_pier_{'left' if side < 0 else 'right'}", [box(-0.22, -0.22, 0, 0.22, 0.22, 1.7, "stone_dark"), box(-0.28, -0.28, 1.7, 0.28, 0.28, 1.82, "stone_dark"), sphere((0, 0, 1.98), 0.15, 5, 8, "stone_dark")], location=(side * 1.72, 0, 0), parent=gate, bevel=0.015)
        leaf = []
        for index in range(11):
            x = 0.06 + index * 0.13
            leaf.append(box(x - 0.012, -0.012, 0.08, x + 0.012, 0.012, 1.4 + 0.12 * math.sin(math.pi * index / 10), "metal_dark"))
        for z in (0.15, 1.3):
            leaf.append(box(0, -0.02, z - 0.02, 1.48, 0.02, z + 0.02, "metal_dark"))
        leaf.append(box(0, -0.025, 0.08, 0.05, 0.025, 1.45, "metal_dark"))
        finish(f"cemetery_gate_leaf_{'left' if side < 0 else 'right'}", [part.transformed(rotation_z(0 if side < 0 else 180)) for part in leaf], location=(side * 1.5, 0, 0), parent=gate)

    stones = [
        ("stone_slab_round", [box(-0.3, -0.07, 0.1, 0.3, 0.07, 0.75, "stone_dark"), cylinder((0, 0, 0.75), 0.3, 0.14, 12, "y", "stone_dark"), box(-0.38, -0.14, 0, 0.38, 0.14, 0.12, "stone_dark")]),
        ("stone_slab_square", [box(-0.25, -0.08, 0.12, 0.25, 0.08, 0.95, "stone_dark"), box(-0.3, -0.13, 0.95, 0.3, 0.13, 1.02, "stone_dark"), box(-0.33, -0.16, 0, 0.33, 0.16, 0.12, "stone_dark")]),
        ("stone_obelisk", [box(-0.32, -0.32, 0, 0.32, 0.32, 0.3, "stone_dark"), box(-0.24, -0.24, 0.3, 0.24, 0.24, 0.55, "stone_dark"), frustum((0, 0, 0.55), (0, 0, 1.75), 0.2, 0.12, 4, "stone_dark"), frustum((0, 0, 1.75), (0, 0, 1.9), 0.12, 0.01, 4, "stone_dark")]),
        ("stone_flat_marker", [box(-0.3, -0.15, 0, 0.3, 0.15, 0.1, "stone_dark")]),
        ("stone_low_family", [box(-0.7, -0.15, 0, 0.7, 0.15, 0.6, "stone_dark"), prism_xz([(-0.72, 0.6), (0.72, 0.6), (0.5, 0.72), (-0.5, 0.72)], -0.16, 0.16, "stone_dark")]),
    ]
    for index, (name, parts) in enumerate(stones):
        finish(name, parts, location=(3.0 + index * 1.6, 0, 0), parent=root, bevel=0.012)
    return root


# ---------------------------------------------------------------- vehicles

def wheel(name, center, radius, width, parent, side):
    tyre = cylinder((0, 0, 0), radius, width, 16, "y", "rubber")
    hub = cylinder((0, side * (width / 2 + 0.005), 0), radius * 0.55, 0.02, 12, "y", "chrome_dim")
    return finish(name, [tyre, hub], location=center, parent=parent)


def car_lights(nose_x, tail_x, headlamp_z, tail_z, lamp_y, nose_hw):
    parts = []
    for side in (-1, 1):
        parts.append(cylinder((nose_x - 0.02, side * lamp_y, headlamp_z), 0.09, 0.08, 10, "x", "lamp_off"))
        parts.append(centered_box((tail_x + 0.02, side * (nose_hw - 0.12), tail_z), (0.06, 0.1, 0.16), "tail_lamp"))
    return parts


def build_ford49(parent, offset):
    """1949 Ford two-door sedan ('Tudor'): wheelbase 114 in, length 196.8 in, width 71.7 in."""
    root = empty("ford49_sedan", location=offset, parent=parent)
    wheelbase = 114 * INCH
    front_axle, rear_axle = wheelbase / 2, -wheelbase / 2
    nose, tail = 2.27, -2.73
    half_width = 71.7 * INCH / 2
    stations = [
        (nose, 0.44, 0.72, 0.66), (nose - 0.18, 0.36, 0.86, 0.84), (front_axle + 0.47, 0.34, 0.94, 0.89),
        (front_axle + 0.42, 0.64, 0.99, 0.9), (front_axle, 0.72, 1.0, half_width), (front_axle - 0.42, 0.64, 1.0, half_width),
        (front_axle - 0.47, 0.32, 1.0, half_width), (rear_axle + 0.47, 0.32, 0.99, half_width), (rear_axle + 0.43, 0.56, 0.99, half_width),
        (rear_axle, 0.6, 0.98, half_width), (rear_axle - 0.43, 0.56, 0.97, 0.9), (rear_axle - 0.47, 0.34, 0.97, 0.9),
        (tail + 0.25, 0.38, 0.93, 0.86), (tail, 0.47, 0.8, 0.72),
    ]
    body = loft([body_ring(x, zb, zt, hw, roundness=0.4, top_inset=0.8) for x, zb, zt, hw in stations], "car_maroon")
    greenhouse = loft([body_ring(x, zb, zt, hw, roundness=0.1, top_inset=0.9, bottom_inset=1.0) for x, zb, zt, hw in (
        (0.58, 0.97, 1.0, 0.86), (0.12, 0.97, 1.43, 0.8), (-0.25, 0.97, 1.43, 0.79), (-1.0, 0.97, 1.43, 0.79), (-1.38, 0.97, 1.3, 0.8), (-1.68, 0.96, 0.99, 0.84))], "glass_dark")
    roof = loft([body_ring(x, zb, zt, hw, roundness=0.35, top_inset=0.8, bottom_inset=1.0) for x, zb, zt, hw in (
        (0.14, 1.42, 1.46, 0.79), (-0.15, 1.42, 1.58, 0.79), (-0.95, 1.42, 1.58, 0.79), (-1.3, 1.29, 1.42, 0.8), (-1.6, 1.05, 1.1, 0.83))], "car_maroon")
    pillars = []
    for side in (-1, 1):
        pillars.append(frustum((0.56, side * 0.84, 0.99), (0.12, side * 0.79, 1.44), 0.045, 0.04, 4, "car_maroon"))
        pillars.append(centered_box((-0.55, side * 0.795, 1.2), (0.09, 0.03, 0.46), "car_maroon"))
        pillars.append(loft([[(-1.0, side * 0.8, 0.98), (-1.68, side * 0.845, 0.98), (-1.32, side * 0.8, 1.43), (-1.0, side * 0.8, 1.43)], [(-1.0, side * 0.77, 0.98), (-1.68, side * 0.815, 0.98), (-1.32, side * 0.77, 1.43), (-1.0, side * 0.77, 1.43)]], "car_maroon"))
    chrome = [
        centered_box((nose + 0.08, 0, 0.42), (0.16, 1.78, 0.16), "chrome_dim"),
        centered_box((tail - 0.08, 0, 0.45), (0.16, 1.74, 0.15), "chrome_dim"),
        centered_box((nose - 0.01, 0, 0.66), (0.05, 1.1, 0.06), "chrome_dim"),
        cylinder((nose + 0.02, 0, 0.66), 0.09, 0.06, 10, "x", "chrome_dim"),
    ]
    for side in (-1, 1):
        chrome.append(centered_box((nose + 0.17, side * 0.42, 0.52), (0.06, 0.08, 0.3), "chrome_dim"))
    finish("ford49_body", [body, greenhouse, roof] + pillars + chrome + car_lights(nose, tail, 0.74, 0.78, 0.6, 0.86), parent=root, bevel=0.012)
    for side, label in ((1, "left"), (-1, "right")):
        door = [box(-1.12, side * 0.005 - 0.012, 0.36, 0.0, side * 0.005 + 0.012, 0.97, "car_maroon"), box(-1.0, side * 0.005 - 0.016, 0.8, -0.86, side * 0.005 + 0.016, 0.83, "chrome_dim")]
        finish(f"ford49_door_{label}", door, location=(0.58, side * half_width, 0), parent=root)
    for x, label in ((front_axle, "front"), (rear_axle, "rear")):
        for side, side_label in ((1, "left"), (-1, "right")):
            wheel(f"ford49_wheel_{label}_{side_label}", (x, side * 0.75, 0.35), 0.35, 0.19, root, side)
    return root


def build_pickup(parent, offset):
    """Generic 1950s half-ton pickup modelled to the 1953-56 F-100 class: wheelbase 110 in, length 189.1 in. No badges."""
    root = empty("pickup_generic", location=offset, parent=parent)
    wheelbase = 110 * INCH
    front_axle, rear_axle = wheelbase / 2, -wheelbase / 2
    nose, tail = 2.15, -2.65
    front = loft([body_ring(x, zb, zt, hw, roundness=0.45, top_inset=0.72) for x, zb, zt, hw in (
        (nose, 0.5, 0.95, 0.86), (nose - 0.15, 0.45, 1.08, 0.94), (front_axle + 0.48, 0.45, 1.12, 0.95), (front_axle + 0.43, 0.75, 1.13, 0.95),
        (front_axle, 0.8, 1.15, 0.95), (front_axle - 0.43, 0.75, 1.16, 0.95), (front_axle - 0.5, 0.55, 1.16, 0.95), (0.62, 0.5, 1.18, 0.9))], "car_dark")
    cab = loft([body_ring(x, zb, zt, hw, roundness=0.2) for x, zb, zt, hw in ((0.64, 0.5, 1.18, 0.9), (-0.66, 0.5, 1.18, 0.9))], "car_dark")
    glass = loft([body_ring(x, zb, zt, hw, roundness=0.05, top_inset=0.95, bottom_inset=1.0) for x, zb, zt, hw in ((0.6, 1.17, 1.2, 0.86), (0.38, 1.17, 1.6, 0.82), (-0.6, 1.17, 1.6, 0.82), (-0.64, 1.17, 1.2, 0.86))], "glass_dark")
    roof = loft([body_ring(x, zb, zt, hw, roundness=0.35, top_inset=0.85, bottom_inset=1.0) for x, zb, zt, hw in ((0.4, 1.58, 1.62, 0.82), (0.25, 1.58, 1.9, 0.82), (-0.55, 1.58, 1.9, 0.82), (-0.66, 1.2, 1.88, 0.86))], "car_dark")
    bed_floor, bed_top, bed_half = 0.72, 1.2, 0.66
    bed = [
        box(-2.62, -bed_half, bed_floor - 0.05, -0.74, bed_half, bed_floor, "car_dark"),
        box(-2.62, bed_half - 0.04, bed_floor, -0.74, bed_half, bed_top, "car_dark"),
        box(-2.62, -bed_half, bed_floor, -0.74, -bed_half + 0.04, bed_top, "car_dark"),
        box(-0.78, -bed_half, bed_floor, -0.74, bed_half, bed_top, "car_dark"),
        box(-2.0, -bed_half, 0.42, -1.2, bed_half, 0.67, "metal_dark"),
    ]
    for side in (-1, 1):
        bed.append(loft([[(x, side * (bed_half + y), z) for y, z in ((0, 0.62), (0.26, 0.62), (0.26, top), (0, top))] for x, top in ((-0.84, 0.72), (rear_axle + 0.45, 0.98), (rear_axle + 0.15, 1.06), (rear_axle - 0.15, 1.06), (rear_axle - 0.45, 0.98), (-2.15, 0.72))], "car_dark"))
        bed.append(box(front_axle - 0.52, side * 0.62, 0.42, -0.86, side * 0.95, 0.47, "metal_dark") if side > 0 else box(front_axle - 0.52, -0.95, 0.42, -0.86, -0.62, 0.47, "metal_dark"))
    chrome = [centered_box((nose + 0.08, 0, 0.45), (0.14, 1.8, 0.16), "chrome_dim"), centered_box((tail - 0.04, 0, 0.5), (0.1, 1.6, 0.12), "chrome_dim"), centered_box((nose - 0.0, 0, 0.75), (0.05, 1.2, 0.18), "chrome_dim")]
    finish("pickup_body", [front, cab, glass, roof] + bed + chrome + car_lights(nose, -2.62, 0.82, 0.9, 0.66, 0.88), parent=root, bevel=0.012)
    finish("pickup_tailgate", [box(-0.04, -bed_half, 0.0, 0.0, bed_half, bed_top - bed_floor, "car_dark")], location=(-2.62, 0, bed_floor), parent=root)
    for side, label in ((1, "left"), (-1, "right")):
        finish(f"pickup_door_{label}", [box(-1.15, -0.012, 0.52, 0.0, 0.012, 1.17, "car_dark")], location=(0.6, side * 0.905, 0), parent=root)
    for x, label in ((front_axle, "front"), (rear_axle, "rear")):
        for side, side_label in ((1, "left"), (-1, "right")):
            wheel(f"pickup_wheel_{label}_{side_label}", (x, side * 0.79, 0.37), 0.37, 0.18, root, side)
    return root


def build_police_car(parent, offset):
    """Generic 1950s four-door police sedan to the 1955 Ford class: wheelbase 115.5 in, length 198.5 in, width 75.9 in."""
    root = empty("police_car_generic", location=offset, parent=parent)
    wheelbase = 115.5 * INCH
    front_axle, rear_axle = wheelbase / 2, -wheelbase / 2
    nose, tail = 2.2, -2.84
    half_width = 75.9 * INCH / 2
    body = loft([body_ring(x, zb, zt, hw, roundness=0.22) for x, zb, zt, hw in (
        (nose, 0.42, 0.86, 0.86), (nose - 0.12, 0.34, 0.97, 0.94), (front_axle + 0.47, 0.33, 0.96, half_width), (front_axle + 0.42, 0.66, 0.96, half_width),
        (front_axle, 0.73, 0.95, half_width), (front_axle - 0.42, 0.66, 0.95, half_width), (front_axle - 0.47, 0.32, 0.95, half_width),
        (rear_axle + 0.47, 0.32, 0.95, half_width), (rear_axle + 0.42, 0.62, 0.95, half_width), (rear_axle, 0.68, 0.95, half_width),
        (rear_axle - 0.42, 0.62, 0.95, half_width), (rear_axle - 0.47, 0.34, 0.95, half_width), (tail, 0.42, 0.92, 0.92))], "car_black")
    greenhouse = loft([body_ring(x, zb, zt, hw, roundness=0.1, top_inset=0.9, bottom_inset=1.0) for x, zb, zt, hw in (
        (0.75, 0.94, 0.97, 0.9), (0.42, 0.94, 1.38, 0.84), (-1.25, 0.94, 1.38, 0.84), (-1.55, 0.94, 1.27, 0.86), (-1.85, 0.94, 0.97, 0.9))], "glass_dark")
    roof = loft([body_ring(x, zb, zt, hw, roundness=0.35, top_inset=0.85, bottom_inset=1.0) for x, zb, zt, hw in (
        (0.45, 1.36, 1.4, 0.84), (0.25, 1.36, 1.5, 0.84), (-1.2, 1.36, 1.5, 0.84), (-1.5, 1.27, 1.38, 0.86))], "car_black")
    pillars = []
    for side in (-1, 1):
        pillars.append(frustum((0.72, side * 0.9, 0.96), (0.42, side * 0.84, 1.38), 0.04, 0.035, 4, "car_black"))
        pillars.append(centered_box((-0.42, side * 0.85, 1.16), (0.09, 0.03, 0.44), "car_black"))
        pillars.append(frustum((-1.55, side * 0.86, 1.27), (-1.85, side * 0.9, 0.96), 0.06, 0.06, 4, "car_black"))
    chrome = [centered_box((nose + 0.08, 0, 0.42), (0.16, 1.86, 0.16), "chrome_dim"), centered_box((tail - 0.08, 0, 0.45), (0.16, 1.84, 0.15), "chrome_dim"), centered_box((nose - 0.01, 0, 0.66), (0.05, 1.3, 0.2), "chrome_dim")]
    lamp = [cylinder((-0.35, 0, 1.55), 0.08, 0.1, 10, "z", "metal_dark")]
    finish("police_car_body", [body, greenhouse, roof] + pillars + chrome + lamp + car_lights(nose, tail, 0.8, 0.8, 0.66, 0.92), parent=root, bevel=0.012)
    finish("police_car_roof_lamp", [sphere((0, 0, 0.09), 0.1, 5, 10, "police_blue"), cylinder((0, 0, 0.0), 0.1, 0.04, 10, "z", "metal_dark")], location=(-0.35, 0, 1.6), parent=root)
    for side, label in ((1, "left"), (-1, "right")):
        finish(f"police_car_door_front_{label}", [box(-1.1, -0.012, 0.36, 0.0, 0.012, 0.94, "car_light")], location=(0.72, side * (half_width + 0.004), 0), parent=root)
        finish(f"police_car_door_rear_{label}", [box(-1.0, -0.012, 0.36, 0.0, 0.012, 0.94, "car_light")], location=(-0.42, side * (half_width + 0.004), 0), parent=root)
    for x, label in ((front_axle, "front"), (rear_axle, "rear")):
        for side, side_label in ((1, "left"), (-1, "right")):
            wheel(f"police_car_wheel_{label}_{side_label}", (x, side * 0.8, 0.35), 0.35, 0.19, root, side)
    return root


def build_vehicles():
    root = empty("vehicles")
    build_ford49(root, (0, 0, 0))
    build_pickup(root, (0, 4.0, 0))
    build_police_car(root, (0, -4.0, 0))
    return root


# ---------------------------------------------------------------- lights

def build_lights():
    root = empty("lights")
    generator = [
        box(-0.75, -0.4, 0, 0.75, -0.32, 0.1, "metal_dark"), box(-0.75, 0.32, 0, 0.75, 0.4, 0.1, "metal_dark"),
        box(-0.6, -0.32, 0.1, 0.15, 0.32, 0.72, "metal_dark"), cylinder((0.45, 0, 0.42), 0.27, 0.55, 12, "x", "metal_dark"),
        cylinder((-0.2, 0, 0.88), 0.13, 0.45, 10, "y", "metal_dark"), frustum((-0.5, 0.2, 0.72), (-0.5, 0.2, 1.05), 0.03, 0.03, 6, "metal_dark"),
    ]
    finish("generator", generator, location=(0, 0, 0), parent=root, bevel=0.01)
    lamp = empty("flood_lamp", location=(2.0, 0, 0), parent=root)
    stand = [frustum((0, 0, 0.9), (0, 0, 2.35), 0.025, 0.02, 6, "metal_dark")]
    for index in range(3):
        angle = 2 * math.pi * index / 3
        stand.append(frustum((0, 0, 0.95), (0.7 * math.cos(angle), 0.7 * math.sin(angle), 0.0), 0.018, 0.018, 5, "metal_dark"))
    stand.append(box(-0.22, -0.02, 2.33, 0.22, 0.02, 2.37, "metal_dark"))
    finish("flood_lamp_stand", stand, parent=lamp)
    head = [frustum((-0.12, 0, 0), (0.1, 0, 0), 0.1, 0.17, 12, "metal_dark"), cylinder((0.105, 0, 0), 0.155, 0.02, 12, "x", "lamp_warm"), box(-0.02, -0.21, -0.02, 0.02, 0.21, 0.02, "metal_dark")]
    finish("flood_lamp_head", head, location=(0, 0, 2.5), parent=lamp)
    return root


# ---------------------------------------------------------------- props

def tree(name, seed, height, spread, location, parent):
    random_source = seeded(name + str(seed))
    parts = []

    def branch(start, direction, length, radius, depth):
        end = [start[i] + direction[i] * length for i in range(3)]
        parts.append(frustum(start, end, radius, radius * 0.62, 5 if depth < 2 else 4, "bark"))
        if depth >= 4 or radius < 0.012:
            return
        children = 2 if depth > 1 else 3
        for child in range(children):
            azimuth = random_source.uniform(0, 2 * math.pi) + child * 2 * math.pi / children
            tilt = random_source.uniform(0.35, 0.7) * spread
            new_direction = [direction[0] * (1 - tilt) + math.cos(azimuth) * tilt, direction[1] * (1 - tilt) + math.sin(azimuth) * tilt, direction[2] * (1 - tilt * 0.5) + 0.15]
            norm = math.sqrt(sum(value * value for value in new_direction))
            branch(end, [value / norm for value in new_direction], length * random_source.uniform(0.6, 0.78), radius * 0.62, depth + 1)

    trunk_length = height * 0.38
    branch((0, 0, 0), (0, 0, 1), trunk_length, height * 0.028, 0)
    return finish(name, parts, location=location, parent=parent)


def build_props():
    root = empty("props")
    tree("tree_bare_elm", 1, 14.0, 0.55, (0, 0, 0), root)
    tree("tree_bare_oak", 2, 11.0, 0.6, (10, 0, 0), root)
    tree("tree_bare_small", 3, 6.0, 0.7, (18, 0, 0), root)
    wire_fence = []
    for x in (0.0, 3.0):
        wire_fence.append(frustum((x, 0, 0), (x, 0, 1.25), 0.06, 0.05, 6, "wood_dark"))
    for z in (0.45, 0.8, 1.15):
        wire_fence.append(box(0.0, -0.006, z - 0.006, 3.0, 0.006, z + 0.006, "metal_dark"))
    finish("farm_wire_fence_segment", wire_fence, location=(0, 6, 0), parent=root)
    board_fence = [box(-0.05, -0.05, 0, 0.05, 0.05, 1.3, "wood_dark"), box(2.4, -0.05, 0, 2.5, 0.05, 1.3, "wood_dark")]
    for z in (0.3, 0.7, 1.1):
        board_fence.append(box(0.0, 0.05, z - 0.08, 2.5, 0.08, z + 0.08, "wood_dark"))
    finish("board_fence_segment", board_fence, location=(5, 6, 0), parent=root)
    pole = empty("utility_pole", location=(25, 0, 0), parent=root)
    pole_parts = [frustum((0, 0, 0), (0, 0, 9.1), 0.15, 0.11, 8, "wood_dark"), box(-1.2, -0.05, 8.5, 1.2, 0.05, 8.62, "wood_dark")]
    pole_parts.append(frustum((-0.7, 0, 8.5), (0, 0, 7.8), 0.02, 0.02, 4, "metal_dark"))
    pole_parts.append(frustum((0.7, 0, 8.5), (0, 0, 7.8), 0.02, 0.02, 4, "metal_dark"))
    for index, x in enumerate((-1.05, -0.45, 0.45, 1.05)):
        pole_parts.append(cylinder((x, 0, 8.7), 0.045, 0.14, 6, "z", "lamp_off"))
        empty(f"utility_pole_wire_{index}", location=(x, 0, 8.78), parent=pole)
    finish("utility_pole_body", pole_parts, parent=pole)
    return root


# ---------------------------------------------------------------- people

POSES = {
    # thigh, shin, upper arm, forearm angles (degrees from straight down, positive forward) left/right, torso lean
    "standing": dict(left_leg=(0, 0), right_leg=(0, 0), left_arm=(4, 8), right_arm=(4, 8), lean=0),
    "walking": dict(left_leg=(22, 8), right_leg=(-16, 18), left_arm=(-18, 10), right_arm=(20, 30), lean=4),
    "entering_doorway": dict(left_leg=(26, 6), right_leg=(-20, 25), left_arm=(10, 20), right_arm=(55, 75), lean=8),
    "pointing": dict(left_leg=(0, 0), right_leg=(6, 0), left_arm=(4, 8), right_arm=(80, 85), lean=0),
    "flashlight": dict(left_leg=(10, 4), right_leg=(-6, 10), left_arm=(4, 10), right_arm=(45, 70), lean=3),
    "hands_on_hips": dict(left_leg=(0, 0), right_leg=(0, 0), left_arm=(-25, -95), right_arm=(-25, -95), lean=0),
}


def limb_points(origin, upper_angle, lower_angle, upper_length, lower_length, lean_degrees=0):
    first = math.radians(upper_angle + lean_degrees)
    joint = (origin[0] + math.sin(first) * upper_length, origin[1], origin[2] - math.cos(first) * upper_length)
    second = math.radians(upper_angle + lower_angle + lean_degrees)
    end = (joint[0] + math.sin(second) * lower_length, joint[1], joint[2] - math.cos(second) * lower_length)
    return joint, end


def figure(name, pose_name, outfit, location, parent):
    """Solid low-poly silhouette, 1.80 m, facing +X. One material; the app tints it (blue police, white witness, grey others)."""
    pose = POSES[pose_name]
    lean = pose["lean"]
    parts = []
    hip_height, shoulder_height = 0.95, 1.45
    lean_radians = math.radians(lean)
    shoulder_center = (math.sin(lean_radians) * (shoulder_height - hip_height), 0, hip_height + math.cos(lean_radians) * (shoulder_height - hip_height))
    for side, key in ((1, "left_leg"), (-1, "right_leg")):
        thigh, shin = pose[key]
        hip = (0, side * 0.1, hip_height)
        knee, ankle = limb_points(hip, thigh, -shin, 0.47, 0.43)
        parts.append(frustum(hip, knee, 0.085, 0.06, 6, "silhouette"))
        parts.append(frustum(knee, ankle, 0.058, 0.045, 6, "silhouette"))
        parts.append(centered_box((ankle[0] + 0.07, ankle[1], max(ankle[2] - 0.04, 0.04)), (0.26, 0.1, 0.08), "silhouette"))
    torso_bottom = (0, 0, hip_height - 0.05)
    if outfit == "coat":
        parts.append(frustum((torso_bottom[0] + 0.0, 0, 0.55), shoulder_center, 0.25, 0.21, 6, "silhouette"))
    else:
        parts.append(frustum(torso_bottom, shoulder_center, 0.17, 0.21, 6, "silhouette"))
    neck = (shoulder_center[0] + 0.02, 0, shoulder_center[2] + 0.08)
    parts.append(frustum(shoulder_center, neck, 0.06, 0.05, 6, "silhouette"))
    head_center = (neck[0] + 0.02, 0, neck[2] + 0.13)
    parts.append(sphere(head_center, 0.11, 5, 8, "silhouette"))
    for side, key in ((1, "left_arm"), (-1, "right_arm")):
        upper, lower = pose[key]
        shoulder = (shoulder_center[0], side * 0.22, shoulder_center[2] - 0.04)
        elbow, wrist = limb_points(shoulder, upper, lower - upper, 0.3, 0.27, lean)
        if pose_name == "hands_on_hips":
            elbow = (shoulder[0] - 0.05, side * 0.36, shoulder[2] - 0.25)
            wrist = (0.02, side * 0.2, hip_height + 0.05)
        parts.append(frustum(shoulder, elbow, 0.055, 0.045, 6, "silhouette"))
        parts.append(frustum(elbow, wrist, 0.045, 0.035, 6, "silhouette"))
        if pose_name == "flashlight" and side < 0:
            parts.append(frustum(wrist, (wrist[0] + 0.2, wrist[1], wrist[2] + 0.02), 0.03, 0.035, 6, "silhouette"))
    if outfit == "police":
        parts.append(cylinder((head_center[0], 0, head_center[2] + 0.1), 0.12, 0.08, 10, "z", "silhouette"))
        parts.append(cylinder((head_center[0] + 0.05, 0, head_center[2] + 0.06), 0.12, 0.015, 10, "z", "silhouette"))
    else:
        parts.append(cylinder((head_center[0], 0, head_center[2] + 0.06), 0.18, 0.015, 12, "z", "silhouette"))
        parts.append(cylinder((head_center[0], 0, head_center[2] + 0.11), 0.105, 0.11, 10, "z", "silhouette"))
    return finish(name, parts, location=location, parent=parent)


def build_people():
    root = empty("people")
    figures = [
        ("police_standing", "standing", "police"), ("police_flashlight", "flashlight", "police"), ("police_walking", "walking", "police"),
        ("police_hands_on_hips", "hands_on_hips", "police"), ("man_entering_doorway", "entering_doorway", "coat"),
        ("townsperson_standing", "standing", "coat"), ("townsperson_walking", "walking", "coat"), ("townsperson_pointing", "pointing", "plain"),
    ]
    for index, (name, pose_name, outfit) in enumerate(figures):
        figure(name, pose_name, outfit, (0, index * 1.2, 0), root)
    return root


# ---------------------------------------------------------------- terrain

LON0, LAT0 = -89.49233, 44.21349
LON_METRES = 111_320.0 * math.cos(math.radians(44.25))
LAT_METRES = 111_132.0


def build_terrain():
    """Illustrative low relief over the four quads (no elevation data on the planimetric sheets)."""
    image = bpy.data.images.load(os.path.join(ASSETS, "map", "heightmap.png"))
    width, height = image.size
    pixels = list(image.pixels)
    columns, rows = 129, 177
    west, south, east, north = -89.75, 44.00, -89.25, 44.50
    vertices, faces = [], []
    for row in range(rows):
        latitude = north - (north - south) * row / (rows - 1)
        for column in range(columns):
            longitude = west + (east - west) * column / (columns - 1)
            pixel_x = int(column / (columns - 1) * (width - 1))
            pixel_y = int((1 - row / (rows - 1)) * (height - 1))
            value = pixels[(pixel_y * width + pixel_x) * 4]
            vertices.append(((longitude - LON0) * LON_METRES, (latitude - LAT0) * LAT_METRES, value * 30.0))
    for row in range(rows - 1):
        for column in range(columns - 1):
            index = row * columns + column
            faces.append((index, index + columns, index + columns + 1, index + 1))
    root = finish("terrain", [Part(vertices, faces, "terrain_dark")])
    # recalc_face_normals may point an open grid downward; the terrain must face up for back-face culling.
    if sum(polygon.normal.z for polygon in root.data.polygons) < 0:
        root.data.flip_normals()
    for polygon in root.data.polygons:
        polygon.use_smooth = True
    return root


# ---------------------------------------------------------------- driver

FAMILIES = {
    "main_street": build_main_street, "farm": build_farm, "tavern": build_tavern, "grocery": build_grocery,
    "cemetery": build_cemetery, "vehicles": build_vehicles, "lights": build_lights, "props": build_props,
    "people": build_people, "terrain": build_terrain,
}


def describe(family):
    nodes = []
    for obj in bpy.data.objects:
        world = obj.matrix_world.translation
        entry = {"name": obj.name, "parent": obj.parent.name if obj.parent else None, "pivot_world_m": [round(world.x, 3), round(world.y, 3), round(world.z, 3)], "type": obj.type}
        if obj.type == "MESH":
            corners = [obj.matrix_world @ corner for corner in [__import__("mathutils").Vector(c) for c in obj.bound_box]]
            entry["size_m"] = [round(max(c[i] for c in corners) - min(c[i] for c in corners), 2) for i in range(3)]
            entry["triangles"] = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
            entry["materials"] = [slot.material.name for slot in obj.material_slots]
        nodes.append(entry)
    MANIFEST[family] = nodes


def main():
    selected = ARGUMENTS[1:] or list(FAMILIES)
    manifest_path = os.path.join(ROOT, "blender", "assets_manifest.json")
    if os.path.exists(manifest_path):
        MANIFEST.update(json.load(open(manifest_path, encoding="utf-8")))
    for family in selected:
        clear_scene()
        FAMILIES[family]()
        bpy.context.view_layer.update()
        describe(family)
        export_glb(os.path.join(ASSETS, f"{family}.glb"))
        print("exported", family, os.path.getsize(os.path.join(ASSETS, f"{family}.glb")), flush=True)
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(MANIFEST, handle, indent=1)


main()
