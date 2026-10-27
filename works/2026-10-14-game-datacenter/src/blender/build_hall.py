"""hall.glb: three rack variants, the GPU tray and its glow bar, the rack status strip, cable tray segments,
wall panels and the robot charging dock.

Rack sizes follow RACK in src/world.js: 0.78 wide, 1.2 deep, 2.2 tall. The rack front (cold aisle side) faces three.js +Z.
"""
import math

from common import (box, cylinder, export_glb, grille_materials, hex_vent_texture, join, louvre_grille, material, perforated_texture, reset_scene)

RACK_WIDTH = 0.78
RACK_DEPTH = 1.2
RACK_HEIGHT = 2.2
FRONT_Y = -RACK_DEPTH / 2  # Blender -Y is three.js +Z.
TRAY_LOW = 0.27
TRAY_HIGH = 1.85


def materials():
    perforated_texture()
    hex_vent_texture()
    return {
        # rack_paint and rack_door are recoloured per site in the app (site.rackColor).
        "paint": material("rack_paint", "#ffffff", roughness=0.42, metallic=0.35),
        "door": material("rack_door", "#ffffff", roughness=0.5, metallic=0.3, texture="perforated"),
        "frame": material("rack_frame", "#23262f", roughness=0.4, metallic=0.6),
        "interior": material("rack_interior", "#14161d", roughness=0.8),
        "vent": material("tray_face", "#ffffff", roughness=0.45, metallic=0.5, texture="hex_vent"),
        "steel": material("steel", "#c9d0de", roughness=0.35, metallic=0.55),
        "rubber": material("rubber", "#202330", roughness=0.85),
        "label": material("label_plate", "#f4f6fb", roughness=0.4),
        "port_light": material("port_light", "#46e08a", roughness=0.4, emission="#46e08a", emission_strength=3),
        "amber_light": material("amber_light", "#ffb02e", roughness=0.4, emission="#ffb02e", emission_strength=3),
        "glow": material("tray_glow", "#ffffff", roughness=0.4, emission="#ffffff", emission_strength=1),
        "fibre": material("fibre_cable", "#f2c94c", roughness=0.55),
        "power_cable": material("power_cable", "#5b4bff", roughness=0.5),
        "black_cable": material("black_cable", "#2a2d38", roughness=0.6),
        "wall": material("wall_panel", "#fbfcff", roughness=0.6),
        "wall_base": material("wall_base", "#e3e7f0", roughness=0.7),
        "grille": grille_materials(),
        "brand": material("brand_trim", "#5b4bff", roughness=0.4),
        "dock_pad": material("dock_pad", "#e1defe", roughness=0.8),
        "white": material("white_shell", "#ffffff", roughness=0.45),
        "screen": material("screen", "#1b2a4a", roughness=0.2, emission="#3d6cff", emission_strength=1.2),
    }


