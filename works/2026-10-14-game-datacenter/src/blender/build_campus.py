"""campus.glb: three neighbour hall buildings (one per footprint the app places), three tree variants, a road tile and a curb.
"""
import math

from common import (box, cylinder, export_glb, fan, grille_materials, hash_noise, join, louvre_grille, material, reset_scene, speckle_texture, perforated_texture, finish_object, link_object)

import bmesh
import bpy

HALL_HEIGHT = 4.2


def materials():
    speckle_texture("asphalt", 0.62, 0.22, 7, blotch=0.0)
    perforated_texture()
    return {
        "wall": material("building_wall", "#f6f7fc", roughness=0.6),
        "reveal": material("building_reveal", "#dfe3ee", roughness=0.7),
        "roof": material("building_roof", "#e3e7f2", roughness=0.85),
        "base": material("wall_base", "#e3e7f0", roughness=0.7),
        "brand": material("brand_trim", "#5b4bff", roughness=0.4),
        "door": material("roll_door", "#cfd6e4", roughness=0.45, metallic=0.4),
        "glass": material("window_glass", "#9fb4d8", roughness=0.08, metallic=0.4),
        "frame": material("unit_frame", "#3b4152", roughness=0.45, metallic=0.5),
        "grille": grille_materials(),
        "unit": material("unit_shell", "#ffffff", roughness=0.5, metallic=0.1),
        "steel": material("steel", "#c9d0de", roughness=0.35, metallic=0.55),
        "blade": material("fan_blade", "#596179", roughness=0.4, metallic=0.5),
        "hub": material("fan_hub", "#1f2330", roughness=0.7),
        "asphalt": material("asphalt", "#ffffff", roughness=0.95, texture="asphalt"),
        "paint": material("road_paint", "#ffffff", roughness=0.6),
        "curb": material("curb", "#e8ebf2", roughness=0.85),
        "bark": material("bark", "#b9a48f", roughness=0.9),
        "leaf": material("leaf", "#8ad6a8", roughness=0.75),
        "leaf_dark": material("leaf_dark", "#6cc293", roughness=0.75),
    }


