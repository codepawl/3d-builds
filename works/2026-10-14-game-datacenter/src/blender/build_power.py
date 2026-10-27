"""power.glb: the substation (gravel pad, two transformers, fence, sign) and the battery room (walls, ten cabinets).

Sizes match the footprints the app's selection rings and pickers expect: substation 8.4 x 4.6, battery room 4.4 x 7.
"""
import math

from common import (box, cylinder, empty, export_glb, fence_texture, flat_polygon, join, material, parent, perforated_texture, reset_scene, speckle_texture, sphere)


# A lightning bolt 0.3 m tall as (across, up) points: top, left notch, inner left, bottom tip, right notch, inner right.
HIGH_VOLTAGE_BOLT = [(0.03, 0.15), (-0.09, -0.03), (-0.015, -0.03), (-0.05, -0.15), (0.09, 0.035), (0.015, 0.035)]


def materials():
    fence_texture()
    perforated_texture()
    speckle_texture("gravel", 0.72, 0.35, 3)
    return {
        "gravel": material("gravel", "#ffffff", roughness=0.95, texture="gravel"),
        "concrete": material("concrete", "#e4e8f0", roughness=0.9),
        "tank": material("transformer_paint", "#aab4c8", roughness=0.45, metallic=0.35),
        "fin": material("transformer_fin", "#98a3b9", roughness=0.5, metallic=0.35),
        "porcelain": material("porcelain", "#f2efe9", roughness=0.25),
        "copper": material("copper", "#c58b4c", roughness=0.3, metallic=0.85),
        "post": material("fence_post", "#8d97ab", roughness=0.4, metallic=0.6),
        "fence": material("fence_mesh", "#ffffff", roughness=0.5, metallic=0.5, texture="fence", alpha_texture=True),
        "sign": material("warning_sign", "#ffd23f", roughness=0.5),
        "sign_mark": material("warning_mark", "#2a2d38", roughness=0.5),
        "wall": material("wall_panel", "#fbfcff", roughness=0.6),
        "wall_base": material("wall_base", "#e3e7f0", roughness=0.7),
        "brand": material("brand_trim", "#5b4bff", roughness=0.4),
        "cabinet": material("battery_cabinet", "#e3e7f0", roughness=0.5, metallic=0.15),
        "cabinet_vent": material("unit_grille", "#dde3ee", roughness=0.5, metallic=0.4, texture="perforated"),
        "frame": material("unit_frame", "#3b4152", roughness=0.45, metallic=0.5),
        "steel": material("steel", "#c9d0de", roughness=0.35, metallic=0.55),
        "ok_light": material("battery_light", "#46e08a", roughness=0.4, emission="#46e08a", emission_strength=3),
        "screen": material("screen", "#1b2a4a", roughness=0.2, emission="#3d6cff", emission_strength=1.2),
        "cable": material("black_cable", "#2a2d38", roughness=0.6),
        "floor": material("battery_floor", "#f3f5fa", roughness=0.85),
    }


