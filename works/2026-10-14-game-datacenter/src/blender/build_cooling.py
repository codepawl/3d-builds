"""cooling.glb: the CRAH cooling unit, two chiller variants, and chilled water pipe pieces (segment, tee, cap, support).

Fan rotors are separate objects whose names end in `_rotor`, pivoting on their own axis, so the app can spin them.
"""
import math

from common import (box, coil_texture, cylinder, empty, export_glb, fan, join, material, parent, perforated_texture, reset_scene, sphere)

PIPE_RADIUS = 0.13


def materials():
    perforated_texture()
    coil_texture()
    return {
        "shell": material("unit_shell", "#f4f6fb", roughness=0.5, metallic=0.1),
        "shell_dark": material("unit_shell_dark", "#d9dee9", roughness=0.55, metallic=0.1),
        "grille": material("unit_grille", "#dde3ee", roughness=0.5, metallic=0.4, texture="perforated"),
        "coil": material("chiller_coil", "#ffffff", roughness=0.45, metallic=0.6, texture="coil"),
        "frame": material("unit_frame", "#3b4152", roughness=0.45, metallic=0.5),
        "steel": material("steel", "#c9d0de", roughness=0.35, metallic=0.55),
        "rubber": material("rubber", "#202330", roughness=0.85),
        "blade": material("fan_blade", "#596179", roughness=0.4, metallic=0.5),
        "hub": material("fan_hub", "#1f2330", roughness=0.7),
        "brand": material("brand_trim", "#5b4bff", roughness=0.4),
        "screen": material("screen", "#1b2a4a", roughness=0.2, emission="#3d6cff", emission_strength=1.2),
        "ok_light": material("port_light", "#46e08a", roughness=0.4, emission="#46e08a", emission_strength=3),
        "label": material("label_plate", "#f4f6fb", roughness=0.4),
        "cold": material("pipe_cold", "#4f8cff", roughness=0.35, metallic=0.2),
        "hot": material("pipe_hot", "#ff8a7a", roughness=0.35, metallic=0.2),
        "band": material("pipe_band", "#ffffff", roughness=0.5),
    }


def crah(m):
    """Computer room air handler, 2.3 wide, 1.0 deep, 2.1 tall, front (three.js +Z) toward the racks. Two top fans."""
    root = empty("crah")
    width, depth, height = 2.3, 1.0, 2.1
    front = -depth / 2
    parts = [
        box("crah_cabinet", (width, depth, height - 0.1), (0, 0, 0.1 + (height - 0.1) / 2), m["shell"], bevel=0.03, segments=3),
        box("crah_plinth", (width - 0.06, depth - 0.06, 0.1), (0, 0, 0.05), m["frame"], bevel=0.01),
        box("crah_top_deck", (width - 0.08, depth - 0.08, 0.04), (0, 0, height + 0.01), m["shell_dark"], bevel=0.01),
        box("crah_stripe", (width - 0.04, 0.012, 0.07), (0, front - 0.002, height - 0.18), m["brand"], bevel=0.003),
        box("crah_screen", (0.26, 0.012, 0.16), (0.72, front - 0.004, 1.62), m["screen"], bevel=0.004),
        box("crah_screen_bezel", (0.32, 0.01, 0.22), (0.72, front + 0.001, 1.62), m["frame"], bevel=0.008),
        box("crah_status", (0.05, 0.012, 0.02), (0.72, front - 0.004, 1.45), m["ok_light"], bevel=0.002, segments=1),
        box("crah_plate", (0.22, 0.008, 0.06), (-0.85, front - 0.003, 1.7), m["label"], bevel=0.003, segments=1),
    ]
    # Three doors: a perforated return-air section above, a solid panel below, a seam and a handle each.
    for index in range(3):
        door_x = (index - 1) * 0.74
        parts.append(box(f"crah_grille_{index}", (0.66, 0.02, 0.62), (door_x, front - 0.004, 1.12), m["grille"], bevel=0.008))
        parts.append(box(f"crah_door_{index}", (0.68, 0.016, 1.62), (door_x, front - 0.002, 1.0), m["shell"], bevel=0.012))
        parts.append(box(f"crah_handle_{index}", (0.025, 0.035, 0.2), (door_x + 0.27, front - 0.025, 0.95), m["steel"], bevel=0.008))
        parts.append(box(f"crah_kick_{index}", (0.6, 0.012, 0.08), (door_x, front - 0.012, 0.22), m["shell_dark"], bevel=0.004))
    for index, fan_x in enumerate((-0.52, 0.52)):
        housing, rotor = fan(f"crah_fan_{index + 1}", 0.36, (fan_x, 0, height + 0.06), m["blade"], m["hub"], m["steel"], m["shell_dark"])
        parts.append(housing)
        parent(rotor, root)
    parent(join("crah_body", parts), root)


