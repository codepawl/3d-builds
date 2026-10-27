"""Tilt-tray sorter family: two tray variants, track straight and 90 degree curve, make-up chute with lamp states.

Travel is Blender +X. Tray: 1.15 x 0.85 m deck at z = 1.0, pitch 1.30 m, tilt about the X axis.
Track: rail gauge 0.70 m, rail top z = 0.40. Curve radius 2.0 m (centre line), module straight 2.0 m.
"""
import math
import sys

sys.path.insert(0, "<your folder>/viz-baggage/blender")
import lib
from lib import Part, add_clip, empty, export_glb, mat, reset_scene

TRAY_LENGTH, TRAY_WIDTH, DECK_Z, HINGE_Z = 1.15, 0.85, 1.0, 0.92
RAIL_Y, RAIL_TOP = 0.35, 0.40
CURVE_RADIUS = 2.0
CHUTE_ANGLE = math.radians(22)


def tray(variant, trim_color):
    root = empty(f"tilt_{variant}")
    carriage = Part(f"tilt_{variant}_carriage")
    frame = mat(f"tray_frame_{variant}", "steel_dark", rough=0.5, metal=0.5)
    trim = mat(f"tray_trim_{variant}", trim_color, rough=0.4)
    carriage.box((1.05, 0.8, 0.09), (0, 0, 0.55), frame, bevel=0.015)
    carriage.box((0.5, 0.34, 0.26), (0, 0, 0.72), trim, bevel=0.03, seg=3)
    carriage.cyl(0.07, 0.34, (0, 0, HINGE_Z - 0.01), frame, axis="X", segs=16, bevel=0.006)
    for sx in (1, -1):
        carriage.box((0.06, 0.4, 0.12), (sx * 0.2, 0, HINGE_Z - 0.05), frame, bevel=0.01)
        for sy in (1, -1):
            carriage.cyl(0.065, 0.05, (sx * 0.4, sy * RAIL_Y, RAIL_TOP + 0.065), mat("rubber_black"), axis="Y", segs=16, bevel=0.005)
            carriage.box((0.1, 0.06, 0.1), (sx * 0.4, sy * 0.38, 0.5), frame, bevel=0.01)
    carriage.box((0.5, 0.02, 0.12), (0, 0, 0.47), mat("safety_yellow"), bevel=0.004)   # linear-motor fin
    carriage.build(root)
    deck = Part(f"tilt_{variant}_deck")
    deck.box((TRAY_LENGTH, TRAY_WIDTH, 0.03), (0, 0, DECK_Z - 0.015), mat("tray_surface", "steel_dark", rough=0.6), bevel=0.01, seg=2)
    deck.box((TRAY_LENGTH - 0.1, TRAY_WIDTH - 0.1, 0.012), (0, 0, DECK_Z + 0.004), mat("tray_mat", "belt", rough=0.95), bevel=0.003, seg=1)
    for sx in (1, -1):
        deck.box((0.05, TRAY_WIDTH, 0.085), (sx * (TRAY_LENGTH / 2 - 0.025), 0, DECK_Z + 0.03), trim, bevel=0.012, seg=2)
    deck.box((0.7, 0.28, 0.07), (0, 0, HINGE_Z + 0.01), frame, bevel=0.012)
    deck.box((0.9, 0.05, 0.03), (0, 0, DECK_Z - 0.05), frame, bevel=0.006)
    pivot = deck.build(root, pivot=(0, 0, HINGE_Z))
    add_clip(pivot, "tilt_left", "rotation_euler", 0, [(1, 0.0), (6, math.radians(30)), (18, math.radians(30)), (26, 0.0)])
    add_clip(pivot, "tilt_right", "rotation_euler", 0, [(1, 0.0), (6, -math.radians(30)), (18, -math.radians(30)), (26, 0.0)])


def rail_profile(sign):
    return [(sign * 0.32, RAIL_TOP - 0.04), (sign * 0.38, RAIL_TOP - 0.04), (sign * 0.38, RAIL_TOP),
            (sign * 0.32, RAIL_TOP)]


