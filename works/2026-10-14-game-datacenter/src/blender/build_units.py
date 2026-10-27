"""units.glb: the robot swap cart and three technician variants (original simple figures).

Moving parts are separate named objects with their pivots where they turn:
robot_wheel_* spin on their hub axis, robot_lift rises with robot_cargo (the carried tray) on it, robot_beacon is recoloured by state;
tech_*_leg_l / _leg_r swing from the hip, tech_*_body bobs, tech_*_arm_l / _arm_r swing from the shoulder.
"""
import math

from common import (box, cylinder, empty, export_glb, join, material, parent, reset_scene, set_origin, sphere, hex_vent_texture)


def robot():
    hex_vent_texture()
    shell = material("robot_shell", "#ffffff", roughness=0.35)
    brand = material("brand_trim", "#5b4bff", roughness=0.4)
    rubber = material("rubber", "#202330", roughness=0.85)
    steel = material("steel", "#c9d0de", roughness=0.35, metallic=0.55)
    glass = material("sensor_glass", "#141a2c", roughness=0.1, metallic=0.2)
    sensor_light = material("sensor_light", "#7aa7ff", roughness=0.3, emission="#7aa7ff", emission_strength=2.5)
    mast_paint = material("robot_mast", "#e9ecf4", roughness=0.4)
    screen = material("screen", "#1b2a4a", roughness=0.2, emission="#3d6cff", emission_strength=1.2)
    tray_face = material("tray_face", "#ffffff", roughness=0.45, metallic=0.5, texture="hex_vent")
    rack_paint = material("cargo_paint", "#30354a", roughness=0.4, metallic=0.3)
    cargo_glow = material("cargo_glow", "#4cc8ff", roughness=0.4, emission="#4cc8ff", emission_strength=2.5)
    beacon_material = material("beacon", "#ffffff", roughness=0.3, emission="#ffffff", emission_strength=1)

    root = empty("robot")
    # Blender -Y is the cart's front (three.js +Z, its heading). The mast stands at the back.
    body = [
        box("robot_chassis", (0.82, 1.05, 0.34), (0, 0, 0.33), shell, bevel=0.1, segments=4),
        box("robot_bumper", (0.86, 1.09, 0.08), (0, 0, 0.2), rubber, bevel=0.035, segments=3),
        box("robot_stripe", (0.84, 1.0, 0.05), (0, 0, 0.38), brand, bevel=0.02, segments=2),
        box("robot_sensor_window", (0.44, 0.02, 0.08), (0, -0.535, 0.3), glass, bevel=0.012),
        box("robot_sensor_strip", (0.3, 0.01, 0.014), (0, -0.548, 0.3), sensor_light, bevel=0),
        box("robot_mast", (0.5, 0.1, 0.78), (0, 0.38, 0.83), mast_paint, bevel=0.03, segments=3),
        box("robot_mast_screen", (0.26, 0.012, 0.14), (0, 0.326, 1.0), screen, bevel=0.004),
        box("robot_deck", (0.66, 0.66, 0.02), (0, -0.12, 0.505), rubber, bevel=0.006),
    ]
    for side in (-1, 1):
        body.append(box(f"robot_guide_{side}", (0.03, 0.04, 0.7), (side * 0.2, 0.32, 0.86), steel, bevel=0.008))
        body.append(box(f"robot_side_panel_{side}", (0.012, 0.6, 0.16), (side * 0.412, 0, 0.32), shell, bevel=0.006))
        body.append(cylinder(f"robot_headlight_{side}", 0.025, 0.012, (side * 0.3, -0.53, 0.38), sensor_light, vertices=14, bevel=0.003, rotation=(math.pi / 2, 0, 0)))
    parent(join("robot_body", body), root)

    for label, wheel_x, wheel_y in (("fl", -0.38, -0.34), ("fr", 0.38, -0.34), ("rl", -0.38, 0.34), ("rr", 0.38, 0.34)):
        tyre = cylinder(f"robot_wheel_{label}_tyre", 0.12, 0.1, (wheel_x, wheel_y, 0.12), rubber, vertices=28, bevel=0.025, segments=3, rotation=(0, math.pi / 2, 0))
        side = 1 if wheel_x > 0 else -1
        hub = cylinder(f"robot_wheel_{label}_hub", 0.065, 0.104, (wheel_x, wheel_y, 0.12), steel, vertices=20, bevel=0.01, rotation=(0, math.pi / 2, 0))
        bolts = [cylinder(f"robot_wheel_{label}_bolt_{index}", 0.009, 0.012, (wheel_x + side * 0.053, wheel_y + math.cos(index * math.tau / 5) * 0.035,
                                                                             0.12 + math.sin(index * math.tau / 5) * 0.035), rubber, vertices=6, bevel=0,
                          rotation=(0, math.pi / 2, 0)) for index in range(5)]
        wheel = join(f"robot_wheel_{label}", [tyre, hub] + bolts)
        set_origin(wheel, (wheel_x, wheel_y, 0.12))
        parent(wheel, root)

    lift = join("robot_lift", [
        box("robot_lift_platform", (0.62, 0.62, 0.05), (0, -0.12, 0.58), steel, bevel=0.012),
        box("robot_lift_carriage", (0.46, 0.06, 0.12), (0, 0.24, 0.6), steel, bevel=0.01),
    ])
    set_origin(lift, (0, 0, 0))
    parent(lift, root)
    cargo = join("robot_cargo", [
        box("robot_cargo_body", (0.56, 0.5, 0.1), (0, -0.12, 0.66), rack_paint, bevel=0.015),
        box("robot_cargo_face", (0.5, 0.01, 0.07), (0, -0.372, 0.66), tray_face, bevel=0.003, uv_density=6),
        box("robot_cargo_glow", (0.42, 0.006, 0.02), (0, -0.38, 0.645), cargo_glow, bevel=0),
    ])
    set_origin(cargo, (0, 0, 0))
    parent(cargo, lift)
    beacon = sphere("robot_beacon", 0.07, (0, 0.38, 1.25), beacon_material)
    beacon_collar = cylinder("robot_beacon_collar", 0.06, 0.03, (0, 0.38, 1.22), mast_paint, vertices=20, bevel=0.008)
    parent(beacon, root)
    parent(beacon_collar, root)