def chiller(name, m, control_box_end):
    """Air-cooled chiller, 2.6 wide, 3.1 long (along three.js Z), 1.5 tall: skid, coil walls on both long sides, two big top fans."""
    root = empty(name)
    width, length, height = 2.6, 3.1, 1.5
    parts = [
        box(f"{name}_skid", (width - 0.1, length, 0.14), (0, 0, 0.07), m["frame"], bevel=0.012),
        box(f"{name}_deck", (width, length, 0.08), (0, 0, height - 0.04), m["shell"], bevel=0.025, segments=3),
        box(f"{name}_core", (width - 0.5, length - 0.3, height - 0.3), (0, 0, 0.14 + (height - 0.3) / 2), m["shell_dark"], bevel=0.02),
    ]
    for side in (-1, 1):
        parts.append(box(f"{name}_coil_{side}", (0.06, length - 0.32, height - 0.36), (side * (width / 2 - 0.08), 0, 0.17 + (height - 0.36) / 2),
                         m["coil"], bevel=0.008, uv_density=3))
        for end in (-1, 1):
            parts.append(box(f"{name}_post_{side}_{end}", (0.12, 0.12, height - 0.14), (side * (width / 2 - 0.07), end * (length / 2 - 0.07), 0.14 + (height - 0.14) / 2),
                             m["shell"], bevel=0.02, segments=3))
        parts.append(box(f"{name}_rail_{side}", (0.1, length - 0.2, 0.08), (side * (width / 2 - 0.07), 0, 0.18), m["shell"], bevel=0.015))
    # The end facing three.js +Z carries the nameplate stripe; one variant adds a control box there.
    front = -length / 2
    parts.append(box(f"{name}_stripe", (2.0, 0.012, 0.07), (0, front - 0.004, height - 0.14), m["brand"], bevel=0.003))
    if control_box_end:
        parts.append(box(f"{name}_control_box", (0.7, 0.24, 0.62), (-0.5, front - 0.1, 0.62), m["shell"], bevel=0.02, segments=3))
        parts.append(box(f"{name}_control_screen", (0.2, 0.01, 0.12), (-0.62, front - 0.225, 0.75), m["screen"], bevel=0.003))
        parts.append(box(f"{name}_control_light", (0.04, 0.01, 0.02), (-0.3, front - 0.225, 0.75), m["ok_light"], bevel=0.002, segments=1))
        parts.append(cylinder(f"{name}_conduit", 0.03, 0.4, (-0.5, front - 0.1, 0.12), m["frame"], vertices=12, bevel=0.004))
    else:
        for index in range(2):
            parts.append(box(f"{name}_access_panel_{index}", (0.8, 0.014, 0.8), (-0.45 + index * 0.9, front - 0.004, 0.66), m["shell"], bevel=0.012))
            parts.append(box(f"{name}_latch_{index}", (0.06, 0.02, 0.03), (-0.1 + index * 0.9, front - 0.014, 0.66), m["steel"], bevel=0.005))
    for index, fan_y in enumerate((-0.72, 0.72)):
        housing, rotor = fan(f"{name}_fan_{index + 1}", 0.6, (0, fan_y, height + 0.08), m["blade"], m["hub"], m["steel"], m["shell_dark"],
                             blades=4 if control_box_end else 6, housing_depth=0.07)
        parts.append(housing)
        parent(rotor, root)
    parent(join(f"{name}_body", parts), root)


