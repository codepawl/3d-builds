"""Harbour tug family -> tugs.glb (2 colour variants). Azimuth-drive tug 32 m x 11 m, draft 4.8 m (made-up design).
Origin = midship centre line at the waterline. Bow faces -Y. Thrusters are separate nodes pivoted on their steering axis."""
import sys
sys.path.insert(0, "<your folder>/viz-canal/blender")
from lib import *
from hulls import Hull

reset_scene()

glass = make_material("ship_glass", "#22313f", 0.15, 0.2)
steel = make_material("steel_grey", "#7d8794", 0.5, 0.6)
dark = make_material("mule_dark", "#2a2f36", 0.6, 0.4)
fender = make_material("fender_rubber", "#1b1f24", 0.9)
white = make_material("ship_white", "#f1f2ee", 0.55)
boot_black = make_material("ship_boot_black", "#23282f", 0.8)
antifoul = make_material("ship_antifoul", "#8a3b2d", 0.8)
deck_grey = make_material("ship_deck_grey", "#7d8791", 0.8)
yellow = make_material("safety_yellow", "#f2b92d", 0.6)
spotlight_off = make_material("lamp_off", "#2a3039", 0.5)
nav_off = make_material("beacon_off", "#4a3d1c", 0.4)


def build_tug(tag, hull_hex, house_hex, stripe_hex):
    spec = dict(L=32.0, B=11.0, T=4.8, free=2.4, entrance=0.34, run=0.70, stern_taper=0.35, bow_power=1.5, rake=1.2,
                bilge=1.4, flare=0.10, bow_sheer=0.8, stem_depth=1.6, stern_keel_z=-4.2, stern_lift_start=0.9)
    hull = Hull(spec)
    mats = {"topside": make_material(f"tug_hull_{tag}", hull_hex, 0.55), "boot": boot_black, "bottom": antifoul,
            "deck": deck_grey}
    house_paint = make_material(f"tug_house_{tag}", house_hex, 0.55)
    stripe_paint = make_material(f"tug_stripe_{tag}", stripe_hex, 0.55)
    root = make_root(f"tug_{tag}")
    part = Part(root.name + "_hull")
    hull.build(part, mats)
    free = spec["free"]
    # rub rail and bow fender (rubber), towing bitts, winch, house, wheelhouse, funnel, mast
    half = spec["B"] / 2
    for side in (-1, 1):
        part.box((side * (half + 0.12), 1.0, free - 0.5), (0.35, 10.0, 0.6), fender, bevel=0.1)
        part.box((side * (half - 0.4), 1.0, free + 0.5), (0.1, 10.0, 1.0), stripe_paint)
    part.box((0, hull.y_of(0.02) + 0.5, free - 0.2), (3.0, 1.2, 1.0), fender, bevel=0.3)
    part.cylinder((0, hull.y_of(0.12), free + 0.5), 0.45, 1.0, steel, segments=12, bevel=0.05)
    part.box((0, hull.y_of(0.30), free + 0.6), (3.2, 2.4, 1.2), steel, bevel=0.2)                      # towing winch
    part.cylinder((0, hull.y_of(0.30), free + 1.35), 0.9, 0.3, dark, segments=16)
    part.box((0, 3.0, free + 1.6), (8.6, 11.0, 3.2), house_paint, bevel=0.35)                          # main house
    for side in (-1, 1):
        part.box((side * 4.32, 3.0, free + 1.9), (0.06, 8.0, 1.0), glass)
    part.box((0, -2.55, free + 1.9), (6.4, 0.06, 1.0), glass)
    part.box((0, 2.2, free + 4.4), (7.0, 6.0, 2.8), house_paint, bevel=0.35)                           # wheelhouse
    part.box((0, 2.2, free + 4.7), (7.04, 6.04, 1.3), glass)
    part.box((0, 2.2, free + 5.9), (7.6, 6.6, 0.25), stripe_paint, bevel=0.06)
    part.box((0, 7.2, free + 4.6), (3.4, 3.0, 3.0), stripe_paint, bevel=0.4)                           # funnel
    part.box((0, 7.2, free + 6.2), (3.0, 2.6, 0.3), dark)
    part.cylinder((0, 3.0, free + 7.4), 0.1, 3.0, steel, segments=8)                                   # mast
    part.box((0, 3.0, free + 8.4), (1.6, 0.12, 0.12), steel)
    for side in (-1, 1):                                                                                # bow-side lifebuoy ring
        part.cylinder((side * 4.4, 5.0, free + 2.2), 0.4, 0.12, yellow, axis="X", segments=14)
    for index in range(10):                                                                             # deck rail posts
        y = hull.y_of(0.06) + index * 1.5
        for side in (-1, 1):
            w = hull.half_width((y + spec["L"] / 2) / spec["L"]) - 0.5
            part.box((side * w, y, free + 0.55), (0.05, 0.05, 1.1), yellow)
    part.build(parent=root)
    for side, label in ((-1, "l"), (1, "r")):
        thruster = Part(f"{root.name}_thruster_{label}")
        thruster.cylinder((0, 0, -0.9), 0.8, 1.8, dark, segments=16, bevel=0.08)
        thruster.cylinder((0, 0, -2.0), 1.2, 0.5, steel, segments=16, radius_top=0.9)
        thruster.cylinder((0, 0, -2.3), 0.55, 0.45, steel, axis="Y", segments=12)
        thruster_object = thruster.build(parent=root, location=(side * 2.6, 8.8, -spec["T"] + 2.8))
        add_clip(thruster_object, "thruster_steer", "rotation_euler", 2, [(1, 0.0), (30, math.radians(60)), (60, 0.0)])
    for index, label in enumerate(("nav_light", "spotlight")):
        lamp = Part(f"{root.name}_{label}")
        lamp.box((0, 0, 0), (0.5, 0.5, 0.4), nav_off if label == "nav_light" else spotlight_off, bevel=0.06)
        lamp.build(parent=root, location=(0, 2.2 if index == 0 else -0.7, free + (8.7 if index == 0 else 6.2)))
    return root


roots = [build_tug("a", "#d2562c", "#f1f2ee", "#2d4a73"), build_tug("b", "#2c6f87", "#f1f2ee", "#f2b92d")]
for root in roots:
    register("tugs.glb", root, "midship centre line at the waterline; *_thruster_l/r pivot on the steering axis",
             "bow toward -Y (blender) = +Z (glTF)", "thruster_steer (60 f)",
             "azimuth harbour tug 32 x 11 m, draft 4.8 m, for the approach channel and lake side")
export_glb("tugs.glb", with_animation=True)