def technician(name, suit_color, helmet_color, skin_color, trouser_color):
    suit = material(f"{name}_suit", suit_color, roughness=0.6)
    trousers = material(f"{name}_trousers", trouser_color, roughness=0.7)
    skin = material(f"{name}_skin", skin_color, roughness=0.6)
    helmet = material(f"{name}_helmet", helmet_color, roughness=0.3)
    reflective = material("reflective_band", "#e8ff6a", roughness=0.3, emission="#c8e040", emission_strength=0.4)
    boot = material("boot", "#2a2d38", roughness=0.7)
    eye = material("eye", "#1c1f2a", roughness=0.4)
    tablet = material("tablet", "#20232e", roughness=0.25, metallic=0.3)
    tablet_screen = material("screen", "#1b2a4a", roughness=0.2, emission="#3d6cff", emission_strength=1.2)

    root = empty(name)
    hip_height = 0.82
    for label, leg_x in (("l", -0.11), ("r", 0.11)):
        leg = join(f"{name}_leg_{label}", [
            cylinder(f"{name}_thigh_{label}", 0.088, 0.46, (leg_x, 0, hip_height - 0.23), trousers, vertices=16, bevel=0.03, segments=3, radius_top=0.095),
            cylinder(f"{name}_shin_{label}", 0.075, 0.34, (leg_x, 0, 0.27), trousers, vertices=16, bevel=0.025, segments=3, radius_top=0.085),
            box(f"{name}_boot_{label}", (0.14, 0.24, 0.1), (leg_x, -0.04, 0.05), boot, bevel=0.035, segments=3),
        ])
        set_origin(leg, (leg_x, 0, hip_height))
        parent(leg, root)

    body = join(f"{name}_body", [
        box(f"{name}_pelvis", (0.34, 0.22, 0.16), (0, 0, hip_height + 0.04), trousers, bevel=0.06, segments=3),
        cylinder(f"{name}_torso", 0.2, 0.52, (0, 0, 1.15), suit, vertices=24, bevel=0.08, segments=4, radius_top=0.22),
        cylinder(f"{name}_band", 0.214, 0.05, (0, 0, 1.2), reflective, vertices=24, bevel=0.01),
        box(f"{name}_badge", (0.07, 0.01, 0.05), (0.09, -0.212, 1.32), helmet, bevel=0.004),
        cylinder(f"{name}_neck", 0.06, 0.08, (0, 0, 1.43), skin, vertices=14, bevel=0.01),
        sphere(f"{name}_head", 0.16, (0, 0, 1.6), skin, scale=(1, 0.95, 1.08)),
        sphere(f"{name}_eye_l", 0.018, (-0.055, -0.145, 1.62), eye, segments=10, rings=6),
        sphere(f"{name}_eye_r", 0.018, (0.055, -0.145, 1.62), eye, segments=10, rings=6),
        sphere(f"{name}_helmet_dome", 0.172, (0, 0.005, 1.67), helmet, scale=(1, 1.05, 0.78)),
        cylinder(f"{name}_helmet_brim", 0.2, 0.02, (0, -0.02, 1.66), helmet, vertices=28, bevel=0.008),
        box(f"{name}_helmet_ridge", (0.04, 0.3, 0.04), (0, 0.005, 1.8), helmet, bevel=0.018, segments=3),
    ])
    set_origin(body, (0, 0, 0))
    parent(body, root)
    for label, side in (("l", -1), ("r", 1)):
        shoulder = (side * 0.26, 0, 1.38)
        arm_parts = [
            sphere(f"{name}_shoulder_{label}", 0.075, shoulder, suit),
            cylinder(f"{name}_upper_arm_{label}", 0.06, 0.3, (side * 0.27, 0, 1.22), suit, vertices=14, bevel=0.025, segments=3),
            cylinder(f"{name}_forearm_{label}", 0.052, 0.26, (side * 0.27, -0.02, 0.97), suit, vertices=14, bevel=0.02, segments=3),
            sphere(f"{name}_hand_{label}", 0.05, (side * 0.27, -0.03, 0.82), skin),
        ]
        if side > 0:
            arm_parts.append(box(f"{name}_tablet", (0.2, 0.02, 0.26), (0.2, -0.13, 0.9), tablet, bevel=0.012, rotation=(-0.6, 0, 0)))
            arm_parts.append(box(f"{name}_tablet_screen", (0.17, 0.004, 0.22), (0.2, -0.143, 0.905), tablet_screen, bevel=0, rotation=(-0.6, 0, 0)))
        arm = join(f"{name}_arm_{label}", arm_parts)
        set_origin(arm, shoulder)
        parent(arm, body)


def main():
    reset_scene()
    robot()
    technician("tech_a", "#5b4bff", "#ffffff", "#e9b993", "#384058")
    technician("tech_b", "#2e3a66", "#ffd23f", "#b98a64", "#2a2f44")
    technician("tech_c", "#1f9e8f", "#ffffff", "#8a5a3c", "#3b4152")
    export_glb("units.glb")


if __name__ == "__main__":
    main()
