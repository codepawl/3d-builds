"""Mule (rack-and-pinion electric towing locomotive) family -> mules.glb. Three colour/detail variants.
Origin = top of the rail under the centre of the mule. Faces -Y. Ship side = +X (rotate 180 deg about Z for the other wall)."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *
import canal_params as P

reset_scene()

glass = make_material("mule_glass", "#1d2a38", 0.15, 0.2)
dark = make_material("mule_dark", "#2a2f36", 0.6, 0.4)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
wheel_steel = make_material("wheel_steel", "#59616c", 0.45, 0.7)
rubber = make_material("seal_rubber", "#1b1f24", 0.9)
yellow = make_material("safety_yellow", "#f2b92d", 0.6)
cable_red = make_material("capstan_red", "#c9392b", 0.55)
lamp_off = make_material("lamp_off", "#2a3039", 0.5)
beacon_off = make_material("beacon_off", "#4a3d1c", 0.4)
palettes = {
    "a": ("#ee7a2b", "#f4f1ea", "#c85e18"),     # body orange, cab off-white, trim darker orange
    "b": ("#2f8f9d", "#f4f1ea", "#1f6874"),
    "c": ("#f1c232", "#f4f1ea", "#b8901c"),
}
WHEEL_X = P.MULE_GAUGE / 2
WHEEL_Y = (-4.2, -2.6, 2.6, 4.2)
WHEEL_RADIUS = 0.55


def build_wheel(name):
    part = Part(name)
    part.cylinder((0, 0, 0), WHEEL_RADIUS, 0.18, wheel_steel, axis="X", segments=24, bevel=0.03)
    part.cylinder((0, 0, 0), WHEEL_RADIUS + 0.08, 0.05, wheel_steel, axis="X", segments=24)       # flange
    part.cylinder((0.09, 0, 0), 0.2, 0.06, steel, axis="X", segments=12)
    for index in range(6):
        angle = index * math.pi / 3
        part.cylinder((0.12, math.sin(angle) * 0.34, math.cos(angle) * 0.34), 0.04, 0.05, dark, axis="X", segments=8)
    return part


def build_mule(variant):
    body_hex, cab_hex, trim_hex = palettes[variant]
    body_paint = make_material(f"mule_paint_{variant}", body_hex, 0.55)
    cab_paint = make_material(f"mule_cab_{variant}", cab_hex, 0.5)
    trim_paint = make_material(f"mule_trim_{variant}", trim_hex, 0.55)
    prefix = f"mule_{variant}"
    root = make_root(prefix)
    body = Part(prefix + "_body")
    body.box((0, 0, 1.05), (3.0, 10.4, 0.5), dark, bevel=0.08)                                        # chassis
    body.box((0, -3.4, 2.15), (2.5, 3.8, 1.7), body_paint, bevel=0.14)                                   # front hood
    body.box((0, -5.32, 2.15), (2.2, 0.06, 1.2), dark)                                                   # grille
    for index in range(5):
        body.box((0, -5.37, 1.75 + index * 0.22), (1.9, 0.04, 0.05), steel)
    body.box((0, 3.9, 2.0), (2.7, 2.9, 1.4), body_paint, bevel=0.14)                                     # rear machinery
    for index in range(7):                                                                                # resistor louvres
        body.box((1.36, 3.9, 1.5 + index * 0.17), (0.04, 2.4, 0.06), dark)
        body.box((-1.36, 3.9, 1.5 + index * 0.17), (0.04, 2.4, 0.06), dark)
    body.box((0, 0.4, 3.05), (3.0, 4.2, 3.6), cab_paint, bevel=0.16)                                     # cab
    body.box((0, 0.4, 4.95), (3.3, 4.6, 0.18), trim_paint, bevel=0.06)                                   # roof overhang
    body.box((0, 0.4, 1.35), (3.2, 4.4, 0.35), trim_paint, bevel=0.08)                                   # lower trim band
    for side in (-1, 1):
        body.box((side * 1.51, 0.4, 3.3), (0.05, 3.0, 1.1), glass)                                       # side windows
        body.box((side * 1.51, 0.4, 2.2), (0.05, 3.4, 0.08), dark)
    body.box((0, -1.72, 3.4), (2.4, 0.05, 1.2), glass)                                                    # windscreen
    body.box((0, 2.52, 3.4), (2.0, 0.05, 1.0), glass)                                                     # rear window
    body.box((0.0, -1.4, 5.15), (0.5, 1.0, 0.2), steel, bevel=0.04)                                       # roof fan housing
    for side in (-1, 1):                                                                                   # side rails and posts
        for index in range(12):
            y = -4.8 + index * 0.9
            if -1.7 < y < 2.7:
                continue
            body.box((side * 1.48, y, 1.65), (0.05, 0.05, 0.9), yellow)
        body.box((side * 1.48, -3.4, 2.1), (0.05, 3.6, 0.05), yellow)
        body.box((side * 1.48, 3.9, 2.1), (0.05, 2.6, 0.05), yellow)
    for y_sign in (-1, 1):                                                                                 # buffers
        for x_sign in (-1, 1):
            body.cylinder((x_sign * 0.9, y_sign * 5.4, 1.05), 0.16, 0.4, steel, axis="Y", segments=10)
    body.box((0, 0.4, 0.95), (1.6, 2.2, 0.5), dark, bevel=0.05)                                            # traction motor box
    body.cylinder((0, 0.0, 0.62), 0.4, 0.12, steel, axis="X", segments=16)                                 # rack pinion (static look)
    body.build(parent=root)
    # wheels, one object each so they can spin on their own axis
    wheels = []
    for y_index, y in enumerate(WHEEL_Y):
        for x_sign, tag in ((-1, "l"), (1, "r")):
            wheel = build_wheel(f"{prefix}_wheel_{tag}{y_index}")
            wheel_object = wheel.build(parent=root, location=(x_sign * WHEEL_X, y, WHEEL_RADIUS))
            wheels.append((wheel_object, x_sign))
    # capstan (vertical winch drum) on the hood, and the cable arm that carries the line to the ship
    capstan = Part(prefix + "_capstan")
    capstan.cylinder((0, 0, 0.0), 0.5, 0.15, steel, segments=20)
    capstan.cylinder((0, 0, 0.55), 0.3, 0.9, cable_red, segments=20, bevel=0.03)
    capstan.cylinder((0, 0, 1.05), 0.5, 0.12, steel, segments=20, bevel=0.03)
    capstan_object = capstan.build(parent=root, location=(0.5, -3.4, 3.0))
    arm = Part(prefix + "_cable_arm")
    arm.box((1.0, 0, 0.0), (2.2, 0.3, 0.25), steel, bevel=0.05)
    arm.cylinder((2.05, 0, 0.25), 0.28, 0.35, dark, segments=16, bevel=0.03)                              # fairlead sheave
    arm.cylinder((0, 0, 0.0), 0.28, 0.6, steel, segments=14, bevel=0.03)
    arm_object = arm.build(parent=root, location=(0.9, -3.4, 3.0 + 0.25))
    for side, material_tag in ((-1, "l"), (1, "r")):
        lamp = Part(f"{prefix}_headlamp_{material_tag}")
        lamp.box((0, 0, 0), (0.45, 0.12, 0.3), lamp_off, bevel=0.04)
        lamp.build(parent=root, location=(side * 0.8, -5.38, 2.6))
    beacon = Part(f"{prefix}_beacon")
    beacon.cylinder((0, 0, 0), 0.22, 0.3, beacon_off, segments=14, bevel=0.03)
    beacon.build(parent=root, location=(0.9, 1.0, 5.3))
    # clips
    for wheel_object, x_sign in wheels:
        add_clip(wheel_object, "wheel_roll", "rotation_euler", 0, [(1, 0.0), (30, math.radians(360) * -1)])
    add_clip(capstan_object, "capstan_spin", "rotation_euler", 2, [(1, 0.0), (30, math.radians(360))])
    add_clip(arm_object, "arm_swing_out", "rotation_euler", 2, [(1, 0.0), (30, math.radians(25))])
    return root


roots = [build_mule(variant) for variant in "abc"]
for root in roots:
    register("mules.glb", root, "top of the rail under the mule centre; children wheel_* pivot at the axle, capstan at the drum axis, cable_arm at its hinge",
             "faces -Y (hood at -Y, cab behind); ship side = +X", "wheel_roll, capstan_spin, arm_swing_out (1 s loops at 30 fps)",
             "electric towing locomotive 10.4 x 3.3 x 5.2 m on the wall-top track; hands the line to the ship")
export_glb("mules.glb", with_animation=True)