def track(name, path, post_points):
    root = empty(name)
    part = Part(name + "_frame")
    steel = mat("track_steel", "steel", rough=0.45, metal=0.5)
    dark = mat("track_dark", "steel_dark", rough=0.6, metal=0.4)
    part.sweep([(-0.40, 0.30), (0.40, 0.30), (0.40, 0.34), (-0.40, 0.34)], path, dark, bevel=0.005)   # bed plate
    for sign in (1, -1):
        part.sweep(rail_profile(sign), path, steel, bevel=0.004)
        part.sweep([(sign * 0.50, 0.30), (sign * 0.53, 0.30), (sign * 0.53, 0.33), (sign * 0.50, 0.33)], path,
                   mat("safety_yellow"), bevel=0.003)   # power busbar
    for x, y, angle in post_points:
        for sign in (1, -1):
            lateral_x = -math.sin(angle) * 0.45 * sign
            lateral_y = math.cos(angle) * 0.45 * sign
            part.box((0.08, 0.08, 0.30), (x + lateral_x, y + lateral_y, 0.15), dark, bevel=0.008, rot=(0, 0, angle))
            part.cyl(0.08, 0.015, (x + lateral_x, y + lateral_y, 0.0075), mat("rubber_black"), segs=12, bevel=0.003)
        part.box((0.06, 0.9, 0.05), (x, y, 0.24), dark, bevel=0.008, rot=(0, 0, angle))
    part.build(root)


def build_tracks():
    track("sorter_track_straight", [(0, 0, 0), (2.0, 0, 0)], [(0.25, 0, 0), (1.0, 0, 0), (1.75, 0, 0)])
    steps = 24
    arc = [(CURVE_RADIUS * math.sin(math.pi / 2 * i / steps), CURVE_RADIUS * (1 - math.cos(math.pi / 2 * i / steps)), 0)
           for i in range(steps + 1)]
    posts = []
    for fraction in (0.08, 0.36, 0.64, 0.92):
        theta = math.pi / 2 * fraction
        posts.append((CURVE_RADIUS * math.sin(theta), CURVE_RADIUS * (1 - math.cos(theta)), theta))
    track("sorter_track_curve90", arc, posts)


def build_chute():
    root = empty("chute_slide")
    part = Part("chute_slide_body")
    length, width = 2.0, 1.0
    top_z = 0.85
    steel = mat("chute_steel", "alu", rough=0.3, metal=0.8)
    blue = mat("guard_blue")
    dark = mat("leg_dark")
    centre_y = length / 2 * math.cos(CHUTE_ANGLE)
    centre_z = top_z - length / 2 * math.sin(CHUTE_ANGLE)
    part.box((width, length, 0.03), (0, centre_y, centre_z), steel, bevel=0.008, rot=(-CHUTE_ANGLE, 0, 0))
    for sign in (1, -1):
        part.box((0.04, length, 0.22), (sign * (width / 2 + 0.02), centre_y, centre_z + 0.1), blue, bevel=0.01, rot=(-CHUTE_ANGLE, 0, 0))
    part.box((width + 0.1, 0.08, 0.05), (0, 0.02, top_z + 0.03), blue, bevel=0.01)   # head lip at the sorter edge
    part.box((width + 0.08, 0.05, 0.2), (0, length * math.cos(CHUTE_ANGLE) + 0.02, centre_z - length / 2 * math.sin(CHUTE_ANGLE) + 0.1), dark, bevel=0.01)
    for fraction in (0.15, 0.85):
        y = length * math.cos(CHUTE_ANGLE) * fraction
        z = top_z - length * math.sin(CHUTE_ANGLE) * fraction - 0.03
        for sign in (1, -1):
            part.box((0.06, 0.06, z), (sign * (width / 2 + 0.06), y, z / 2), dark, bevel=0.008)
    part.box((0.08, 0.08, 1.4), (-width / 2 - 0.1, 0.12, 0.7), dark, bevel=0.01)   # lamp post
    part.build(root)
    for index, (state, color) in enumerate((("open", "green"), ("full", "orange"), ("closed", "red"))):
        lamp = Part(f"chute_lamp_{state}")
        lamp.box((0.1, 0.1, 0.09), (-width / 2 - 0.1, 0.12, 1.28 + 0.11 * index), mat(f"chute_lamp_{state}", color, rough=0.3, emit=color, emit_strength=0.2 if state != "open" else 1.2), bevel=0.015)
        lamp.build(root)


def main():
    reset_scene()
    tray("blue", "blue")
    tray("grey", "steel")
    build_tracks()
    build_chute()
    export_glb("sorter.glb")


main()