def rack_shell(name, m):
    """Parts every rack variant shares: frame posts, side panels with a seam, top, plinth, feet, front recess and rear door."""
    parts = []
    half_w = RACK_WIDTH / 2
    half_d = RACK_DEPTH / 2
    for side in (-1, 1):
        # Side panels: two sheets with a seam, set a little inside the frame.
        for index, (start, end) in enumerate(((0.06, 1.12), (1.13, 2.14))):
            parts.append(box(f"{name}_side_{side}_{index}", (0.02, RACK_DEPTH - 0.08, end - start),
                             (side * (half_w - 0.012), 0, (start + end) / 2), m["paint"], bevel=0.006))
        for depth_side in (-1, 1):
            parts.append(box(f"{name}_post_{side}_{depth_side}", (0.045, 0.045, RACK_HEIGHT - 0.08),
                             (side * (half_w - 0.024), depth_side * (half_d - 0.024), RACK_HEIGHT / 2), m["paint"], bevel=0.008))
            parts.append(cylinder(f"{name}_foot_{side}_{depth_side}", 0.025, 0.05, (side * (half_w - 0.07), depth_side * (half_d - 0.08), 0.025),
                                  m["rubber"], vertices=12, bevel=0.004))
        # Rack rails just inside the front opening, with screw holes as small steel studs.
        parts.append(box(f"{name}_rail_{side}", (0.03, 0.02, TRAY_HIGH - TRAY_LOW + 0.24),
                         (side * (half_w - 0.055), FRONT_Y + 0.045, (TRAY_LOW + TRAY_HIGH) / 2), m["frame"], bevel=0.004))
        for index in range(12):
            parts.append(cylinder(f"{name}_stud_{side}_{index}", 0.006, 0.006, (side * (half_w - 0.055), FRONT_Y + 0.033, 0.2 + index * 0.155),
                                  m["steel"], vertices=8, bevel=0, rotation=(math.pi / 2, 0, 0)))
    parts.append(box(f"{name}_top", (RACK_WIDTH, RACK_DEPTH, 0.06), (0, 0, RACK_HEIGHT - 0.03), m["paint"], bevel=0.014, segments=3))
    parts.append(box(f"{name}_plinth", (RACK_WIDTH - 0.04, RACK_DEPTH - 0.04, 0.06), (0, 0, 0.08), m["frame"], bevel=0.01))
    # Dark interior seen through the open front between the trays.
    parts.append(box(f"{name}_interior", (RACK_WIDTH - 0.08, 0.02, RACK_HEIGHT - 0.22), (0, FRONT_Y + 0.12, RACK_HEIGHT / 2), m["interior"], bevel=0))
    # Bottom power shelf with four PSU handles, top switch with port lights.
    parts.append(box(f"{name}_power_shelf", (RACK_WIDTH - 0.13, 0.05, 0.13), (0, FRONT_Y + 0.05, 0.19), m["vent"], bevel=0.006, uv_density=6))
    for index in range(4):
        parts.append(box(f"{name}_psu_handle_{index}", (0.05, 0.02, 0.025), (-0.24 + index * 0.16, FRONT_Y + 0.02, 0.19), m["steel"], bevel=0.005))
    parts.append(box(f"{name}_switch", (RACK_WIDTH - 0.13, 0.05, 0.16), (0, FRONT_Y + 0.05, 1.98), m["vent"], bevel=0.006, uv_density=6))
    for index in range(10):
        parts.append(box(f"{name}_port_{index}", (0.028, 0.01, 0.018), (-0.25 + index * 0.055, FRONT_Y + 0.022, 1.95),
                         m["port_light"] if index % 3 else m["amber_light"], bevel=0))
    parts.append(box(f"{name}_label", (0.16, 0.006, 0.04), (0.18, FRONT_Y + 0.02, 2.035), m["label"], bevel=0.003, segments=1))
    # Rear door on the hot aisle side: perforated sheet in a frame, handle and hinges.
    back_y = RACK_DEPTH / 2
    parts.append(box(f"{name}_rear_door", (RACK_WIDTH - 0.07, 0.02, RACK_HEIGHT - 0.2), (0, back_y - 0.008, RACK_HEIGHT / 2), m["door"], bevel=0.008))
    parts.append(box(f"{name}_rear_handle", (0.025, 0.035, 0.22), (half_w - 0.09, back_y + 0.018, 1.12), m["steel"], bevel=0.008))
    for height in (0.4, 1.8):
        parts.append(cylinder(f"{name}_hinge_{height}", 0.012, 0.08, (-half_w + 0.04, back_y + 0.006, height), m["frame"], vertices=10, bevel=0.003))
    return parts


def rack_variant_a(m):
    """Top fan tray: three small exhaust fans behind grilles."""
    parts = rack_shell("rack_a", m)
    for index in range(3):
        parts.append(cylinder(f"rack_a_topfan_{index}", 0.09, 0.012, (0, -0.32 + index * 0.32, RACK_HEIGHT + 0.004), m["frame"], vertices=24, bevel=0.003))
        parts.append(cylinder(f"rack_a_topfan_hub_{index}", 0.03, 0.016, (0, -0.32 + index * 0.32, RACK_HEIGHT + 0.006), m["steel"], vertices=16, bevel=0.003))
    return join("rack_a", parts)