def transformer(prefix, x, m):
    """Oil-filled transformer: tank on a skid, radiator fins on the front, three bushings with stacked sheds, a conservator."""
    parts = [
        box(f"{prefix}_skid", (1.9, 1.5, 0.12), (x, 0, 0.14), m["frame"], bevel=0.01),
        box(f"{prefix}_tank", (1.6, 1.2, 1.5), (x, 0, 0.95), m["tank"], bevel=0.05, segments=3),
        box(f"{prefix}_lid", (1.7, 1.3, 0.06), (x, 0, 1.73), m["tank"], bevel=0.02),
        cylinder(f"{prefix}_conservator", 0.16, 1.1, (x, 0.42, 2.05), m["tank"], vertices=24, bevel=0.03, rotation=(0, math.pi / 2, 0)),
        box(f"{prefix}_conservator_leg", (0.06, 0.06, 0.3), (x - 0.4, 0.42, 1.88), m["frame"], bevel=0.01),
        box(f"{prefix}_rating_plate", (0.24, 0.01, 0.16), (x + 0.5, -0.605, 1.25), m["porcelain"], bevel=0.003, segments=1),
    ]
    # Radiator fins along the front (three.js +Z), between two headers.
    for fin in range(9):
        parts.append(box(f"{prefix}_fin_{fin}", (0.05, 0.3, 1.2), (x - 0.64 + fin * 0.16, -0.78, 0.92), m["fin"], bevel=0.012))
    for height in (0.3, 1.55):
        parts.append(cylinder(f"{prefix}_header_{height}", 0.045, 1.4, (x, -0.72, height), m["fin"], vertices=12, bevel=0.005, rotation=(0, math.pi / 2, 0)))
    for index, offset in enumerate((-0.5, 0, 0.5)):
        parts.append(cylinder(f"{prefix}_bushing_base_{index}", 0.1, 0.1, (x + offset, -0.15, 1.81), m["frame"], vertices=16, bevel=0.01))
        for shed in range(5):
            parts.append(cylinder(f"{prefix}_shed_{index}_{shed}", 0.1 - shed * 0.008, 0.035, (x + offset, -0.15, 1.9 + shed * 0.075),
                                  m["porcelain"], vertices=20, bevel=0.012))
        parts.append(cylinder(f"{prefix}_terminal_{index}", 0.025, 0.12, (x + offset, -0.15, 2.3), m["copper"], vertices=12, bevel=0.006))
        # Overhead lead from each terminal toward the back of the yard.
        parts.append(cylinder(f"{prefix}_lead_{index}", 0.014, 0.9, (x + offset, 0.3, 2.36), m["copper"], vertices=8, bevel=0, rotation=(math.pi / 2 - 0.12, 0, 0)))
    return parts


def substation(m):
    root = empty("substation")
    width, depth = 8.4, 4.6
    parts = [
        box("substation_pad", (width + 0.4, depth + 0.4, 0.08), (0, 0, 0.04), m["gravel"], bevel=0.02, uv_density=0.5),
        box("substation_curb", (width + 0.6, depth + 0.6, 0.06), (0, 0, 0.03), m["concrete"], bevel=0.015),
    ]
    parts += transformer("transformer_1", -2, m)
    parts += transformer("transformer_2", 2, m)
    # Fence posts every ~1 m with a top rail; the chain-link fabric is a separate alpha-tested panel.
    posts = []
    steps_x = 8
    steps_z = 4
    for step in range(steps_x + 1):
        along = -width / 2 + step * width / steps_x
        posts += [(along, -depth / 2), (along, depth / 2)]
    for step in range(1, steps_z):
        along = -depth / 2 + step * depth / steps_z
        posts += [(-width / 2, along), (width / 2, along)]
    for index, (post_x, post_y) in enumerate(posts):
        parts.append(cylinder(f"fence_post_{index}", 0.035, 1.7, (post_x, post_y, 0.85), m["post"], vertices=10, bevel=0.008))
        parts.append(sphere(f"fence_post_cap_{index}", 0.04, (post_x, post_y, 1.7), m["post"], segments=10, rings=6))
    for side in (-1, 1):
        parts.append(cylinder(f"fence_rail_x_{side}", 0.022, width, (0, side * depth / 2, 1.62), m["post"], vertices=8, bevel=0, rotation=(0, math.pi / 2, 0)))
        parts.append(cylinder(f"fence_rail_y_{side}", 0.022, depth, (side * width / 2, 0, 1.62), m["post"], vertices=8, bevel=0, rotation=(math.pi / 2, 0, 0)))
    parts.append(box("warning_sign_plate", (0.6, 0.02, 0.42), (0, -depth / 2 - 0.05, 0.95), m["sign"], bevel=0.01))
    parts.append(flat_polygon("warning_sign_bolt_mark", HIGH_VOLTAGE_BOLT, 0.01, (0, -depth / 2 - 0.06, 1.0), m["sign_mark"]))
    parts.append(box("warning_sign_band", (0.5, 0.01, 0.04), (0, -depth / 2 - 0.062, 0.8), m["sign_mark"], bevel=0))
    parent(join("substation_body", parts), root)
    fabric = []
    for side in (-1, 1):
        fabric.append(box(f"fence_fabric_x_{side}", (width, 0.004, 1.5), (0, side * depth / 2, 0.86), m["fence"], bevel=0, uv_density=1))
        fabric.append(box(f"fence_fabric_y_{side}", (0.004, depth, 1.5), (side * width / 2, 0, 0.86), m["fence"], bevel=0, uv_density=1))
    parent(join("substation_fence", fabric), root)