def pipe_pieces(m):
    """Pieces along Blender X (three.js X), axis at height 0: 1 m segment with a flange, a tee, an end cap, and a stanchion."""
    for label in ("cold", "hot"):
        paint = m[label]
        segment = [
            cylinder(f"pipe_{label}_body", PIPE_RADIUS, 1.0, (0, 0, 0), paint, vertices=28, bevel=0, rotation=(0, math.pi / 2, 0), cap=False),
            cylinder(f"pipe_{label}_flange", PIPE_RADIUS + 0.05, 0.035, (0.48, 0, 0), paint, vertices=28, bevel=0.006, rotation=(0, math.pi / 2, 0)),
            cylinder(f"pipe_{label}_band", PIPE_RADIUS + 0.004, 0.08, (-0.1, 0, 0), m["band"], vertices=28, bevel=0, rotation=(0, math.pi / 2, 0), cap=False),
        ]
        for bolt in range(8):
            angle = bolt / 8 * math.tau
            segment.append(cylinder(f"pipe_{label}_bolt_{bolt}", 0.012, 0.06, (0.48, math.cos(angle) * (PIPE_RADIUS + 0.03), math.sin(angle) * (PIPE_RADIUS + 0.03)),
                                    m["steel"], vertices=6, bevel=0, rotation=(0, math.pi / 2, 0)))
        join(f"pipe_segment_{label}", segment)
        # Tee: header along Blender Y (three.js Z), branch toward -X (the hall wall).
        tee = [
            cylinder(f"tee_{label}_run", PIPE_RADIUS + 0.015, 0.6, (0, 0, 0), paint, vertices=28, bevel=0.01, rotation=(math.pi / 2, 0, 0)),
            cylinder(f"tee_{label}_branch", PIPE_RADIUS + 0.015, 0.36, (-0.18, 0, 0), paint, vertices=28, bevel=0.01, rotation=(0, math.pi / 2, 0)),
            sphere(f"tee_{label}_body", PIPE_RADIUS + 0.03, (0, 0, 0), paint),
        ]
        for end in (-1, 1):
            tee.append(cylinder(f"tee_{label}_flange_{end}", PIPE_RADIUS + 0.05, 0.035, (0, end * 0.3, 0), paint, vertices=28, bevel=0.006,
                                rotation=(math.pi / 2, 0, 0)))
        join(f"pipe_tee_{label}", tee)
        cap = [
            cylinder(f"cap_{label}_neck", PIPE_RADIUS + 0.01, 0.12, (0.06, 0, 0), paint, vertices=28, bevel=0, rotation=(0, math.pi / 2, 0), cap=False),
            sphere(f"cap_{label}_dome", PIPE_RADIUS + 0.01, (0.12, 0, 0), paint, scale=(0.55, 1, 1)),
            cylinder(f"cap_{label}_flange", PIPE_RADIUS + 0.05, 0.035, (0.0, 0, 0), paint, vertices=28, bevel=0.006, rotation=(0, math.pi / 2, 0)),
        ]
        join(f"pipe_cap_{label}", cap)
    # Stanchion beside the pipes holding both (cold at 0.3 m, hot at 0.62 m) on cantilever arms with U-straps.
    support = [
        box("pipe_support_post", (0.08, 0.08, 0.86), (0, 0.3, 0.43), m["frame"], bevel=0.01),
        box("pipe_support_base", (0.24, 0.24, 0.02), (0, 0.3, 0.01), m["steel"], bevel=0.004),
    ]
    for height in (0.3, 0.62):
        support.append(box(f"pipe_support_arm_{height}", (0.08, 0.36, 0.05), (0, 0.13, height - PIPE_RADIUS - 0.025), m["frame"], bevel=0.008))
        support.append(box(f"pipe_support_shoe_{height}", (0.16, 0.14, 0.02), (0, 0, height - PIPE_RADIUS - 0.005), m["rubber"], bevel=0.004))
        strap = cylinder(f"pipe_support_strap_{height}", PIPE_RADIUS + 0.012, 0.04, (0, 0, height), m["steel"], vertices=28, bevel=0,
                         rotation=(0, math.pi / 2, 0), cap=False)
        support.append(strap)
    join("pipe_support", support)


def main():
    reset_scene()
    m = materials()
    crah(m)
    chiller("chiller_a", m, control_box_end=True)
    chiller("chiller_b", m, control_box_end=False)
    pipe_pieces(m)
    export_glb("cooling.glb")


if __name__ == "__main__":
    main()