def rack_variant_b(m):
    """Cable chimney at the back with a brush strip, and coolant quick-connects for direct liquid cooling."""
    parts = rack_shell("rack_b", m)
    parts.append(box("rack_b_chimney", (0.5, 0.26, 0.24), (0, 0.42, RACK_HEIGHT + 0.12), m["paint"], bevel=0.012, segments=3))
    parts.append(box("rack_b_brush", (0.42, 0.18, 0.012), (0, 0.42, RACK_HEIGHT + 0.244), m["rubber"], bevel=0.003))
    for index, color in enumerate(("#4f8cff", "#ff8a7a")):
        hose = material(f"hose_{index}", color, roughness=0.35)
        parts.append(cylinder(f"rack_b_quick_connect_{index}", 0.028, 0.08, (-0.22 + index * 0.1, 0.1, RACK_HEIGHT + 0.04), hose, vertices=16, bevel=0.006))
    return join("rack_b", parts)


def rack_variant_c(m):
    """Overhead busway tap box and a cable bundle dropping in."""
    parts = rack_shell("rack_c", m)
    parts.append(box("rack_c_tap_box", (0.3, 0.22, 0.16), (0.12, 0.2, RACK_HEIGHT + 0.08), m["label"], bevel=0.015, segments=3))
    parts.append(box("rack_c_tap_light", (0.05, 0.006, 0.02), (0.12, 0.088, RACK_HEIGHT + 0.12), m["port_light"], bevel=0))
    parts.append(cylinder("rack_c_feed", 0.035, 0.36, (0.12, 0.2, RACK_HEIGHT + 0.34), m["black_cable"], vertices=14, bevel=0.005))
    parts.append(cylinder("rack_c_grommet", 0.07, 0.014, (-0.18, -0.2, RACK_HEIGHT + 0.006), m["rubber"], vertices=20, bevel=0.004))
    return join("rack_c", parts)


def gpu_tray(m):
    """A GPU tray faceplate: honeycomb vent, two pull handles and a release latch. Origin at its centre."""
    parts = [box("gpu_tray_face", (RACK_WIDTH - 0.13, 0.03, 0.17), (0, 0, 0), m["vent"], bevel=0.006, uv_density=6)]
    for side in (-1, 1):
        parts.append(box(f"gpu_tray_ear_{side}", (0.03, 0.035, 0.15), (side * 0.31, -0.004, 0), m["frame"], bevel=0.006))
        parts.append(box(f"gpu_tray_handle_{side}", (0.018, 0.03, 0.1), (side * 0.27, -0.03, 0), m["steel"], bevel=0.007, segments=3))
    parts.append(box("gpu_tray_latch", (0.04, 0.012, 0.018), (0.2, -0.019, 0.055), m["amber_light"], bevel=0.003, segments=1))
    join("gpu_tray", parts)
    # The glow bar is its own node: the app gives each instance a colour from the tray temperature.
    box("tray_glow", (0.42, 0.012, 0.03), (-0.03, -0.021, -0.045), m["glow"], bevel=0.004, segments=2)


def status_strip(m):
    box("status_strip", (RACK_WIDTH * 0.86, 0.07, 0.022), (0, 0, 0), m["glow"], bevel=0.006, segments=2)