def hall_building(name, width, depth, m):
    """A windowless data hall: wall panels with reveals, parapet, roll-up door, louvres, rooftop air units, a blank brand band."""
    front = -depth / 2
    parts = [
        box(f"{name}_shell", (width, depth, HALL_HEIGHT - 0.3), (0, 0, 0.3 + (HALL_HEIGHT - 0.3) / 2), m["wall"], bevel=0.12, segments=3),
        box(f"{name}_plinth", (width + 0.1, depth + 0.1, 0.3), (0, 0, 0.15), m["base"], bevel=0.03),
        box(f"{name}_roof", (width - 0.3, depth - 0.3, 0.05), (0, 0, HALL_HEIGHT + 0.0), m["roof"], bevel=0.01),
        box(f"{name}_brand_band", (width - 0.4, 0.02, 0.14), (0, front - 0.01, HALL_HEIGHT - 0.5), m["brand"], bevel=0.005),
    ]
    # Parapet lip around the roof.
    for side in (-1, 1):
        parts.append(box(f"{name}_parapet_x_{side}", (width, 0.16, 0.22), (0, side * (depth / 2 - 0.08), HALL_HEIGHT + 0.1), m["wall"], bevel=0.03))
        parts.append(box(f"{name}_parapet_y_{side}", (0.16, depth, 0.22), (side * (width / 2 - 0.08), 0, HALL_HEIGHT + 0.1), m["wall"], bevel=0.03))
    # Vertical panel reveals on the two faces the camera sees most (front and sides).
    for step in range(1, int(width / 3)):
        reveal_x = -width / 2 + step * width / int(width / 3)
        parts.append(box(f"{name}_reveal_front_{step}", (0.03, 0.02, HALL_HEIGHT - 0.5), (reveal_x, front - 0.004, 0.3 + (HALL_HEIGHT - 0.5) / 2), m["reveal"], bevel=0))
    for side in (-1, 1):
        for step in range(1, int(depth / 3)):
            reveal_y = -depth / 2 + step * depth / int(depth / 3)
            parts.append(box(f"{name}_reveal_side_{side}_{step}", (0.02, 0.03, HALL_HEIGHT - 0.5), (side * (width / 2 + 0.004), reveal_y, 0.3 + (HALL_HEIGHT - 0.5) / 2),
                             m["reveal"], bevel=0))
        # Louvre banks high on each side wall.
        for index in range(max(1, int(depth / 8))):
            louvre_y = -depth / 2 + (index + 0.5) * depth / max(1, int(depth / 8))
            parts += louvre_grille(f"{name}_louvre_{side}_{index}", 1.6, 0.9, (side * width / 2, louvre_y, HALL_HEIGHT - 1.3), "x", side, m["grille"])
            parts.append(box(f"{name}_louvre_hood_{side}_{index}", (0.16, 1.7, 0.06), (side * (width / 2 + 0.06), louvre_y, HALL_HEIGHT - 0.82), m["reveal"], bevel=0.015))
    # Front: a roll-up loading door with ribs, a personnel door and a canopy.
    door_x = -width / 4
    parts.append(box(f"{name}_door_frame", (3.2, 0.06, 3.0), (door_x, front - 0.02, 0.3 + 1.5), m["reveal"], bevel=0.02))
    for rib in range(10):
        parts.append(box(f"{name}_door_rib_{rib}", (2.9, 0.05, 0.25), (door_x, front - 0.045, 0.45 + rib * 0.27), m["door"], bevel=0.02))
    parts.append(box(f"{name}_canopy", (3.6, 0.9, 0.08), (door_x, front - 0.45, 3.45), m["frame"], bevel=0.02))
    parts.append(box(f"{name}_entry", (1.0, 0.04, 2.1), (width / 4, front - 0.02, 0.3 + 1.05), m["glass"], bevel=0.01))
    parts.append(box(f"{name}_entry_frame", (1.12, 0.03, 2.2), (width / 4, front - 0.006, 0.3 + 1.1), m["frame"], bevel=0.01))
    parts.append(box(f"{name}_sign", (1.4, 0.03, 0.4), (width / 4, front - 0.02, 2.9), m["unit"], bevel=0.02))
    parts.append(box(f"{name}_sign_mark", (0.3, 0.012, 0.18), (width / 4 - 0.45, front - 0.04, 2.9), m["brand"], bevel=0.005))
    for corner_x in (-1, 1):
        parts.append(cylinder(f"{name}_downpipe_{corner_x}", 0.06, HALL_HEIGHT - 0.1, (corner_x * (width / 2 - 0.3), front - 0.08, (HALL_HEIGHT - 0.1) / 2),
                              m["reveal"], vertices=12, bevel=0.005))
    # Rooftop air units with two fans each, matching the count and spacing the first pass used.
    for unit in range(int(width // 4)):
        unit_x = -width / 2 + 2.4 + unit * 4
        parts.append(box(f"{name}_rtu_{unit}", (2.4, 2.8, 0.6), (unit_x, 0, HALL_HEIGHT + 0.32), m["unit"], bevel=0.06, segments=3))
        parts.append(box(f"{name}_rtu_curb_{unit}", (2.5, 2.9, 0.08), (unit_x, 0, HALL_HEIGHT + 0.04), m["frame"], bevel=0.01))
        for index, fan_y in enumerate((-0.68, 0.68)):
            housing, rotor = fan(f"{name}_rtu_{unit}_fan_{index}", 0.48, (unit_x, fan_y, HALL_HEIGHT + 0.64), m["blade"], m["hub"], m["steel"], m["unit"])
            parts += [housing, rotor]
    join(name, parts)


def blob(name, radius, location, mat, scale, seed, roughness=0.12):
    """A smooth lumpy crown: a UV sphere with each vertex pushed in or out by low-frequency noise."""
    mesh = bpy.data.meshes.new(name)
    builder = bmesh.new()
    bmesh.ops.create_uvsphere(builder, u_segments=28, v_segments=18, radius=radius)
    for vertex in builder.verts:
        direction = vertex.co.normalized()
        bump = (math.sin(direction.x * 4.1 + seed) + math.sin(direction.y * 3.7 + seed * 2) + math.sin(direction.z * 5.3 + seed * 3)) / 3
        vertex.co = direction * radius * (1 + bump * roughness + (hash_noise(direction.x, direction.y, seed) - 0.5) * 0.03)
    builder.to_mesh(mesh)
    builder.free()
    obj = link_object(bpy.data.objects.new(name, mesh))
    obj.scale = scale
    obj.location = location
    return finish_object(obj, mat, 0, 0)


def trees(m):
    """Variant a: round crown of three lumps. b: stacked cone conifer. c: tall columnar crown. Each about 2.5 m at scale 1."""
    def trunk(name, height):
        return cylinder(f"{name}_trunk", 0.1, height, (0, 0, height / 2), m["bark"], vertices=12, bevel=0.02, radius_top=0.07)

    join("tree_a", [
        trunk("tree_a", 1.2),
        blob("tree_a_crown_main", 0.72, (0, 0, 1.65), m["leaf"], (1, 1, 1.05), 1),
        blob("tree_a_crown_side", 0.48, (0.42, 0.18, 1.35), m["leaf_dark"], (1, 1, 1), 2),
        blob("tree_a_crown_top", 0.42, (-0.25, -0.2, 2.1), m["leaf"], (1, 1, 1), 3),
    ])
    conifer = [trunk("tree_b", 0.8)]
    for tier in range(3):
        conifer.append(cylinder(f"tree_b_tier_{tier}", 0.78 - tier * 0.2, 0.9, (0, 0, 0.9 + tier * 0.55), m["leaf_dark"] if tier % 2 else m["leaf"],
                                vertices=20, bevel=0.06, segments=3, radius_top=0.08))
    join("tree_b", conifer)
    join("tree_c", [
        trunk("tree_c", 1.0),
        blob("tree_c_crown", 0.55, (0, 0, 1.95), m["leaf"], (1, 1, 1.75), 4, roughness=0.08),
        blob("tree_c_crown_low", 0.42, (0.1, 0.05, 1.3), m["leaf_dark"], (1, 1, 1.1), 5),
    ])


ROAD_LENGTH = 2.4
ROAD_WIDTH = 3.6
LINE_WIDTH = 0.08
PAINT_HEIGHT = 0.006
PAINT_Z = 0.022


def paint_line(name, from_point, to_point, m):
    """A white line on the road between two points of one axis (x, y in Blender axes), butt ends so neighbouring pieces join."""
    (from_x, from_y), (to_x, to_y) = from_point, to_point
    length_x = max(abs(to_x - from_x), LINE_WIDTH)
    length_y = max(abs(to_y - from_y), LINE_WIDTH)
    return box(name, (length_x, length_y, PAINT_HEIGHT), ((from_x + to_x) / 2, (from_y + to_y) / 2, PAINT_Z), m["paint"], bevel=0, smooth=False)


def road_pieces(m):
    """Road pieces on a 3.6 m wide carriageway, all with butt ends so they tile without gaps or overlaps:
    road_tile 2.4 long (centre dash and two edge lines), road_corner (arms toward +X and Blender +Y, L-shaped edge lines),
    road_tee (main road along X, side road toward Blender +Y) and a curb 2.4 long that overlaps its neighbour by 0.03 at each end."""
    half = ROAD_WIDTH / 2
    inner = half - 0.2
    join("road_tile", [
        box("road_asphalt", (ROAD_LENGTH, ROAD_WIDTH, 0.02), (0, 0, 0.01), m["asphalt"], bevel=0, uv_density=0.4, smooth=False),
        box("road_dash", (1.1, 0.14, PAINT_HEIGHT), (0, 0, PAINT_Z), m["paint"], bevel=0, smooth=False),
        paint_line("road_edge_a", (-ROAD_LENGTH / 2, inner), (ROAD_LENGTH / 2, inner), m),
        paint_line("road_edge_b", (-ROAD_LENGTH / 2, -inner), (ROAD_LENGTH / 2, -inner), m),
    ])
    join("road_corner", [
        box("corner_asphalt", (ROAD_WIDTH, ROAD_WIDTH, 0.02), (0, 0, 0.01), m["asphalt"], bevel=0, uv_density=0.4, smooth=False),
        paint_line("corner_outer_x", (-inner - LINE_WIDTH / 2, -inner), (half, -inner), m),
        paint_line("corner_outer_y", (-inner, -inner - LINE_WIDTH / 2), (-inner, half), m),
        paint_line("corner_inner_x", (inner - LINE_WIDTH / 2, inner), (half, inner), m),
        paint_line("corner_inner_y", (inner, inner - LINE_WIDTH / 2), (inner, half), m),
    ])
    join("road_tee", [
        box("tee_asphalt", (ROAD_WIDTH, ROAD_WIDTH, 0.02), (0, 0, 0.01), m["asphalt"], bevel=0, uv_density=0.4, smooth=False),
        paint_line("tee_edge", (-half, -inner), (half, -inner), m),
        paint_line("tee_left_x", (-half, inner), (-inner + LINE_WIDTH / 2, inner), m),
        paint_line("tee_left_y", (-inner, inner - LINE_WIDTH / 2), (-inner, half), m),
        paint_line("tee_right_x", (inner - LINE_WIDTH / 2, inner), (half, inner), m),
        paint_line("tee_right_y", (inner, inner - LINE_WIDTH / 2), (inner, half), m),
    ])
    box("curb", (ROAD_LENGTH + 0.06, 0.22, 0.14), (0, 0, 0.07), m["curb"], bevel=0.025, segments=3)


def main():
    reset_scene()
    m = materials()
    hall_building("hall_a", 18, 26, m)
    hall_building("hall_b", 16, 22, m)
    hall_building("hall_c", 26, 14, m)
    trees(m)
    road_pieces(m)
    export_glb("campus.glb")


if __name__ == "__main__":
    main()