def battery_room(m):
    """Cut-away room 4.4 x 7: tall back and left walls, low front and right walls, two rows of five battery cabinets facing the centre."""
    root = empty("battery_room")
    width, depth = 4.4, 7.0
    parts = [box("battery_floor_slab", (width, depth, 0.1), (0, 0, 0.05), m["floor"], bevel=0.015)]
    walls = [
        ((0, depth / 2 - 0.125), (width, 0.25), 2.6),   # back: three.js -Z is Blender +Y
        ((-width / 2 + 0.125, 0), (0.25, depth), 2.6),
        ((0, -depth / 2 + 0.125), (width, 0.25), 0.6),
        ((width / 2 - 0.125, 0), (0.25, depth), 0.6),
    ]
    for index, ((wall_x, wall_y), (size_x, size_y), height) in enumerate(walls):
        parts.append(box(f"battery_wall_{index}", (size_x, size_y, height - 0.1), (wall_x, wall_y, 0.1 + (height - 0.1) / 2), m["wall"], bevel=0.03, segments=3))
        parts.append(box(f"battery_wall_cap_{index}", (size_x + 0.02, size_y + 0.02, 0.06), (wall_x, wall_y, height + 0.03), m["brand"], bevel=0.01))
    for row in range(2):
        cabinet_x = (row - 0.5) * 1.9
        facing = 1 if cabinet_x < 0 else -1  # door faces the room centre
        for index in range(5):
            cabinet_y = (index - 2) * 1.2
            prefix = f"battery_cabinet_{row}_{index}"
            parts.append(box(f"{prefix}_body", (0.8, 0.95, 1.7), (cabinet_x, cabinet_y, 0.95), m["cabinet"], bevel=0.025, segments=3))
            door_x = cabinet_x + facing * 0.405
            parts.append(box(f"{prefix}_door", (0.012, 0.86, 1.56), (door_x, cabinet_y, 0.93), m["cabinet"], bevel=0.008))
            parts.append(box(f"{prefix}_vent", (0.014, 0.6, 0.36), (door_x + facing * 0.002, cabinet_y, 0.5), m["cabinet_vent"], bevel=0.004, uv_density=4))
            parts.append(box(f"{prefix}_handle", (0.03, 0.025, 0.18), (door_x + facing * 0.02, cabinet_y + 0.34, 1.0), m["steel"], bevel=0.008))
            parts.append(box(f"{prefix}_screen", (0.012, 0.18, 0.1), (door_x + facing * 0.004, cabinet_y - 0.15, 1.32), m["screen"], bevel=0.002))
            parts.append(box(f"{prefix}_light", (0.012, 0.5, 0.05), (door_x + facing * 0.006, cabinet_y, 1.5), m["ok_light"], bevel=0))
            parts.append(box(f"{prefix}_plinth", (0.76, 0.9, 0.1), (cabinet_x, cabinet_y, 0.15), m["frame"], bevel=0.01))
            parts.append(cylinder(f"{prefix}_feed", 0.03, 0.75, (cabinet_x, cabinet_y + 0.3, 2.17), m["cable"], vertices=10, bevel=0))
    # A cable ladder over the two rows, carried by the tall walls.
    for row in range(2):
        parts.append(box(f"battery_ladder_{row}", (0.36, depth - 0.6, 0.05), ((row - 0.5) * 1.9, 0, 2.55), m["steel"], bevel=0.008))
    parent(join("battery_room_body", parts), root)


def main():
    reset_scene()
    m = materials()
    substation(m)
    battery_room(m)
    export_glb("power.glb")


if __name__ == "__main__":
    main()