def cable_tray(m):
    """2 m of ladder tray at the origin (its bottom), fibre and power bundles inside, one support post down to the rack top."""
    length = 2.0
    parts = []
    for side in (-1, 1):
        parts.append(box(f"cable_tray_rail_{side}", (length, 0.025, 0.09), (0, side * 0.24, 0.045), m["steel"], bevel=0.005))
        parts.append(box(f"cable_tray_lip_{side}", (length, 0.05, 0.008), (0, side * 0.22, 0.09), m["steel"], bevel=0.002, segments=1))
    for index in range(8):
        parts.append(box(f"cable_tray_rung_{index}", (0.03, 0.46, 0.012), (-length / 2 + 0.125 + index * 0.25, 0, 0.012), m["steel"], bevel=0.003))
    bundles = (("fibre", m["fibre"], -0.1, 0.022, 5), ("power", m["power_cable"], 0.12, 0.026, 3), ("black", m["black_cable"], 0.02, 0.02, 2))
    for label, cable_material, center, radius, count in bundles:
        for index in range(count):
            offset_y = center + (index % 3 - 1) * radius * 1.9
            offset_z = 0.03 + radius + (index // 3) * radius * 1.7
            parts.append(cylinder(f"cable_{label}_{index}", radius, length, (0, offset_y, offset_z), cable_material, vertices=12, bevel=0.008, segments=2,
                                  rotation=(0, math.pi / 2, 0), cap=True))
    join("cable_tray", parts)
    post = [
        box("cable_tray_post_rod", (0.04, 0.04, 0.42), (0, 0, -0.21), m["frame"], bevel=0.006),
        box("cable_tray_post_bracket", (0.08, 0.54, 0.03), (0, 0, -0.015), m["frame"], bevel=0.006),
        box("cable_tray_post_foot", (0.12, 0.12, 0.012), (0, 0, -0.414), m["frame"], bevel=0.003),
    ]
    join("cable_tray_post", post)
    # The spine along the side corridor stands on a floor post with an arm.
    stand = [
        box("cable_stand_column", (0.07, 0.07, 2.6), (0, 0, -1.31), m["frame"], bevel=0.01),
        box("cable_stand_arm", (0.1, 0.56, 0.04), (0, 0, -0.02), m["frame"], bevel=0.008),
        box("cable_stand_base", (0.24, 0.24, 0.02), (0, 0, -2.61), m["steel"], bevel=0.005),
    ]
    for corner in range(4):
        angle = corner * math.pi / 2 + math.pi / 4
        stand.append(cylinder(f"cable_stand_bolt_{corner}", 0.012, 0.016, (math.cos(angle) * 0.13, math.sin(angle) * 0.13, -2.592),
                              m["steel"], vertices=6, bevel=0.002))
    join("cable_stand", stand)


def wall_panel(name, height, m):
    """3 m of precast wall, 0.32 thick: two panels with a reveal between, a darker base, the brand cap on top."""
    parts = []
    for index in (-1, 1):
        parts.append(box(f"{name}_panel_{index}", (1.49, 0.32, height - 0.16), (index * 0.755, 0, 0.12 + (height - 0.16) / 2), m["wall"], bevel=0.02, segments=3))
    parts.append(box(f"{name}_base", (3.0, 0.3, 0.12), (0, 0, 0.06), m["wall_base"], bevel=0.01))
    if height > 2:
        parts.append(box(f"{name}_reveal", (3.0, 0.3, 0.015), (0, 0, 1.2), m["wall_base"], bevel=0))
        for side in (-1, 1):
            parts += louvre_grille(f"{name}_vent_{side}", 0.56, 0.3, (0.75, 0, height - 0.55), "y", side, m["grille"], base_offset=0.16)
    parts.append(box(f"{name}_cap", (3.0, 0.34, 0.06), (0, 0, height - 0.01), m["brand"], bevel=0.01))
    join(name, parts)


def dock(m):
    """Charging dock: floor pad with a border and a post whose contacts face the cart (three.js +X)."""
    parts = [
        box("dock_pad_plate", (1.3, 1.25, 0.02), (0, 0, 0.01), m["dock_pad"], bevel=0.008),
        box("dock_pad_border", (1.32, 1.27, 0.012), (0, 0, 0.004), m["brand"], bevel=0.004),
        box("dock_post", (0.25, 0.5, 0.9), (-0.8, 0, 0.45), m["white"], bevel=0.04, segments=4),
        box("dock_post_base", (0.32, 0.56, 0.06), (-0.8, 0, 0.03), m["frame"], bevel=0.01),
        box("dock_screen", (0.006, 0.26, 0.14), (-0.673, 0, 0.74), m["screen"], bevel=0),
        box("dock_light", (0.008, 0.3, 0.05), (-0.672, 0, 0.56), m["port_light"], bevel=0),
    ]
    for side in (-1, 1):
        parts.append(box(f"dock_contact_{side}", (0.03, 0.05, 0.12), (-0.665, side * 0.12, 0.3), m["steel"], bevel=0.008))
    join("dock", parts)


def main():
    reset_scene()
    m = materials()
    rack_variant_a(m)
    rack_variant_b(m)
    rack_variant_c(m)
    gpu_tray(m)
    status_strip(m)
    cable_tray(m)
    wall_panel("wall_tall", 3.4, m)
    wall_panel("wall_low", 0.7, m)
    dock(m)
    export_glb("hall.glb")


if __name__ == "__main__":
    main()
